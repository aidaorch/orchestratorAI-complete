import React, { useState, useEffect, useRef } from 'react';
import {
    WorkflowTemplate, TemplateVersion, getTemplates, getTemplateById, deleteTemplate,
    exportTemplateToJSON, importTemplateFromJSON, restoreTemplateVersion, cloneTemplate
} from '../services/templateService';
import { WorkflowResult } from '../types';
import {
    FileText, Trash2, Download, Upload, X, Copy, History,
    CheckCircle2, Search, ChevronRight, Tag
} from 'lucide-react';
import WorkflowVisualizer from './WorkflowVisualizer';

interface TemplateLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadTemplate: (workflow: WorkflowResult) => void;
    /** inline=true: diagram card grid (prompt screen)
     *  page=true:   full list+detail without modal overlay (templates nav page)
     *  neither:     modal overlay */
    inline?: boolean;
    page?: boolean;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
    isOpen, onClose, onLoadTemplate, inline = false, page = false,
}) => {
    const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
    const [fullTemplates, setFullTemplates] = useState<Record<string, WorkflowTemplate>>({});
    const [selected, setSelected] = useState<WorkflowTemplate | null>(null);
    const [selectedLoading, setSelectedLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [detailTab, setDetailTab] = useState<'preview' | 'versions'>('preview');
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (isOpen) refresh(); }, [isOpen]);
    useEffect(() => {
        if (importStatus) { const t = setTimeout(() => setImportStatus(null), 4000); return () => clearTimeout(t); }
    }, [importStatus]);

    const refresh = async () => {
        const list = await getTemplates();
        setTemplates(list);
        if (selected) setSelected(list.find(t => t.id === selected.id) || null);
        // In inline mode, fetch full data for each template so diagrams render correctly
        if (inline) {
            const fullMap: Record<string, WorkflowTemplate> = {};
            await Promise.all(list.map(async t => {
                const full = await getTemplateById(t.id);
                if (full) fullMap[t.id] = full;
            }));
            setFullTemplates(fullMap);
        }
    };

    const filtered = templates.filter(t =>
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.tags || []).some((tag: string) => tag.toLowerCase().includes(search.toLowerCase()))
    );

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this template?')) {
            await deleteTemplate(id);
            if (selected?.id === id) setSelected(null);
            await refresh();
        }
    };

    const handleLoad = async (template: WorkflowTemplate) => {
        try {
            const full = await getTemplateById(template.id);
            onLoadTemplate(full ? full.workflow : template.workflow);
        } catch { onLoadTemplate(template.workflow); }
        onClose();
    };

    const handleClone = async (template: WorkflowTemplate) => { await cloneTemplate(template.id); await refresh(); };

    const handleExport = async (template: WorkflowTemplate) => {
        const json = await exportTemplateToJSON(template.id);
        if (!json) return;
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${template.name.replace(/\s+/g, '_')}.json`;
        a.click(); URL.revokeObjectURL(url);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        await processImportFile(file); e.target.value = '';
    };

    const processImportFile = async (file: File) => {
        try {
            const text = await file.text();
            const imported = await importTemplateFromJSON(text);
            if (imported) { setImportStatus({ type: 'success', message: `Template "${imported.name}" imported successfully!` }); await refresh(); }
            else setImportStatus({ type: 'error', message: 'Invalid template file.' });
        } catch { setImportStatus({ type: 'error', message: 'Failed to read file.' }); }
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'application/json') await processImportFile(file);
        else setImportStatus({ type: 'error', message: 'Please drop a JSON file.' });
    };

    const handleRestoreVersion = async (templateId: string, versionId: string) => {
        await restoreTemplateVersion(templateId, versionId); await refresh();
    };

    if (!isOpen) return null;

    // ── INLINE MODE — diagram-only card grid (prompt screen) ─────────────────
    if (inline) {
        return (
            <div>
                {filtered.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{templates.length === 0 ? 'No templates saved yet' : 'No results'}</p>
                        {templates.length === 0 && <p className="text-xs mt-1">Generate a workflow and save as template.</p>}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((t: WorkflowTemplate) => {
                            const full = fullTemplates[t.id];
                            const displayWorkflow = full?.workflow ?? t.workflow;
                            const hasSteps = (displayWorkflow?.steps?.length ?? 0) > 0;
                            return (
                                <div key={t.id} onClick={async () => {
                                    const wf = full?.workflow ?? (await getTemplateById(t.id))?.workflow ?? t.workflow;
                                    onLoadTemplate(wf);
                                    onClose();
                                }}
                                    className="bg-white border-2 border-slate-200 hover:border-aida-teal rounded-xl overflow-hidden cursor-pointer transition-all group shadow-sm hover:shadow-md"
                                >
                                    <div className="h-40 bg-slate-50 overflow-hidden pointer-events-none">
                                        {hasSteps ? (
                                            <WorkflowVisualizer data={displayWorkflow} editMode={false} connectorStyle="straight" />
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-slate-300 text-xs">
                                                {full ? 'No steps' : 'Loading…'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="px-3 py-2.5 border-t border-slate-100">
                                        <p className="font-semibold text-sm text-slate-800 truncate">{t.name}</p>
                                        {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
                                        <p className="text-xs text-aida-teal mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to load →</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ── SHARED BODY — list + detail panel (used by both page and modal modes) ─
    const body = (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Template list */}
            <div className={`${selected ? 'hidden md:block' : 'block'} w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto p-3 space-y-2 md:max-h-full max-h-64`}>
                {filtered.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{templates.length === 0 ? 'No templates saved yet' : 'No results'}</p>
                        {templates.length === 0 && <p className="text-xs mt-1">Generate a workflow and save as template.</p>}
                    </div>
                ) : filtered.map((t: WorkflowTemplate) => (
                    <div key={t.id}
                        onClick={async () => {
                            setDetailTab('preview'); setSelected(t); setSelectedLoading(true);
                            const full = await getTemplateById(t.id);
                            if (full) setSelected(full); setSelectedLoading(false);
                        }}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selected?.id === t.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                        <div className="flex items-start justify-between gap-1.5">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm text-slate-800 truncate">{t.name}</h3>
                                {t.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.description}</p>}
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {(t.tags || []).map((tag: string) => (
                                        <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-xs">
                                            <Tag className="w-2.5 h-2.5" />{tag}
                                        </span>
                                    ))}
                                    <span className="text-xs text-slate-400">{t.stepCount ?? t.workflow?.steps?.length ?? 0} steps</span>
                                    {(t.versions?.length || 0) > 1 && <span className="text-xs text-purple-500">v{t.versions?.length}</span>}
                                </div>
                            </div>
                            <button onClick={(e: React.MouseEvent) => handleDelete(t.id, e)} className="p-1 text-red-400 hover:bg-red-50 rounded shrink-0 hover:text-red-600 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Template detail */}
            <div className={`${selected ? 'block' : 'hidden md:flex'} flex-1 overflow-y-auto p-4 sm:p-5`}>
                {selected ? (
                    <div className="space-y-4">
                        <button onClick={() => setSelected(null)} className="md:hidden flex items-center gap-1.5 text-sm text-aida-teal font-medium mb-2">← Back to list</button>
                        {selectedLoading && (
                            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                                Loading template…
                            </div>
                        )}
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">{selected.name}</h3>
                            <p className="text-slate-500 text-sm mt-1">{selected.description || 'No description'}</p>
                            <div className="flex gap-2 mt-3">
                                <span className="text-xs text-slate-400">Created: {new Date(selected.createdAt).toLocaleDateString()}</span>
                                <span className="text-xs text-slate-400">·</span>
                                <span className="text-xs text-slate-400">Updated: {new Date(selected.updatedAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 border-b border-slate-200">
                            {(['preview', 'versions'] as const).map(tab => (
                                <button key={tab} onClick={() => setDetailTab(tab)}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${detailTab === tab ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    {tab === 'versions'
                                        ? <span className="flex items-center gap-1"><History className="w-3.5 h-3.5" />Versions {selected.versions?.length ? `(${selected.versions.length})` : ''}</span>
                                        : 'Preview'}
                                </button>
                            ))}
                        </div>

                        {/* Preview — diagram + prompt, NO step list */}
                        {detailTab === 'preview' && (
                            <div className="space-y-4">
                                {selected.workflow?.original_prompt && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Original Prompt</p>
                                        <p className="text-sm text-slate-700 leading-relaxed">{selected.workflow.original_prompt}</p>
                                    </div>
                                )}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden h-[300px] shadow-inner">
                                    {selectedLoading ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading preview…</div>
                                    ) : (selected.workflow?.steps?.length || 0) > 0 ? (
                                        <WorkflowVisualizer data={selected.workflow} editMode={false} connectorStyle="straight" />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">No steps to preview</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Versions */}
                        {detailTab === 'versions' && (
                            <div className="space-y-2">
                                {(!selected.versions || selected.versions.length === 0) ? (
                                    <p className="text-sm text-slate-400 text-center py-6">No version history yet.</p>
                                ) : selected.versions.slice().reverse().map((v: TemplateVersion, idx: number) => (
                                    <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded">v{v.version}</span>
                                                {idx === 0 && <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Current</span>}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">{v.changeNote || 'No note'}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{new Date(v.savedAt).toLocaleString()} · {v.workflow?.steps?.length || 0} steps</p>
                                        </div>
                                        {idx !== 0 && (
                                            <button onClick={() => { if (confirm('Restore this version?')) handleRestoreVersion(selected.id, v.id); }}
                                                className="text-xs px-3 py-1.5 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors shrink-0"
                                            >Restore</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                            <button onClick={() => handleLoad(selected)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all text-sm"
                            ><ChevronRight className="w-4 h-4" /> Load Template</button>
                            <button onClick={() => handleClone(selected)}
                                className="flex items-center gap-2 px-4 py-2.5 border-2 border-emerald-600 text-emerald-600 rounded-xl font-medium hover:bg-emerald-50 text-sm"
                            ><Copy className="w-4 h-4" /> Clone</button>
                            <button onClick={() => handleExport(selected)}
                                className="flex items-center gap-2 px-4 py-2.5 border-2 border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-50 text-sm"
                            ><Download className="w-4 h-4" /> Export JSON</button>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <FileText className="w-16 h-16 mx-auto mb-3 opacity-20" />
                            <p>Select a template to preview</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // ── TOOLBAR (shared) ──────────────────────────────────────────────────────
    const toolbar = (
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-36">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search templates…"
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
            </div>
            <input ref={fileRef} type="file" className="hidden" accept=".json,application/json" onChange={handleImport} />
            <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors shadow-sm"
            ><Upload className="w-4 h-4" /> Import JSON</button>
            <p className="text-xs text-slate-500">or drag & drop a JSON file</p>
        </div>
    );

    const importBanner = importStatus && (
        <div className={`shrink-0 px-4 py-3 flex items-center gap-3 ${importStatus.type === 'success' ? 'bg-emerald-50 border-b border-emerald-200' : 'bg-red-50 border-b border-red-200'}`}>
            {importStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <X className="w-5 h-5 text-red-600 shrink-0" />}
            <p className={`text-sm font-medium flex-1 ${importStatus.type === 'success' ? 'text-emerald-900' : 'text-red-900'}`}>{importStatus.message}</p>
            <button onClick={() => setImportStatus(null)} className="p-1 hover:bg-black/5 rounded"><X className="w-4 h-4" /></button>
        </div>
    );

    const dragOverlay = isDragging && (
        <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl p-8 border-4 border-dashed border-emerald-500">
                <Upload className="w-16 h-16 text-emerald-600 mx-auto mb-3" />
                <p className="text-lg font-bold text-emerald-900">Drop JSON file to import</p>
            </div>
        </div>
    );

    // ── PAGE MODE — full list+detail, no modal overlay (Templates nav page) ───
    if (page) {
        return (
            <div className={`flex flex-col h-full relative ${isDragging ? 'ring-4 ring-emerald-400 ring-inset' : ''}`}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
                {dragOverlay}
                {importBanner}
                {toolbar}
                {body}
            </div>
        );
    }

    // ── MODAL MODE ────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col h-[80vh] relative ${isDragging ? 'ring-4 ring-emerald-400 ring-inset' : ''}`}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
                {dragOverlay}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex items-center justify-between shrink-0 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6" />
                        <h2 className="text-xl font-bold">Workflow Templates</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                </div>
                {importBanner}
                {toolbar}
                {body}
            </div>
        </div>
    );
};
