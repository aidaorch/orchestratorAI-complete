import React, { useState, useEffect, useRef } from 'react';
import { WorkflowStep, InputConfig } from '../types';
import { AGENT_LIBRARY } from '../data/agentLibrary';
import { getAgentTypes, addCustomAgentType } from '../services/dbService';
import { X, Save, Search, Upload, MessageSquare, Plus } from 'lucide-react';

interface StepEditorProps {
    step: WorkflowStep | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (step: WorkflowStep) => void;
    isNewStep?: boolean;
    insertAfterStepId?: number;
    allSteps?: WorkflowStep[];
}

export const StepEditor: React.FC<StepEditorProps> = ({
    step,
    isOpen,
    onClose,
    onSave,
    isNewStep = false,
    insertAfterStepId,
    allSteps = [],
}) => {
    const DEFAULT: WorkflowStep = {
        step_id: 1,
        agent_type: 'Content',
        agent_ids: [],
        action_description: '',
        timing_logic: 'Manual',
        input_config: { source: 'PM_Input', type: 'Raw_Text', input_type: 'prompt', prompt_text: '' },
        output_storage: '',
        inline_comment: '',
    };

    const [edited, setEdited] = useState<WorkflowStep>(DEFAULT);
    const [agentSearch, setAgentSearch] = useState('');
    const [agentTypes, setAgentTypes] = useState<string[]>(getAgentTypes());
    const [newTypeInput, setNewTypeInput] = useState('');
    const [showAddType, setShowAddType] = useState(false);
    const [scriptFile, setScriptFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (step) {
            setEdited({ ...step });
        } else {
            setEdited(DEFAULT);
        }
        setAgentSearch('');
        setScriptFile(null);
        setNewTypeInput('');
        setShowAddType(false);
        setAgentTypes(getAgentTypes());
    }, [step, isOpen]);

    const update = (patch: Partial<WorkflowStep>) => setEdited(prev => ({ ...prev, ...patch }));
    const updateInput = (patch: Partial<InputConfig>) =>
        setEdited(prev => ({ ...prev, input_config: { ...prev.input_config, ...patch } }));

    const filteredAgents = AGENT_LIBRARY.filter(a =>
        a.type === edited.agent_type &&
        (agentSearch === '' || a.name.toLowerCase().includes(agentSearch.toLowerCase()) || a.description.toLowerCase().includes(agentSearch.toLowerCase()))
    );

    const toggleAgent = (id: string) => {
        const ids = edited.agent_ids || [];
        update({ agent_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
    };

    const handleAddCustomType = () => {
        const trimmed = newTypeInput.trim();
        if (trimmed && !agentTypes.includes(trimmed)) {
            addCustomAgentType(trimmed);
            const updated = getAgentTypes();
            setAgentTypes(updated);
            update({ agent_type: trimmed });
        }
        setNewTypeInput('');
        setShowAddType(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setScriptFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => updateInput({ script_content: ev.target?.result as string });
        reader.readAsText(file);
    };

    // All other steps (not the current one) can be a dependency
    const predecessorSteps = allSteps.filter(s => s.step_id !== edited.step_id);

    // Detect cycles: returns true if making `edited` depend on `targetId` would create a cycle
    // We check: can we reach `edited.step_id` by following depends_on chains FROM `targetId` upstream?
    // i.e., does targetId (directly or transitively) already depend on edited.step_id?
    const wouldCreateCycle = (targetId: number): boolean => {
        const visited = new Set<number>();
        const queue = [targetId];
        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current === edited.step_id) return true;
            if (visited.has(current)) continue;
            visited.add(current);
            // Find the step and traverse its dependencies (upstream)
            const step = allSteps.find(s => s.step_id === current);
            if (step?.depends_on) step.depends_on.forEach(d => queue.push(d));
        }
        return false;
    };

    const handleSave = () => {
        if (!edited.action_description.trim()) {
            alert('Action description is required.');
            return;
        }
        onSave(edited);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-aida-teal to-aida-dark">
                    <h2 className="text-lg font-bold">{isNewStep ? '➕ Add Step' : '✏️ Edit Step'}</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Step ID */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Step ID</label>
                        <input
                            type="number"
                            value={edited.step_id}
                            onChange={e => update({ step_id: parseInt(e.target.value) || 1 })}
                            disabled={!isNewStep}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        {isNewStep && (
                            <p className="text-xs text-slate-400 mt-1">Step IDs will be auto-reindexed after insertion.</p>
                        )}
                    </div>

                    {/* Agent Type */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Agent Type</label>
                        <div className="flex gap-2">
                            <select
                                value={edited.agent_type}
                                onChange={e => update({ agent_type: e.target.value, agent_ids: [] })}
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal focus:border-transparent"
                            >
                                {agentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <button type="button"
                                onClick={() => setShowAddType(t => !t)}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                New Type
                            </button>
                        </div>
                        {showAddType && (
                            <div className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    value={newTypeInput}
                                    onChange={e => setNewTypeInput(e.target.value)}
                                    placeholder="e.g., Notification"
                                    className="flex-1 px-3 py-2 border border-aida-teal rounded-lg text-sm focus:ring-2 focus:ring-aida-teal"
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCustomType(); }}
                                />
                                <button type="button" onClick={handleAddCustomType} className="px-3 py-2 bg-aida-teal text-white rounded-lg text-sm font-medium hover:bg-aida-dark">Add</button>
                            </div>
                        )}
                    </div>

                    {/* Agent Library — searchable dropdown */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Select Agents from Library</label>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
                                <Search className="w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={agentSearch}
                                    onChange={e => setAgentSearch(e.target.value)}
                                    placeholder="Search agents..."
                                    className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400"
                                />
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                                {filteredAgents.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-4">No agents for this type</p>
                                ) : (
                                    filteredAgents.map(agent => (
                                        <div
                                            key={agent.id}
                                            onClick={() => toggleAgent(agent.id)}
                                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-aida-light border-b border-slate-100 last:border-0 transition-colors ${(edited.agent_ids || []).includes(agent.id) ? 'bg-aida-light' : ''}`}
                                        >
                                            <span className="text-lg">{agent.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-800">{agent.name}</div>
                                                <div className="text-xs text-slate-500 truncate">{agent.description}</div>
                                            </div>
                                            {(edited.agent_ids || []).includes(agent.id) && <span className="text-aida-teal text-sm font-bold">✓</span>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        {(edited.agent_ids || []).length > 0 && (
                            <p className="text-xs text-aida-teal mt-1">{(edited.agent_ids || []).length} agent(s) selected</p>
                        )}
                    </div>

                    {/* Action Description */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Action Description</label>
                        <textarea
                            value={edited.action_description}
                            onChange={e => update({ action_description: e.target.value })}
                            rows={3}
                            placeholder="Describe what this step does in detail..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Connections (depends_on) */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Incoming Connections</label>
                        <p className="text-xs text-slate-400 mb-2">Select which previous steps must complete before this step begins. (Creates branches & parallel paths)</p>
                        <div className="flex flex-wrap gap-2">
                            {predecessorSteps.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No other steps yet. Add more steps to create connections.</p>
                            ) : (
                                predecessorSteps.map(pred => {
                                    const isSelected = (edited.depends_on || []).includes(pred.step_id);
                                    return (
                                        <button type="button"
                                            key={pred.step_id}
                                            onClick={() => {
                                                const cur = edited.depends_on || [];
                                                const isRemoving = isSelected;

                                                // Prevent creating circular dependencies
                                                if (!isRemoving && wouldCreateCycle(pred.step_id)) {
                                                    alert(`Cannot add this connection: it would create a circular dependency.`);
                                                    return;
                                                }

                                                const newDepends = isRemoving ? cur.filter(id => id !== pred.step_id) : [...cur, pred.step_id].sort();

                                                // If removing visual dependency, also remove from prior_step_ids to keep logic sound
                                                const curPrior = edited.input_config.prior_step_ids || [];
                                                const newPrior = isRemoving ? curPrior.filter(id => id !== pred.step_id) : curPrior;

                                                setEdited(prev => ({
                                                    ...prev,
                                                    depends_on: newDepends,
                                                    input_config: {
                                                        ...prev.input_config,
                                                        prior_step_ids: newPrior,
                                                        ...(prev.input_config.input_type === 'prior_output' ? {
                                                            source: newPrior.length > 1 ? '(Multiple Sources)' : (newPrior.length === 1 ? `Step_${newPrior[0]}_Output` : 'PM_Input'),
                                                            type: newPrior.length > 0 ? 'Prior_Output' : 'Raw_Text'
                                                        } : {})
                                                    }
                                                }));
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5
                                                ${isSelected ? 'bg-aida-light border-aida-teal text-aida-dark' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'}`}
                                        >
                                            <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center text-[10px] font-bold shadow-sm shrink-0">
                                                {pred.step_id}
                                            </span>
                                            <span className="truncate max-w-[120px]">{pred.action_description || pred.agent_type}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Timing Logic */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Timing Logic</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {['Trigger', 'Manual', 'Auto', 'Recurring'].map(t => (
                                <button type="button"
                                    key={t}
                                    onClick={() => update({ timing_logic: t })}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${edited.timing_logic === t ? 'bg-aida-teal border-aida-teal text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-aida-teal hover:text-aida-teal'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        {edited.timing_logic === 'Trigger' && (
                            <textarea
                                value={edited.trigger_condition || ''}
                                onChange={e => update({ trigger_condition: e.target.value })}
                                placeholder="Describe the trigger condition (e.g., 'When a new lead is added to Salesforce')"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal"
                                rows={2}
                            />
                        )}
                        {edited.timing_logic === 'Recurring' && (
                            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Period</label>
                                        <select
                                            value={edited.recurring_period || 'daily'}
                                            onChange={e => update({ recurring_period: e.target.value as any })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal"
                                        >
                                            <option value="hourly">Hourly</option>
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Time (Optional)</label>
                                        <input
                                            type="time"
                                            value={edited.recurring_time || ''}
                                            onChange={e => update({ recurring_time: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Stop Condition (Optional)</label>
                                    <input
                                        type="text"
                                        value={edited.recurring_stop_condition || ''}
                                        onChange={e => update({ recurring_stop_condition: e.target.value })}
                                        placeholder="e.g., Run until target audience size reaches 10,000"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">If empty, will run indefinitely based on the period.</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Input Logic */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Input Type (SRS FR-SC-02)</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                            {([['prompt', '💬 Prompt'], ['script', '📜 Script'], ['prior_output', '🔗 Prior Output']] as [string, string][]).map(([val, label]) => (
                                <button type="button"
                                    key={val}
                                    onClick={() => updateInput({ input_type: val as any })}
                                    className={`py-2 rounded-lg text-xs font-medium transition-all border ${edited.input_config.input_type === val ? 'bg-aida-teal text-white border-aida-teal' : 'bg-white text-slate-600 border-slate-300 hover:border-aida-teal'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Input sub-fields */}
                        {edited.input_config.input_type === 'prompt' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <label className="block text-xs font-semibold text-blue-700 mb-1.5">Prompt</label>
                                <textarea
                                    value={edited.input_config.prompt_text || ''}
                                    onChange={e => updateInput({ prompt_text: e.target.value, source: 'PM_Input', type: 'Raw_Text' })}
                                    rows={4}
                                    placeholder="Enter the prompt to be sent to the AI agent for this step..."
                                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 resize-none bg-white"
                                />
                            </div>
                        )}

                        {edited.input_config.input_type === 'script' && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Script Content</label>
                                <textarea
                                    value={edited.input_config.script_content || ''}
                                    onChange={e => updateInput({ script_content: e.target.value, source: 'Script', type: 'Script' })}
                                    rows={5}
                                    placeholder="Paste or type your JS/Python/other script here..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-aida-teal resize-none bg-white"
                                />
                                <input ref={fileInputRef} type="file" className="hidden" accept=".js,.py,.sh,.ts" onChange={handleFileUpload} />
                                <button type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    {scriptFile ? `Loaded: ${scriptFile.name}` : 'Upload Script File'}
                                </button>
                            </div>
                        )}

                        {edited.input_config.input_type === 'prior_output' && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                <label className="block text-xs font-semibold text-emerald-700 mb-1.5">Select Prior Step Output(s)</label>
                                {predecessorSteps.length === 0 ? (
                                    <p className="text-xs text-emerald-600">No predecessor steps available.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {predecessorSteps.map(ps => {
                                            const isSelected = (edited.input_config.prior_step_ids || []).includes(ps.step_id);
                                            return (
                                                <label key={ps.step_id} className="flex items-start gap-3 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            const ids = edited.input_config.prior_step_ids || [];
                                                            const isRemoving = isSelected;
                                                            const newPriorIds = isRemoving ? ids.filter(id => id !== ps.step_id) : [...ids, ps.step_id];

                                                            // Explicitly selecting a data dependency (Prior Output) should also ensure a visual connection exists
                                                            const currentDepends = edited.depends_on || [];
                                                            const newDepends = isRemoving
                                                                ? currentDepends
                                                                : (currentDepends.includes(ps.step_id) ? currentDepends : [...currentDepends, ps.step_id]).sort();

                                                            setEdited(prev => ({
                                                                ...prev,
                                                                depends_on: newDepends,
                                                                input_config: {
                                                                    ...prev.input_config,
                                                                    prior_step_ids: newPriorIds,
                                                                    source: newPriorIds.length > 1 ? '(Multiple Sources)' : (newPriorIds.length === 1 ? `Step_${newPriorIds[0]}_Output` : 'PM_Input'),
                                                                    type: newPriorIds.length > 0 ? 'Prior_Output' : 'Raw_Text'
                                                                }
                                                            }));
                                                        }}
                                                        className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                                                    />
                                                    <div>
                                                        <div className="text-sm text-slate-700 font-medium">Step {ps.step_id}: {ps.action_description.slice(0, 50)}{ps.action_description.length > 50 ? '…' : ''}</div>
                                                        {ps.output_storage && (
                                                            <div className="text-xs text-emerald-700 font-mono mt-0.5">📁 {ps.output_storage}</div>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Output Storage */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Output Storage</label>
                        <input
                            type="text"
                            value={edited.output_storage}
                            onChange={e => update({ output_storage: e.target.value })}
                            placeholder="e.g., s3://bucket/output.json, postgres://table, local://output/"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal focus:border-transparent"
                        />
                    </div>

                    {/* Parallel Group */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Parallel Group <span className="text-slate-400 font-normal">(optional — steps with same group run concurrently)</span></label>
                        <input
                            type="text"
                            value={edited.parallel_group || ''}
                            onChange={e => update({ parallel_group: e.target.value || undefined })}
                            placeholder="e.g., group_A  (leave empty for sequential)"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal focus:border-transparent"
                        />
                    </div>

                    {/* Inline Comment */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" /> Inline Comment (FR-WE-07)
                        </label>
                        <input
                            type="text"
                            value={edited.inline_comment || ''}
                            onChange={e => update({ inline_comment: e.target.value })}
                            placeholder="Internal note for team reference..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-aida-teal focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors text-sm">Cancel</button>
                    <button type="button"
                        onClick={handleSave}
                        className="px-5 py-2 bg-gradient-to-r from-aida-teal to-aida-dark"
                    >
                        <Save className="w-4 h-4" />
                        Save Step
                    </button>
                </div>
            </div>
        </div>
    );
};

