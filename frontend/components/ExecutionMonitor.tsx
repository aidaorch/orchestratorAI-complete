import React, { useState } from 'react';
import { WorkflowResult, WorkflowStep } from '../types';
import { Play, Square, CheckCircle2, AlertCircle, Clock, Loader2, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import WorkflowVisualizer from './WorkflowVisualizer';

interface ExecutionMonitorProps {
    workflow: WorkflowResult;
    onUpdateWorkflow: (w: WorkflowResult) => void;
    onOpenTemplates: () => void;
}

interface StepLog {
    stepId: number;
    startTime?: string;
    endTime?: string;
    inputSnapshot?: string;
    outputSnapshot?: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    error?: string;
}

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-slate-100 text-slate-600', icon: <Clock className="w-3.5 h-3.5" /> },
    running: { label: 'Running', color: 'bg-blue-100 text-blue-700', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
    done: { label: 'Complete', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({ workflow, onUpdateWorkflow, onOpenTemplates }) => {
    const safeSteps: WorkflowStep[] = Array.isArray(workflow?.steps) ? workflow.steps : [];

    const [logs, setLogs] = useState<Record<number, StepLog>>(() => {
        const init: Record<number, StepLog> = {};
        safeSteps.forEach(s => { init[s.step_id] = { stepId: s.step_id, status: 'pending' }; });
        return init;
    });
    const [isRunning, setIsRunning] = useState(false);
    const [expandedStep, setExpandedStep] = useState<number | null>(null);
    const [waitingForManual, setWaitingForManual] = useState<number | null>(null);
    const manualInputRef = React.useRef<Set<number>>(new Set());

    const simulateStep = async (step: WorkflowStep): Promise<boolean> => {
        if (step.timing_logic === 'Manual') {
            setWaitingForManual(step.step_id);
            await new Promise<void>(resolve => {
                const interval = setInterval(() => {
                    if (manualInputRef.current?.has(step.step_id)) {
                        manualInputRef.current.delete(step.step_id);
                        clearInterval(interval);
                        resolve();
                    }
                }, 200);
            });
            setWaitingForManual(null);
        }

        setLogs(prev => ({
            ...prev,
            [step.step_id]: { ...prev[step.step_id], status: 'running', startTime: new Date().toISOString() }
        }));

        onUpdateWorkflow({
            ...workflow,
            steps: (workflow.steps || []).map(s =>
                s.step_id === step.step_id ? { ...s, execution_status: 'running' } : s
            )
        });

        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

        const failed = Math.random() < 0.05;
        const endStatus = failed ? 'failed' : 'done';

        setLogs(prev => ({
            ...prev,
            [step.step_id]: {
                ...prev[step.step_id],
                status: endStatus,
                endTime: new Date().toISOString(),
                inputSnapshot: `Input: ${step.input_config?.source ?? 'N/A'} (${step.input_config?.type ?? 'N/A'})`,
                outputSnapshot: failed ? '' : `Output written to: ${step.output_storage || 'N/A'}`,
                error: failed ? 'Simulated agent timeout error.' : undefined,
            }
        }));

        onUpdateWorkflow({
            ...workflow,
            steps: (workflow.steps || []).map(s =>
                s.step_id === step.step_id ? { ...s, execution_status: endStatus } : s
            )
        });

        return !failed;
    };

    const confirmManualStep = (stepId: number) => {
        manualInputRef.current.add(stepId);
    };

    const handleStart = async () => {
        setIsRunning(true);
        const reset: Record<number, StepLog> = {};
        safeSteps.forEach(s => { reset[s.step_id] = { stepId: s.step_id, status: 'pending' }; });
        setLogs(reset);

        for (let i = 0; i < safeSteps.length; i++) {
            const success = await simulateStep(safeSteps[i]);
            if (!success) break;
        }
        setIsRunning(false);
    };

    const completedCount = Object.values(logs).filter((l: StepLog) => l.status === 'done').length;
    const failedCount = Object.values(logs).filter((l: StepLog) => l.status === 'failed').length;
    const runningCount = Object.values(logs).filter((l: StepLog) => l.status === 'running').length;

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Execution Monitor</h2>
                    <p className="text-slate-500 mt-1 text-sm">Simulate and monitor workflow execution step-by-step.</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={onOpenTemplates}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline">Switch Workflow</span>
                        <span className="sm:hidden">Switch</span>
                    </button>
                    {!isRunning ? (
                        <button
                            onClick={handleStart}
                            disabled={safeSteps.length === 0}
                            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-200 transition-all disabled:opacity-50"
                        >
                            <Play className="w-4 h-4" />
                            Run Workflow
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsRunning(false)}
                            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                        >
                            <Square className="w-4 h-4" />
                            Stop
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Complete', count: completedCount, color: 'emerald' },
                    { label: 'Running', count: runningCount, color: 'blue' },
                    { label: 'Failed', count: failedCount, color: 'red' },
                ].map(stat => (
                    <div key={stat.label} className={`bg-${stat.color}-50 border border-${stat.color}-100 rounded-xl p-4 text-center`}>
                        <div className={`text-2xl font-bold text-${stat.color}-700`}>{stat.count}</div>
                        <div className={`text-xs text-${stat.color}-600 mt-0.5`}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progress</span>
                    <span>{completedCount}/{safeSteps.length} steps</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                        style={{ width: `${safeSteps.length > 0 ? (completedCount / safeSteps.length) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Visual Workflow Map */}
            {safeSteps.length > 0 && (
                <div className="mb-8 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
                    <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            Live Workflow Map
                        </span>
                        <span className="text-xs text-slate-400">Real-time step status</span>
                    </div>
                    <div className="h-[350px] overflow-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
                        <WorkflowVisualizer
                            data={workflow}
                            editMode={false}
                            connectorStyle="straight"
                        />
                    </div>
                </div>
            )}

            {/* Empty state */}
            {safeSteps.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl border border-slate-200 mb-6">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-600 font-medium">No steps in this workflow</p>
                    <p className="text-sm text-slate-400 mt-1">Load a workflow or generate one first.</p>
                </div>
            )}

            {/* Step Logs */}
            <div className="space-y-3">
                {safeSteps.map((step) => {
                    const log = logs[step.step_id] || { status: 'pending' as const };
                    const sc = statusConfig[log.status];
                    const isExpanded = expandedStep === step.step_id;
                    const needsManual = waitingForManual === step.step_id;

                    return (
                        <div key={step.step_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div
                                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => setExpandedStep(isExpanded ? null : step.step_id)}
                            >
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                                    {sc.icon}
                                    {sc.label}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <span className="font-semibold text-sm text-slate-800 truncate block">
                                        {step.action_description}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {step.agent_type} · {step.timing_logic}
                                    </span>
                                </div>
                                {isExpanded
                                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                    : <ChevronRight className="w-4 h-4 text-slate-400" />
                                }
                            </div>

                            {needsManual && (
                                <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm text-amber-700 font-medium">Awaiting manual trigger</span>
                                    </div>
                                    <button
                                        onClick={() => confirmManualStep(step.step_id)}
                                        className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                                    >
                                        Trigger Step
                                    </button>
                                </div>
                            )}

                            {isExpanded && (log.startTime || log.inputSnapshot) && (
                                <div className="px-5 py-4 border-t border-slate-100 space-y-3 bg-slate-50">
                                    {log.startTime && (
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <span className="text-slate-400 block">Start Time</span>
                                                <span className="text-slate-700 font-medium">{new Date(log.startTime).toLocaleTimeString()}</span>
                                            </div>
                                            {log.endTime && (
                                                <div>
                                                    <span className="text-slate-400 block">End Time</span>
                                                    <span className="text-slate-700 font-medium">{new Date(log.endTime).toLocaleTimeString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {log.inputSnapshot && (
                                        <div>
                                            <span className="text-xs text-slate-400 block mb-1">Input Snapshot</span>
                                            <code className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 block text-slate-600">{log.inputSnapshot}</code>
                                        </div>
                                    )}
                                    {log.outputSnapshot && (
                                        <div>
                                            <span className="text-xs text-slate-400 block mb-1">Output Snapshot</span>
                                            <code className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 block text-emerald-600">{log.outputSnapshot}</code>
                                        </div>
                                    )}
                                    {log.error && (
                                        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2">
                                            <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                                            <span className="text-xs text-red-600">{log.error}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
    </div>
    );
};

export default ExecutionMonitor;
