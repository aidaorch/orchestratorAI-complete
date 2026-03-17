import React, { useState, useCallback, useRef, useEffect } from 'react';
import { WorkflowResult, WorkflowStep } from '../types';
import { chatWithStep } from '../services/aiService';
import { getAgentById } from '../data/agentLibrary';
import {
  Zap, User, Repeat, Clock, Bot, MessageSquare, Send, Loader2, Sparkles,
  Edit2, Trash2, Plus, MessageCircle, Settings2, X, ChevronDown, ChevronUp,
  ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface WorkflowVisualizerProps {
  data: WorkflowResult;
  editMode?: boolean;
  onEditStep?: (step: WorkflowStep, insertAfter?: number) => void;
  onDeleteStep?: (stepId: number) => void;
  onAddStep?: (insertAfterStepId?: number) => void;
  onReorderSteps?: (steps: WorkflowStep[]) => void;
  connectorStyle?: 'bezier' | 'straight';
}
interface ChatMessage { role: 'user' | 'model'; content: string; }
interface NodeRect { x: number; y: number; w: number; h: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getTimingIcon = (timing: string) => {
  switch (timing.toLowerCase()) {
    case 'auto': return <Zap className="w-3 h-3 text-yellow-500" />;
    case 'manual': return <User className="w-3 h-3 text-blue-500" />;
    case 'recurring': return <Repeat className="w-3 h-3 text-aida-teal" />;
    case 'trigger': return <Clock className="w-3 h-3 text-orange-500" />;
    default: return <Clock className="w-3 h-3 text-slate-400" />;
  }
};

const AGENT_COLORS: Record<string, { badge: string; dot: string }> = {
  content: { badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  design: { badge: 'bg-pink-100 text-pink-700 border-pink-200', dot: 'bg-pink-500' },
  scheduler: { badge: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  analytics: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  heatmaps: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  bounce: { badge: 'bg-teal-100 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  'subject line checker': { badge: 'bg-cyan-100 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  scraper: { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  crm: { badge: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  outreach: { badge: 'bg-aida-light text-aida-dark border-aida-200', dot: 'bg-indigo-500' },
};
const getAC = (type: string) => AGENT_COLORS[type.toLowerCase()] || { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' };

const STATUS_RING: Record<string, string> = {
  pending: '',
  running: 'ring-2 ring-blue-400 ring-offset-1',
  done: 'ring-2 ring-emerald-400 ring-offset-1',
  failed: 'ring-2 ring-red-400 ring-offset-1',
};

// ─── Column Layout — Rank-based DAG layering ──────────────────────────────────
function buildColumns(steps: WorkflowStep[]): WorkflowStep[][] {
  if (steps.length === 0) return [];

  // 1. Calculate Ranks
  const ranks: Record<number, number> = {};
  const validIds = new Set(steps.map(s => s.step_id));
  steps.forEach(s => { ranks[s.step_id] = 0; });

  // Propagate ranks through dependencies — only follow valid step IDs
  for (let iter = 0; iter < steps.length + 1; iter++) {
    let changed = false;
    steps.forEach(s => {
      const deps = (s.depends_on || []).filter(d => validIds.has(d));
      if (deps.length > 0) {
        const maxDRank = Math.max(...deps.map(d => ranks[d] ?? 0));
        if (ranks[s.step_id] <= maxDRank) {
          ranks[s.step_id] = maxDRank + 1;
          changed = true;
        }
      }
    });
    if (!changed) break;
  }

  // 2. Synchronize Parallel Groups
  const groupRanks: Record<string, number> = {};
  steps.forEach(s => {
    if (s.parallel_group) {
      groupRanks[s.parallel_group] = Math.max(groupRanks[s.parallel_group] || 0, ranks[s.step_id]);
    }
  });
  steps.forEach(s => {
    if (s.parallel_group) {
      ranks[s.step_id] = groupRanks[s.parallel_group];
    }
  });

  // 3. Assemble into columns
  const colMap: Record<number, WorkflowStep[]> = {};
  steps.forEach(s => {
    const r = ranks[s.step_id];
    if (!colMap[r]) colMap[r] = [];
    colMap[r].push(s);
  });

  const sortedRanks = Object.keys(colMap).map(Number).sort((a, b) => a - b);
  return sortedRanks.map(r => colMap[r]);
}

// ─── Connector Path ───────────────────────────────────────────────────────────
// Orthogonal routing through the column gap.
// gapMidX = the X midpoint of the gap immediately after the source card.
// This is always fr.x + fr.w + COL_GAP/2, which is guaranteed to be in empty space.
function connPath(
  x1: number, y1: number,
  x2: number, y2: number,
  gapMidX: number,
  style: 'bezier' | 'straight'
): string {
  const dy = y2 - y1;

  if (Math.abs(dy) < 4) {
    // Same row — simple horizontal connection
    if (style === 'bezier') {
      const cx = (x1 + x2) / 2;
      return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    }
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  // Cross-row: strict orthogonal routing through the gap midpoint.
  // Route: exit right → go to gapMidX (in the gap) → travel vertically → enter left.
  // gapMidX is always inside the column gap, never inside a card.
  if (style === 'bezier') {
    // Smooth S-curve that pivots at the gap midpoint
    return `M ${x1} ${y1} C ${gapMidX} ${y1}, ${gapMidX} ${y2}, ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} L ${gapMidX} ${y1} L ${gapMidX} ${y2} L ${x2} ${y2}`;
}

// ─── Offset Traversal — 100% reliable canvas-relative position ───────────────
function getOffsetRelativeTo(el: HTMLElement, container: HTMLElement): { x: number; y: number } {
  let x = 0, y = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== container) {
    x += cur.offsetLeft;
    y += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

// ─── Step Card ────────────────────────────────────────────────────────────────
interface StepCardProps {
  step: WorkflowStep;
  stepNum: number;
  editMode: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddBefore?: () => void;
  onAddAfter?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragTarget?: boolean;
}

const StepCard = React.forwardRef<HTMLDivElement, StepCardProps>((
  { step, stepNum, editMode, onClick, onEdit, onDelete, onAddBefore, onAddAfter, onMoveLeft, onMoveRight, draggable, onDragStart, onDragOver, onDrop, isDragTarget }, ref
) => {
  const ac = getAC(step.agent_type);
  const statusRing = STATUS_RING[step.execution_status || 'pending'];

  return (
    <div
      ref={ref}
      data-step-id={step.step_id}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`bg-white rounded-2xl border ${isDragTarget ? 'border-aida-500 ring-2 ring-indigo-200' : 'border-slate-200'} shadow-sm hover:shadow-xl hover:border-aida-300 transition-all duration-300 cursor-pointer w-60 shrink-0 select-none group ${statusRing}`}
      style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.06), 0 1px 4px rgba(0,0,0,0.04)', position: 'relative', backgroundColor: '#ffffff' }}
    >
      {/* Step number badge */}
      <div className={`absolute -top-3 -left-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md z-10 ${ac.dot}`}>
        {stepNum}
      </div>

      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ac.badge}`}>
            <Bot className="w-3 h-3" />{step.agent_type}
          </span>
          <div className="flex items-center gap-1 text-slate-400">
            {getTimingIcon(step.timing_logic)}
            <span className="text-[10px] uppercase tracking-wide font-medium">{step.timing_logic}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-[13px] font-medium text-slate-700 leading-snug line-clamp-3">
          {step.action_description}
        </p>

        {/* Inline comment */}
        {step.inline_comment && (
          <div className="mt-2.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-xl px-2.5 py-1.5 border border-amber-100">
            <MessageCircle className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{step.inline_comment}</span>
          </div>
        )}

        {/* Agent chips */}
        {step.agent_ids && step.agent_ids.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {step.agent_ids.slice(0, 2).map(aid => {
              const ag = getAgentById(aid);
              return ag ? (
                <span key={aid} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-aida-light text-aida-dark rounded-full text-[10px] border border-aida-100">{ag.name}</span>
              ) : null;
            })}
            {step.agent_ids.length > 2 && <span className="text-[10px] text-slate-400">+{step.agent_ids.length - 2}</span>}
          </div>
        )}
      </div>

      {/* View Details Hint */}
      <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/50 rounded-b-2xl group-hover:bg-aida-light/50 transition-colors flex justify-between items-center text-[10px] font-semibold text-slate-400 group-hover:text-aida-teal">
        Click to view details &amp; chat
        <Sparkles className="w-3 h-3" />
      </div>

      {/* Edit toolbar overlays */}
      {editMode && (
        <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={e => e.stopPropagation()}>
          {onEdit && <button onClick={onEdit} className="p-1.5 bg-white shadow-md rounded-full text-aida-teal hover:bg-aida-light hover:text-aida-teal transition-colors border border-slate-200"><Edit2 className="w-3 h-3" /></button>}
          {onDelete && <button onClick={() => { if (confirm('Delete this step?')) onDelete!(); }} className="p-1.5 bg-white shadow-md rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors border border-slate-200"><Trash2 className="w-3 h-3" /></button>}
        </div>
      )}
      {editMode && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={e => e.stopPropagation()}>
          {onAddBefore && <button onClick={onAddBefore} className="px-2 py-1 text-[10px] bg-white shadow-md border border-slate-200 rounded-full font-semibold text-slate-500 hover:text-aida-teal transition-colors">+Before</button>}
          {onAddAfter && <button onClick={onAddAfter} className="px-2 py-1 text-[10px] bg-white shadow-md border border-slate-200 rounded-full font-semibold text-slate-500 hover:text-aida-teal transition-colors">+After</button>}
        </div>
      )}
      {editMode && (
        <div className="absolute top-1/2 -translate-y-1/2 -left-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={e => e.stopPropagation()}>
          {onMoveLeft && <button onClick={onMoveLeft} title="Move left" className="p-1 bg-white shadow-md rounded-full text-slate-400 hover:text-aida-teal transition-colors border border-slate-200"><ChevronDown className="w-3 h-3 rotate-90" /></button>}
        </div>
      )}
      {editMode && (
        <div className="absolute top-1/2 -translate-y-1/2 -right-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={e => e.stopPropagation()}>
          {onMoveRight && <button onClick={onMoveRight} title="Move right" className="p-1 bg-white shadow-md rounded-full text-slate-400 hover:text-aida-teal transition-colors border border-slate-200"><ChevronDown className="w-3 h-3 -rotate-90" /></button>}
        </div>
      )}
    </div>
  );
});
StepCard.displayName = 'StepCard';

// ─── Step Details Modal ───────────────────────────────────────────────────────
const StepDetailsModal = ({
  step, onClose, workflowName, chat, chatInput, onChatInputChange, onSendChat, onEdit, editMode
}: {
  step: WorkflowStep,
  onClose: () => void,
  workflowName: string,
  chat: { messages: ChatMessage[]; loading: boolean },
  chatInput: string,
  onChatInputChange: (val: string) => void,
  onSendChat: (s: WorkflowStep, m?: string) => void,
  onEdit?: (s: WorkflowStep) => void,
  editMode: boolean
}) => {
  const ac = getAC(step.agent_type);
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 transition-all">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-aida-dark/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Box */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-5xl h-[92vh] sm:max-h-[85vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-300">

        {/* Left: Step Details */}
        <div className="w-full md:w-1/2 bg-white flex flex-col border-b md:border-b-0 md:border-r border-slate-100 h-1/2 md:h-full">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ac.badge} bg-opacity-20`}>
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{step.agent_type}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                  Step {step.step_id} <span className="text-slate-300">•</span> {getTimingIcon(step.timing_logic)} <span className="uppercase tracking-wider text-[10px]">{step.timing_logic}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Description</h4>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">{step.action_description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-aida-light/50 border border-aida-100 p-4 rounded-2xl">
                <h4 className="text-[10px] font-bold text-aida-teal uppercase tracking-widest mb-1.5">Input</h4>
                <p className="text-xs text-slate-700 font-medium break-all">
                  {step.input_config.input_type === 'prior_output'
                    ? `From step(s): ${(step.input_config.prior_step_ids || []).join(', ') || 'N/A'}`
                    : step.input_config.input_type === 'script'
                      ? step.input_config.script_content?.slice(0, 100) + '...' || '(script)'
                      : step.input_config.prompt_text || step.input_config.source}
                </p>
              </div>
              <div className="bg-aida-light/50 border border-aida-mint p-4 rounded-2xl">
                <h4 className="text-[10px] font-bold text-aida-teal uppercase tracking-widest mb-1.5">Output</h4>
                <p className="text-xs text-slate-700 font-medium break-all truncate" title={step.output_storage}>
                  {step.output_storage || '(not set)'}
                </p>
              </div>
            </div>

            {step.inline_comment && (
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Inline Comment</h4>
                <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 rounded-2xl p-4 border border-amber-100">
                  <MessageCircle className="w-5 h-5 shrink-0 text-amber-500" />
                  <p>{step.inline_comment}</p>
                </div>
              </div>
            )}

            {editMode && onEdit && (
              <div className="pt-4 mt-auto">
                <button
                  onClick={() => { onClose(); onEdit(step); }}
                  className="w-full flex justify-center items-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-aida-teal hover:border-aida-200 transition-colors shadow-sm"
                >
                  <Edit2 className="w-4 h-4" /> Edit Step Configuration
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Chat */}
        <div className="w-full md:w-1/2 flex flex-col bg-slate-50/80 h-1/2 md:h-full relative">
          <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all">
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 border-b border-slate-200 flex items-center gap-2 bg-white/50 shrink-0">
            <Sparkles className="w-5 h-5 text-aida-teal" />
            <h3 className="font-bold text-slate-800">Ask AI</h3>
            <span className="text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">Assistant</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chat.messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                <MessageSquare className="w-12 h-12 text-slate-200 mb-3" />
                <p className="font-medium text-slate-600">How can AI help with this step?</p>
                <p className="text-xs mb-6 max-w-[200px]">You can ask me to generate a master prompt, debug scripts, or suggest tools.</p>
                <div className="flex flex-col w-full max-w-[240px] gap-2">
                  {['Generate a master prompt', 'Suggest tools for this agent', 'Check for potential errors'].map(q => (
                    <button key={q} onClick={() => onSendChat(step, q)} className="text-xs px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-aida-300 hover:text-aida-teal hover:shadow-md transition-all text-left font-medium">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chat.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-aida-teal text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}

            {chat.loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-aida-teal rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-aida-teal rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-aida-teal rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
            <form onSubmit={e => { e.preventDefault(); onSendChat(step); }} className="relative flex items-center">
              <input
                type="text"
                value={chatInput}
                onChange={e => onChatInputChange(e.target.value)}
                placeholder="Message AI..."
                className="w-full text-sm border-2 border-slate-100 bg-slate-50 rounded-2xl pl-5 pr-14 py-3.5 focus:border-aida-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400 font-medium"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chat.loading}
                className="absolute right-2 p-2 bg-aida-teal text-white rounded-xl disabled:opacity-40 disabled:bg-slate-400 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────
const COL_GAP = 80;
const ROW_GAP = 40;

// ─── Main Component ───────────────────────────────────────────────────────────
const WorkflowVisualizer: React.FC<WorkflowVisualizerProps> = ({
  data, editMode = false, onEditStep, onDeleteStep, onAddStep, onReorderSteps,
  connectorStyle,
}) => {
  // Guard: normalise data so downstream code never crashes on undefined
  const safeData: WorkflowResult = {
    workflow_metadata: data?.workflow_metadata ?? {
      workflow_name: 'Untitled Workflow',
      instance_id: `wf_${Date.now()}`,
      is_template: false,
      version: '1.0'
    },
    steps: Array.isArray(data?.steps) ? data.steps : []
  };

  // Stable reference for steps — prevents measureRects from firing on every render
  const stepsRef = useRef(safeData.steps);
  stepsRef.current = safeData.steps;

  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);

  const [chats, setChats] = useState<Record<number, { messages: ChatMessage[]; loading: boolean }>>({});
  const [chatInputs, setChatInputs] = useState<Record<number, string>>({});

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragTargetId, setDragTargetId] = useState<number | null>(null);

  // View options
  const [lineStyle, setLineStyle] = useState<'bezier' | 'straight'>(connectorStyle || 'straight');

  // Sync prop to state
  useEffect(() => {
    if (connectorStyle) setLineStyle(connectorStyle);
  }, [connectorStyle]);
  const [bgStyle, setBgStyle] = useState<'dots' | 'grid' | 'clean'>('dots');
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const zoomIn = () => setZoom(z => Math.min(z + 0.15, 2.5));
  const zoomOut = () => setZoom(z => Math.max(z - 0.15, 0.3));
  const zoomReset = () => setZoom(1);

  // Debug state to show when measurements are happening
  const [isMeasuring, setIsMeasuring] = useState(false);

  // Canvas + card refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [nodeRects, setNodeRects] = useState<Record<number, NodeRect>>({});

  // ── Close View dropdown on outside click ───────────────────────────────────
  useEffect(() => {
    if (!showOptions) return;
    const handler = (e: MouseEvent) => {
      if (!optionsRef.current?.contains(e.target as Node)) setShowOptions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOptions]);

  const sendChat = useCallback(async (step: WorkflowStep, customMsg?: string) => {
    const msg = customMsg || chatInputs[step.step_id] || '';
    if (!msg.trim()) return;
    const id = step.step_id;

    // Capture current history before the state update so we send the right context
    const currentHistory = chats[id]?.messages || [];

    setChats(prev => ({
      ...prev,
      [id]: { messages: [...(prev[id]?.messages || []), { role: 'user', content: msg }], loading: true }
    }));
    if (!customMsg) setChatInputs(prev => ({ ...prev, [id]: '' }));

    try {
      const resp = await chatWithStep(step, safeData.workflow_metadata.workflow_name, msg, currentHistory);
      setChats(prev => ({
        ...prev,
        [id]: { messages: [...(prev[id]?.messages || []), { role: 'model', content: resp }], loading: false }
      }));
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to get a response. Please try again.';
      setChats(prev => ({
        ...prev,
        [id]: {
          messages: [...(prev[id]?.messages || []), { role: 'model', content: `Error: ${errMsg}` }],
          loading: false
        }
      }));
    }
  }, [chatInputs, chats, safeData.workflow_metadata.workflow_name]);

  const remapStepIds = (steps: WorkflowStep[]) => {
    // 1. Create mapping from old ID to new ID
    const idMap = new Map<number, number>();
    steps.forEach((s, i) => idMap.set(s.step_id, i + 1));

    // 2. Apply new IDs and remap all dependencies, pruning any that no longer exist
    return steps.map((s, i) => {
      const newS = { ...s, step_id: i + 1 };
      if (newS.depends_on) {
        newS.depends_on = newS.depends_on
          .map(id => idMap.get(id))
          .filter((id): id is number => id !== undefined)
          .sort((a, b) => a - b);
      }
      if (newS.auto_depends_on) {
        newS.auto_depends_on = newS.auto_depends_on
          .map(id => idMap.get(id))
          .filter((id): id is number => id !== undefined)
          .sort((a, b) => a - b);
      }
      if (newS.input_config?.prior_step_ids) {
        newS.input_config = {
          ...newS.input_config,
          prior_step_ids: newS.input_config.prior_step_ids
            .map(id => idMap.get(id))
            .filter((id): id is number => id !== undefined)
            .sort((a, b) => a - b)
        };
      }
      return newS;
    });
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    if (!onReorderSteps) return;
    const steps = [...safeData.steps];
    const ti = index + dir;
    if (ti < 0 || ti >= steps.length) return;
    [steps[index], steps[ti]] = [steps[ti], steps[index]];
    onReorderSteps(remapStepIds(steps));
  };

  const handleDragStart = (e: React.DragEvent, stepId: number) => {
    if (!editMode || !onReorderSteps) {
      e.preventDefault();
      return;
    }
    setDraggedId(stepId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stepId: number) => {
    e.preventDefault(); // Necessary to allow dropping
    if (!editMode || draggedId === null || draggedId === stepId) return;
    e.dataTransfer.dropEffect = 'move';
    if (dragTargetId !== stepId) setDragTargetId(stepId);
  };

  const handleDrop = (e: React.DragEvent, targetStepId: number) => {
    e.preventDefault();
    setDragTargetId(null);
    if (!editMode || !onReorderSteps || draggedId === null || draggedId === targetStepId) {
      setDraggedId(null);
      return;
    }

    const steps = [...safeData.steps];
    const sourceIdx = steps.findIndex(s => s.step_id === draggedId);
    const targetIdx = steps.findIndex(s => s.step_id === targetStepId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const [movedStep] = steps.splice(sourceIdx, 1);
      steps.splice(targetIdx, 0, movedStep);
      onReorderSteps(remapStepIds(steps));
    }
    setDraggedId(null);
  };

  // ── Position measurement using offsetLeft/offsetTop traversal ─────────────
  // This avoids all getBoundingClientRect issues with CSS transforms and scroll offsets.
  // The canvas div is the CSS-scaled element; we traverse the DOM offset chain up to it
  // to get coordinates in the canvas's own (pre-scale) coordinate space.
  const measureRects = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsMeasuring(true);

    const rects: Record<number, NodeRect> = {};
    // Clean up stale refs — remove keys whose step no longer exists
    const activeIds = new Set(stepsRef.current.map(s => s.step_id));
    Object.keys(cardRefs.current).forEach(k => {
      if (!activeIds.has(Number(k))) delete cardRefs.current[Number(k)];
    });

    // CRITICAL FIX: Force layout reflow before measuring
    // This ensures flexbox has finished calculating positions
    void canvas.offsetHeight; // Force reflow

    let measuredCount = 0;
    let validMeasurements = 0;
    (Object.entries(cardRefs.current) as [string, HTMLDivElement | null][]).forEach(([idStr, el]) => {
      if (!el || !canvas.contains(el)) return;
      if (el.offsetWidth === 0 || el.offsetHeight === 0) return;
      const pos = getOffsetRelativeTo(el, canvas);
      rects[Number(idStr)] = { x: pos.x, y: pos.y, w: el.offsetWidth, h: el.offsetHeight };
      measuredCount++;
      validMeasurements++;
    });

    setNodeRects(rects);
    setTimeout(() => setIsMeasuring(false), 200);
  }, []);

  // Aggressive multi-pass measurement strategy to ensure arrows always render
  useEffect(() => {
    // Pass 1: Immediate (often too early, but try anyway)
    requestAnimationFrame(() => {
      measureRects();
    });
    
    // Pass 2: After first paint
    const t1 = setTimeout(() => {
      requestAnimationFrame(measureRects);
    }, 0);
    
    // Pass 3: After browser layout (100ms)
    const t2 = setTimeout(() => {
      requestAnimationFrame(measureRects);
    }, 100);
    
    // Pass 4: After fonts/images load (400ms)
    const t3 = setTimeout(() => {
      requestAnimationFrame(measureRects);
    }, 400);
    
    // Pass 5: Final safety net (800ms)
    const t4 = setTimeout(() => {
      requestAnimationFrame(measureRects);
    }, 800);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [safeData.steps, editMode, lineStyle, zoom, measureRects]);

  // Re-measure on window resize (layout reflow)
  useEffect(() => {
    window.addEventListener('resize', measureRects);
    return () => window.removeEventListener('resize', measureRects);
  }, [measureRects]);

  // MutationObserver: fires whenever DOM inside canvas changes (card mounts/unmounts/resizes)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mo = new MutationObserver(() => {
      // Use requestAnimationFrame to measure after browser paint
      requestAnimationFrame(() => {
        setTimeout(measureRects, 150);
      });
    });
    mo.observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    return () => mo.disconnect();
  }, [measureRects]);

  // ResizeObserver: fires when cards change size (most reliable for layout changes)
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      // Use requestAnimationFrame to measure after browser paint
      requestAnimationFrame(measureRects);
    });
    
    // Observe all card elements
    Object.values(cardRefs.current).forEach(el => {
      if (el) ro.observe(el);
    });
    
    return () => ro.disconnect();
  }, [safeData.steps, measureRects]);

  // Unique IDs per instance to avoid SVG defs clashing when multiple visualizers render
  const svgId = useRef(`wv-${Math.random().toString(36).slice(2, 8)}`).current;

  const columns = buildColumns(safeData.steps);

  // ── Build connector paths (memoized to avoid recalc on every render) ─────────
  const connectorPaths = React.useMemo(() => {
    const paths: { path: string; fr: NodeRect; tr: NodeRect; fromId: number; toId: number }[] = [];

    // CRITICAL: Don't try to build paths if we have no measurements yet
    const measuredCount = Object.keys(nodeRects).length;
    if (measuredCount === 0) return paths;

    safeData.steps.forEach((step, idx) => {
      let deps: number[];
      
      if (Array.isArray(step.depends_on) && step.depends_on.length > 0) {
        deps = step.depends_on;
      } else if (Array.isArray(step.depends_on) && step.depends_on.length === 0) {
        deps = idx === 0 ? [] : [safeData.steps[idx - 1].step_id];
      } else if (Array.isArray(step.auto_depends_on) && step.auto_depends_on.length > 0) {
        deps = step.auto_depends_on;
      } else {
        deps = idx > 0 ? [safeData.steps[idx - 1].step_id] : [];
      }

      deps.forEach(depId => {
        const fr = nodeRects[depId];
        const tr = nodeRects[step.step_id];
        if (fr && tr && fr.w > 0 && fr.h > 0 && tr.w > 0 && tr.h > 0) {
          // Source: right-center of 'from' card
          // Target: left-center of 'to' card
          const x1 = fr.x + fr.w;
          const y1 = fr.y + fr.h / 2;
          const x2 = tr.x;
          const y2 = tr.y + tr.h / 2;
          // gapMidX: midpoint of the 80px gap immediately after the source card.
          // This is ALWAYS in empty space between columns, never inside any card.
          const gapMidX = fr.x + fr.w + COL_GAP / 2;
          paths.push({
            path: connPath(x1, y1, x2, y2, gapMidX, lineStyle),
            fr, tr, fromId: depId, toId: step.step_id,
          });
        }
      });
    });

    return paths;
  }, [nodeRects, safeData.steps, lineStyle]);

  const rectValues = Object.values(nodeRects) as NodeRect[];
  const svgW = rectValues.length > 0 ? Math.max(...rectValues.map(r => r.x + r.w + 60), 600) : 600;
  const svgH = rectValues.length > 0 ? Math.max(...rectValues.map(r => r.y + r.h + 60), 300) : 300;

  // ── Background styles ─────────────────────────────────────────────────────
  const bgCss: React.CSSProperties =
    bgStyle === 'dots'
      ? { background: 'radial-gradient(circle, #c7d2fe 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundColor: '#f8fafc' }
      : bgStyle === 'grid'
        ? { background: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundColor: '#f8fafc' }
        : { backgroundColor: '#f1f5f9' };

  const selectedStep = selectedStepId ? safeData.steps.find(s => s.step_id === selectedStepId) : null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative bg-slate-900">

      {/* Container that scales back into 3D when modal opens */}
      <div
        className={`w-full h-full flex flex-col overflow-hidden transition-all duration-500 transform-gpu bg-white ${selectedStepId ? 'scale-[0.97] blur-[2px] opacity-70 rounded-2xl pointer-events-none' : 'scale-100 blur-0 opacity-100'}`}
      >
        {/* ── Floating Toolbar ─────────────────────────────────────────────── */}
        <div className="absolute top-4 right-6 z-30 flex items-center justify-end gap-3 pointer-events-none">

          {/* View Options */}
          <div className="relative pointer-events-auto" ref={optionsRef}>
            <button
              onClick={() => setShowOptions(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors shadow-sm ${showOptions ? 'bg-aida-light border-aida-200 text-aida-dark' : 'bg-white/90 backdrop-blur border-slate-200 text-slate-600 hover:bg-white'}`}
            >
              <Settings2 className="w-4 h-4" /> View
            </button>

            {showOptions && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 shadow-2xl rounded-xl p-4 z-[100]">
                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Connections</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLineStyle('bezier')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${lineStyle === 'bezier' ? 'bg-aida-teal border-aida-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-aida-300 hover:text-aida-teal'}`}
                    >∿ Curved</button>
                    <button
                      onClick={() => setLineStyle('straight')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${lineStyle === 'straight' ? 'bg-aida-teal border-aida-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-aida-300 hover:text-aida-teal'}`}
                    >— Straight</button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Background</label>
                  <div className="flex gap-2">
                    {([
                      { key: 'dots', label: 'Dots', css: { background: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '6px 6px', backgroundColor: '#f8fafc' } },
                      { key: 'grid', label: 'Grid', css: { background: 'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)', backgroundSize: '8px 8px', backgroundColor: '#f8fafc' } },
                      { key: 'clean', label: 'Clean', css: { backgroundColor: '#f1f5f9' } },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setBgStyle(opt.key)}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border transition-all ${bgStyle === opt.key ? 'border-aida-400 bg-aida-light shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                      >
                        <div className="w-10 h-8 rounded-md border border-slate-200" style={opt.css} />
                        <span className={`text-[10px] font-semibold ${bgStyle === opt.key ? 'text-aida-teal' : 'text-slate-500'}`}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {editMode && onAddStep && (
            <button
              onClick={() => onAddStep((safeData.steps && safeData.steps.length > 0) ? safeData.steps[safeData.steps.length - 1].step_id : undefined)}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-aida-teal text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Step
            </button>
          )}

          {/* Zoom Controls */}
          <div className="pointer-events-auto flex items-center gap-1 bg-white/90 backdrop-blur border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
            <button onClick={zoomOut} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <button onClick={zoomReset} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Reset Zoom">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Canvas ────────────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-auto transition-colors duration-500"
          style={bgCss}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              if (e.deltaY < 0) zoomIn();
              else zoomOut();
            }
          }}
        >
          {(!safeData.steps || safeData.steps.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="w-24 h-24 bg-aida-light rounded-3xl flex items-center justify-center mb-4">
                <Zap className="w-10 h-10 text-aida-mint" />
              </div>
              <p className="font-medium text-slate-600">No steps yet</p>
              <p className="text-sm mt-1">Click "Add Step" to start building your workflow</p>
            </div>
          ) : (
            <div className="relative p-12 min-w-max min-h-full" ref={canvasRef} style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 0.15s ease-out' }}>

              {/* SVG layer — behind cards (z-index 0). Lines are drawn only in the
                  gap between cards. The card white background naturally covers any
                  line that would pass through a card. */}
              <svg
                className="absolute top-0 left-0 pointer-events-none"
                width={Math.max(svgW, 2000)}
                height={Math.max(svgH, 1000)}
                style={{ overflow: 'visible', zIndex: 0, position: 'absolute' }}
              >
                <defs>
                  <filter id={`glow-${svgId}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  {/* One shared arrowhead marker — solid color works reliably */}
                  <marker
                    id={`arr-${svgId}`}
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                  </marker>
                </defs>

                {/* Subtle glow layer */}
                {connectorPaths.map(({ path, fromId, toId }) => (
                  <path key={`g-${fromId}-${toId}`} d={path} fill="none" stroke="#818cf8" strokeWidth={6} strokeLinecap="round" opacity={0.12} filter={`url(#glow-${svgId})`} />
                ))}
                {/* Main connector lines — solid color so markerEnd always renders */}
                {connectorPaths.map(({ path, fromId, toId }) => (
                  <path
                    key={`c-${fromId}-${toId}`}
                    d={path}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={`url(#arr-${svgId})`}
                  />
                ))}
                {/* Exit port dots */}
                {connectorPaths.map(({ fr, fromId, toId }) => (
                  <circle key={`dot-${fromId}-${toId}`} cx={fr.x + fr.w} cy={fr.y + fr.h / 2} r={3.5} fill="#6366f1" opacity={0.9} />
                ))}
              </svg>

              {/* Cards — rendered after SVG so they sit on top (z-index 1).
                  White card backgrounds naturally mask any line passing through. */}
              <div className="relative flex items-center" style={{ gap: COL_GAP, zIndex: 1 }}>
                {columns.map((colSteps, colIdx) => {
                  const isFirst = colIdx === 0;
                  return (
                    <div key={colIdx} className="flex flex-col" style={{ gap: ROW_GAP }}>
                      {colSteps.length > 1 && (
                        <div className="text-center">
                          <span className="inline-block text-[10px] font-bold tracking-wider text-aida-teal bg-aida-light border border-aida-mint rounded-lg px-3 py-1 shadow-sm uppercase">Parallel</span>
                        </div>
                      )}
                      {colSteps.map(step => {
                        const globalIdx = safeData.steps.findIndex(s => s.step_id === step.step_id);
                        return (
                          <div key={step.step_id} className="relative">
                            <StepCard
                              ref={el => { cardRefs.current[step.step_id] = el; }}
                              step={step}
                              stepNum={step.step_id}
                              editMode={editMode}
                              onClick={() => setSelectedStepId(step.step_id)}
                              onEdit={onEditStep ? () => onEditStep(step) : undefined}
                              onDelete={onDeleteStep ? () => onDeleteStep(step.step_id) : undefined}
                              onAddBefore={onAddStep && !isFirst ? () => onAddStep(safeData.steps[globalIdx > 0 ? globalIdx - 1 : 0].step_id) : undefined}
                              onAddAfter={onAddStep ? () => onAddStep(step.step_id) : undefined}
                              onMoveLeft={onReorderSteps && globalIdx > 0 ? () => moveStep(globalIdx, -1) : undefined}
                              onMoveRight={onReorderSteps && globalIdx < (safeData.steps?.length || 0) - 1 ? () => moveStep(globalIdx, 1) : undefined}
                              draggable={editMode && !!onReorderSteps}
                              onDragStart={(e) => handleDragStart(e, step.step_id)}
                              onDragOver={(e) => handleDragOver(e, step.step_id)}
                              onDrop={(e) => handleDrop(e, step.step_id)}
                              isDragTarget={dragTargetId === step.step_id}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Overlay */}
      {selectedStep && (
        <StepDetailsModal
          step={selectedStep}
          onClose={() => setSelectedStepId(null)}
          workflowName={safeData.workflow_metadata.workflow_name}
          chat={chats[selectedStep.step_id] || { messages: [], loading: false }}
          chatInput={chatInputs[selectedStep.step_id] || ''}
          onChatInputChange={val => setChatInputs(prev => ({ ...prev, [selectedStep.step_id]: val }))}
          onSendChat={sendChat}
          onEdit={onEditStep}
          editMode={editMode}
        />
      )}
    </div>
  );
};

export default WorkflowVisualizer;

