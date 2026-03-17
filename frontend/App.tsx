import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateWorkflow } from './services/aiService';
import { WorkflowResult, LLMProvider, WorkflowStep } from './types';
import WorkflowVisualizer from './components/WorkflowVisualizer';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { StepEditor } from './components/StepEditor';
import { TemplateLibrary } from './components/TemplateLibrary';
import LoginScreen from './components/LoginScreen';
import AgentLibraryPage from './components/AgentLibraryPage';
import LearningDashboard from './components/LearningDashboard';
import ExecutionMonitor from './components/ExecutionMonitor';
import ProfilePage from './components/ProfilePage';
import AdminPage from './components/AdminPage';
import { saveTemplate } from './services/templateService';
import { savePrompt, saveWorkflowToHistory } from './services/dbService';
import { recordWorkflowFeedback } from './services/aiService';
import {
  Sparkles, Play, Loader2, AlertCircle, Check, Edit3, Save,
  FileText, X, BarChart2, Bot, Brain, PlusSquare, Undo2, Redo2,
  MessageSquare, ChevronRight, History, Zap, UserCircle, Shield
} from 'lucide-react';

// ---- Sidebar nav items ----
type NavItem = 'prompt' | 'workflow' | 'analytics' | 'templates' | 'agents' | 'learning' | 'execution' | 'profile' | 'admin';
const NAV: { id: NavItem; label: string; icon: React.ReactNode }[] = [
  { id: 'prompt', label: 'Prompt', icon: <MessageSquare className="w-5 h-5" /> },
  { id: 'workflow', label: 'Workflow', icon: <Zap className="w-5 h-5" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-5 h-5" /> },
  { id: 'templates', label: 'Templates', icon: <FileText className="w-5 h-5" /> },
  { id: 'agents', label: 'Agent Library', icon: <Bot className="w-5 h-5" /> },
  { id: 'learning', label: 'Learning', icon: <Brain className="w-5 h-5" /> },
  { id: 'execution', label: 'Execution', icon: <Play className="w-5 h-5" /> },
];

// ---- Undo/Redo history ----
interface HistoryEntry { steps: WorkflowStep[] }

const App: React.FC = () => {
  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('access_token'));
  const [isAdmin, setIsAdmin] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').is_admin === true; } catch { return false; }
  });

  // Listen for forced logout from apiClient (expired/invalid token)
  useEffect(() => {
    const handleAuthLogout = () => setIsLoggedIn(false);
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);  // Navigation
  const [activeNav, setActiveNav] = useState<NavItem>('prompt');
  // Prompt
  const [prompt, setPrompt] = useState('');
  const [provider] = useState<LLMProvider>('openai');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Workflow
  const [workflow, setWorkflow] = useState<WorkflowResult | null>(null);
  const [editMode, setEditMode] = useState(false);
  // Undo/Redo
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  // Step editor
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [isNewStep, setIsNewStep] = useState(false);
  const [insertAfterStepId, setInsertAfterStepId] = useState<number | undefined>();
  // Template library (modal)
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  // Save as template UX
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);
  // Copy JSON
  const [copied, setCopied] = useState(false);

  // ---- Undo/Redo helpers ----
  // Use a ref to always have the latest historyIdx inside callbacks without stale closure
  const historyIdxRef = useRef(historyIdx);
  useEffect(() => { historyIdxRef.current = historyIdx; }, [historyIdx]);

  const pushHistory = useCallback((steps: WorkflowStep[]) => {
    const idx = historyIdxRef.current;
    setHistory(prev => {
      const trimmed = prev.slice(0, idx + 1);
      return [...trimmed, { steps }].slice(-50);
    });
    setHistoryIdx(prev => Math.min(prev + 1, 49));
  }, []);

  const undo = () => {
    if (!workflow || historyIdx <= 0) return;
    const entry = history[historyIdx - 1];
    setHistoryIdx(i => i - 1);
    setWorkflow(w => w ? { ...w, steps: entry.steps } : w);
  };

  const redo = () => {
    if (!workflow || historyIdx >= history.length - 1) return;
    const entry = history[historyIdx + 1];
    setHistoryIdx(i => i + 1);
    setWorkflow(w => w ? { ...w, steps: entry.steps } : w);
  };

  // ---- Workflow update with dependency-aware re-indexing ----
  const updateSteps = (steps: WorkflowStep[]) => {
    if (!workflow) return;

    // 1. Create a map from old IDs to new sequential IDs based on current array position
    const idMap = new Map<number, number>();
    steps.forEach((s, i) => idMap.set(s.step_id, i + 1));

    // 2. Build the re-indexed steps with remapped connections
    const reindexed = steps.map((s, i) => {
      const newId = i + 1;
      // Prune dependencies that no longer exist in the new steps array
      const remap = (id: number) => idMap.get(id);

      return {
        ...s,
        step_id: newId,
        depends_on: (s.depends_on || [])
          .map(remap)
          .filter((id): id is number => id !== undefined)
          .sort((a, b) => a - b),
        auto_depends_on: (s.auto_depends_on || [])
          .map(remap)
          .filter((id): id is number => id !== undefined)
          .sort((a, b) => a - b),
        input_config: {
          ...s.input_config,
          prior_step_ids: (s.input_config?.prior_step_ids || [])
            .map(remap)
            .filter((id): id is number => id !== undefined)
            .sort((a, b) => a - b)
        }
      };
    });

    pushHistory(workflow.steps);
    setWorkflow({ ...workflow, steps: reindexed });
  };

  // ---- Generate workflow ----
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (prompt.trim().length < 20) {
      setError('Please describe your use case in at least 20 characters.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      savePrompt(prompt);
      // generateWorkflow is async (useCase, provider) directly
      const result = await generateWorkflow(prompt, provider);
      setWorkflow(result);
      saveWorkflowToHistory(prompt, result);
      setHistory([{ steps: result.steps }]);
      setHistoryIdx(0);
      setEditMode(false);
      setActiveNav('workflow');
    } catch (err: any) {
      setError(err.message || 'Failed to generate workflow.');
    } finally {
      setIsLoading(false);
    }
  };

  // ---- New workflow ----
  const handleNewWorkflow = () => {
    const empty: WorkflowResult = {
      workflow_metadata: {
        workflow_name: 'New Workflow',
        instance_id: `wf_${Date.now()}`,
        is_template: false,
        version: '1.0'
      },
      steps: []
    };
    setWorkflow(empty);
    setHistory([{ steps: [] }]);
    setHistoryIdx(0);
    setEditMode(true);
    setActiveNav('workflow');
    setPrompt('');
  };

  // ---- Step editing ----
  const openEditStep = (step: WorkflowStep, insertAfter?: number) => {
    setEditingStep(step);
    setIsNewStep(false);
    setInsertAfterStepId(insertAfter);
  };

  const handleAddStep = (insertAfterStepId?: number) => {
    if (!workflow) return;
    const maxId = Math.max(0, ...workflow.steps.map(s => s.step_id));

    // Use a provisional high ID that will be re-indexed after insertion
    const provisionalId = maxId + 100;

    // Pre-compute what the depends_on should be
    let initialDepends: number[] = [];
    if (insertAfterStepId !== undefined) {
      initialDepends = [insertAfterStepId];
    } else if (maxId > 0) {
      initialDepends = [maxId];
    }

    const newStep: WorkflowStep = {
      step_id: provisionalId,
      agent_type: 'Content',
      agent_ids: [],
      action_description: '',
      timing_logic: 'Manual',
      depends_on: initialDepends,
      input_config: { source: 'PM_Input', type: 'Raw_Text', input_type: 'prompt', prompt_text: '' },
      output_storage: '',
      inline_comment: '',
    };
    setEditingStep(newStep);
    setIsNewStep(true);
    setInsertAfterStepId(insertAfterStepId);
  };

  const handleSaveStep = (saved: WorkflowStep) => {
    if (!workflow) return;
    let newSteps: WorkflowStep[];
    if (isNewStep) {
      if (insertAfterStepId !== undefined) {
        // Find where to insert based on insertAfterStepId
        const idx = workflow.steps.findIndex(s => s.step_id === insertAfterStepId);
        newSteps = [...workflow.steps];
        newSteps.splice(idx + 1, 0, saved);
      } else {
        newSteps = [...workflow.steps, saved];
      }
    } else {
      newSteps = workflow.steps.map(s => s.step_id === saved.step_id ? saved : s);
    }
    // updateSteps handles all re-indexing and dependency remapping
    updateSteps(newSteps);
    setEditingStep(null);
  };

  const handleDeleteStep = (stepId: number) => {
    if (!workflow) return;
    updateSteps(workflow.steps.filter(s => s.step_id !== stepId));
  };

  // ---- Load template ----
  const handleLoadTemplate = (wf: WorkflowResult) => {
    setWorkflow(wf);
    setHistory([{ steps: wf.steps }]);
    setHistoryIdx(0);
    setEditMode(false);
    setActiveNav('workflow');
    setShowTemplateModal(false);
  };

  // ---- Save as template ----
  const handleSaveTemplate = async () => {
    if (!workflow || !templateName.trim()) return;
    try {
      // Embed the current prompt into workflow_data so it's stored with the template
      const workflowWithPrompt = {
        ...workflow,
        original_prompt: prompt.trim() || undefined,
      };
      await saveTemplate(workflowWithPrompt, templateName, templateDesc);
      if (prompt.trim()) {
        recordWorkflowFeedback(prompt, workflow, workflow).catch(console.error);
      }
      setTemplateSaved(true);
      setTimeout(() => {
        setTemplateSaved(false);
        setShowSaveTemplate(false);
        setTemplateName('');
        setTemplateDesc('');
      }, 1500);
    } catch (error) {
      console.error('Error saving template:', error);
      setError('Failed to save template');
    }
  };

  // ---- Copy JSON ----
  const handleCopy = () => {
    if (!workflow) return;
    navigator.clipboard.writeText(JSON.stringify(workflow, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Mobile nav open state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ---- Render ----
  if (!isLoggedIn) return <LoginScreen onLogin={() => {
    setIsLoggedIn(true);
    try { setIsAdmin(JSON.parse(localStorage.getItem('user') || '{}').is_admin === true); } catch { setIsAdmin(false); }
  }} />;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ---- Mobile nav overlay ---- */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ---- Sidebar ---- */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-40
        w-56 shrink-0 bg-gradient-to-b from-aida-dark via-[#005560] to-aida-dark text-white flex flex-col shadow-xl
        transition-transform duration-300
        ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <img src="/aida-logo-white.png" alt="Aida" className="h-8 w-auto object-contain" />
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveNav(item.id);
                setMobileNavOpen(false);
                if (item.id === 'templates' && !workflow) setShowTemplateModal(true);
              }}
              disabled={item.id !== 'prompt' && item.id !== 'templates' && item.id !== 'agents' && item.id !== 'learning' && !workflow}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                ${activeNav === item.id
                  ? 'bg-white/15 text-white shadow-inner'
                  : 'text-aida-mint/80 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
            >
              <span className={`shrink-0 ${activeNav === item.id ? 'text-aida-mint' : 'text-aida-mint/60 group-hover:text-aida-mint'}`}>
                {item.icon}
              </span>
              {item.label}
              {activeNav === item.id && <ChevronRight className="w-3.5 h-3.5 ml-auto text-aida-mint" />}
            </button>
          ))}
        </nav>

        {/* New Workflow & Logout at bottom */}
        <div className="px-3 pb-4 space-y-2 border-t border-white/10 pt-3">
          <button
            onClick={() => { handleNewWorkflow(); setMobileNavOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-aida-mint/80 hover:bg-white/10 hover:text-white transition-all"
          >
            <PlusSquare className="w-5 h-5 text-aida-mint/60" />
            New Workflow
          </button>
          {/* Profile button */}
          <button
            onClick={() => { setActiveNav('profile'); setMobileNavOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeNav === 'profile' ? 'bg-white/15 text-white' : 'text-aida-mint/80 hover:bg-white/10 hover:text-white'}`}
          >
            <UserCircle className="w-5 h-5 text-aida-mint/60" />
            Profile
          </button>
          {/* Admin button — only visible to admins */}
          {isAdmin && (
            <button
              onClick={() => { setActiveNav('admin'); setMobileNavOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeNav === 'admin' ? 'bg-aida-red/20 text-red-200' : 'text-red-400 hover:bg-aida-red/10 hover:text-red-300'}`}
            >
              <Shield className="w-5 h-5 text-red-400" />
              Admin Panel
            </button>
          )}
          <button
            onClick={() => {
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              localStorage.removeItem('user');
              setIsLoggedIn(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-aida-mint/60 hover:bg-aida-red/20 hover:text-red-300 transition-all"
          >
            <X className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ---- Main Content ---- */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* ---- Top bar ---- */}
        <header className="shrink-0 bg-white border-b border-slate-200 px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileNavOpen(o => !o)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
            aria-label="Open navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1 min-w-0" />

          {/* Toolbar for workflow view */}
          {workflow && activeNav === 'workflow' && (
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Undo/Redo */}
              <button
                onClick={undo} disabled={historyIdx <= 0}
                title="Undo"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 transition-colors"
              ><Undo2 className="w-4 h-4" /></button>
              <button
                onClick={redo} disabled={historyIdx >= history.length - 1}
                title="Redo"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 transition-colors"
              ><Redo2 className="w-4 h-4" /></button>

              <div className="w-px h-5 bg-slate-200 hidden sm:block" />

              {/* Edit mode toggle */}
              <button
                onClick={() => setEditMode(e => !e)}
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${editMode ? 'bg-aida-light text-aida-dark' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">{editMode ? 'Editing' : 'Edit'}</span>
              </button>

              {/* Copy JSON — hidden on small screens */}
              <button
                onClick={handleCopy}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-medium transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <History className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>

              {/* Save as Template */}
              <button
                onClick={() => setShowSaveTemplate(s => !s)}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-sm font-medium transition-all"
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Save Template</span>
              </button>

              {/* Template Library — hidden on small screens */}
              <button
                onClick={() => setShowTemplateModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-medium transition-all"
              >
                <FileText className="w-4 h-4" />
                Templates
              </button>
            </div>
          )}
        </header>

        {/* ---- Save Template inline panel ---- */}
        {showSaveTemplate && workflow && (
          <div className="shrink-0 bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Save className="w-4 h-4 text-emerald-600 shrink-0" />
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Template name*"
                className="px-3 py-1.5 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 flex-1 sm:w-48"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={templateDesc}
                onChange={e => setTemplateDesc(e.target.value)}
                placeholder="Description (optional)"
                className="flex-1 px-3 py-1.5 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || templateSaved}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0"
              >
                {templateSaved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save'}
              </button>
              <button onClick={() => setShowSaveTemplate(false)} className="p-1 text-slate-400 hover:text-slate-700 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---- Scrollable page content ---- */}
        <div className={`flex-1 ${activeNav === 'workflow' ? 'overflow-hidden' : 'overflow-auto'}`}>

          {/* ===== PROMPT page ===== */}
          {activeNav === 'prompt' && (
            <div className="h-full flex flex-col">
              {/* Prompt input area */}
              <div className="shrink-0 p-4 sm:p-6 bg-white border-b border-slate-200">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4">Describe your business use case</h2>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={4}
                  disabled={isLoading}
                  placeholder="e.g. Generate and distribute a weekly content marketing campaign — research trending topics, create blog posts, design social graphics, schedule posts, and track engagement analytics..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl resize-none text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleGenerate(); }}
                />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                  <div className="hidden sm:block" />
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      onClick={handleNewWorkflow}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-aida-teal text-aida-teal rounded-xl font-medium hover:bg-aida-light transition-all text-sm"
                    >
                      <PlusSquare className="w-4 h-4" />
                      New Blank Workflow
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={!prompt.trim() || isLoading}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-aida-teal to-aida-dark text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-aida-teal/30 transition-all disabled:opacity-60 text-sm"
                    >
                      {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Workflow</>}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                  </div>
                )}
              </div>

              {/* Templates visible on home page (#9) */}
              <div className="flex-1 overflow-auto p-6">
                <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Saved Templates
                  <span className="text-xs font-normal text-slate-400">(click to load)</span>
                </h3>
                <TemplateLibrary
                  isOpen={true}
                  onClose={() => { }}
                  onLoadTemplate={handleLoadTemplate}
                  inline={true}
                />
              </div>
            </div>
          )}

          {/* ===== WORKFLOW page ===== */}
          {activeNav === 'workflow' && (
            <div className="h-full">
              {workflow ? (
                <WorkflowVisualizer
                  data={workflow}
                  editMode={editMode}
                  onEditStep={openEditStep}
                  onDeleteStep={handleDeleteStep}
                  onAddStep={handleAddStep}
                  onReorderSteps={newSteps => updateSteps(newSteps)}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Zap className="w-16 h-16 mb-4 opacity-20" />
                  <p className="font-medium text-slate-600">No workflow yet</p>
                  <p className="text-sm mt-1">Generate one from the Prompt tab, or create a blank workflow.</p>
                  <button
                    onClick={handleNewWorkflow}
                    className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-aida-teal text-white rounded-xl font-medium hover:shadow-lg transition-all text-sm"
                  >
                    <PlusSquare className="w-4 h-4" /> New Blank Workflow
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===== ANALYTICS page ===== */}
          {activeNav === 'analytics' && workflow && (
            <AnalyticsDashboard data={workflow} />
          )}

          {/* ===== TEMPLATES page ===== */}
          {activeNav === 'templates' && (
            <TemplateLibrary isOpen={true} onClose={() => setActiveNav('prompt')} onLoadTemplate={handleLoadTemplate} page={true} />
          )}

          {/* ===== AGENT LIBRARY page ===== */}
          {activeNav === 'agents' && <AgentLibraryPage />}

          {/* ===== LEARNING page ===== */}
          {activeNav === 'learning' && <LearningDashboard />}

          {/* ===== EXECUTION page ===== */}
          {activeNav === 'execution' && workflow && (
            <ExecutionMonitor
              workflow={workflow}
              onUpdateWorkflow={setWorkflow}
              onOpenTemplates={() => setShowTemplateModal(true)}
            />
          )}

          {/* ===== PROFILE page ===== */}
          {activeNav === 'profile' && (
            <ProfilePage
              onLogout={() => {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user');
                setIsLoggedIn(false);
              }}
            />
          )}

          {/* ===== ADMIN page ===== */}
          {activeNav === 'admin' && isAdmin && <AdminPage />}
        </div>
      </main>

      {/* ---- Template Library Modal ---- */}
      {showTemplateModal && (
        <TemplateLibrary
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onLoadTemplate={handleLoadTemplate}
          inline={false}
        />
      )}

      {/* ---- Step Editor Modal ---- */}
      {editingStep && (
        <StepEditor
          step={editingStep}
          isOpen={!!editingStep}
          onClose={() => setEditingStep(null)}
          onSave={handleSaveStep}
          isNewStep={isNewStep}
          insertAfterStepId={insertAfterStepId}
          allSteps={workflow?.steps || []}
        />
      )}
    </div>
  );
};

export default App;