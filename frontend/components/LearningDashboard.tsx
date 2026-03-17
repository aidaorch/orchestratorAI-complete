import React, { useState, useEffect } from 'react';
import { getLearnedPreferences } from '../services/dbService';
import { getWorkflowHistory } from '../services/dbService';
import { WorkflowHistory } from '../types';
import { Brain, TrendingUp, Zap, CheckCircle2, BarChart2, Clock } from 'lucide-react';

const LearningDashboard: React.FC = () => {
    const prefs = getLearnedPreferences();
    const [history, setHistory] = useState<WorkflowHistory[]>([]);

    useEffect(() => {
        getWorkflowHistory().then(setHistory);
    }, []);

    // Aggregate stats
    const agentTotals: Record<string, number> = {};
    const timingTotals: Record<string, number> = {};
    const inputTotals: Record<string, number> = {};

    prefs.forEach(p => {
        Object.entries(p.agentTypeChanges).forEach(([k, v]) => { agentTotals[k] = (agentTotals[k] || 0) + v; });
        Object.entries(p.timingPreferences).forEach(([k, v]) => { timingTotals[k] = (timingTotals[k] || 0) + v; });
        Object.entries(p.inputTypePreferences).forEach(([k, v]) => { inputTotals[k] = (inputTotals[k] || 0) + v; });
    });

    const topAgents = Object.entries(agentTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topTimings = Object.entries(timingTotals).sort((a, b) => b[1] - a[1]);
    const topInputs = Object.entries(inputTotals).sort((a, b) => b[1] - a[1]);

    const totalEdits = prefs.reduce((sum, p) => {
        return sum + Object.values(p.agentTypeChanges).reduce((s, v) => s + v, 0);
    }, 0);

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Learning Dashboard</h2>
                <p className="text-slate-500 mt-1 text-sm">The system learns from your edits and adapts future workflow generations to your preferences. (SRS FR-LM-06)</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[
                    { icon: <BarChart2 className="w-5 h-5 text-aida-teal" />, label: 'Workflows Generated', value: history.length, color: 'bg-aida-light border-aida-mint' },
                    { icon: <TrendingUp className="w-5 h-5 text-aida-teal" />, label: 'Edit Sessions Captured', value: prefs.length, color: 'bg-aida-light border-aida-mint' },
                    { icon: <Zap className="w-5 h-5 text-amber-600" />, label: 'Total Preferences Learned', value: totalEdits, color: 'bg-amber-50 border-amber-100' },
                ].map(card => (
                    <div key={card.label} className={`${card.color} border rounded-xl p-5 flex items-center gap-4`}>
                        <div className="p-2 bg-white rounded-lg shadow-sm border border-white/80">{card.icon}</div>
                        <div>
                            <div className="text-2xl font-bold text-slate-800">{card.value}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{card.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {prefs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                    <Brain className="w-14 h-14 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-600 font-medium">No learning data captured yet</p>
                    <p className="text-sm text-slate-400 mt-1">Generate a workflow, make edits, and save as template to start the learning loop.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Top Agent Types */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Brain className="w-4 h-4 text-aida-teal" />
                            <h3 className="font-semibold text-slate-700 text-sm">Top Agent Preferences</h3>
                        </div>
                        {topAgents.length === 0 ? <p className="text-xs text-slate-400">No data yet</p> : (
                            <div className="space-y-3">
                                {topAgents.map(([agent, count]) => (
                                    <div key={agent}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium text-slate-700">{agent}</span>
                                            <span className="text-slate-400">{count}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-aida-teal to-aida-dark rounded-full"
                                                style={{ width: `${(count / topAgents[0][1]) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Timing Preferences */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-4 h-4 text-aida-teal" />
                            <h3 className="font-semibold text-slate-700 text-sm">Timing Preferences</h3>
                        </div>
                        {topTimings.length === 0 ? <p className="text-xs text-slate-400">No data yet</p> : (
                            <div className="space-y-3">
                                {topTimings.map(([timing, count]) => (
                                    <div key={timing}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium text-slate-700">{timing}</span>
                                            <span className="text-slate-400">{count}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-aida-teal to-[#005560] rounded-full"
                                                style={{ width: `${(count / topTimings[0][1]) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Input Type Preferences */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <h3 className="font-semibold text-slate-700 text-sm">Input Type Preferences</h3>
                        </div>
                        {topInputs.length === 0 ? <p className="text-xs text-slate-400">No data yet</p> : (
                            <div className="space-y-3">
                                {topInputs.map(([input, count]) => (
                                    <div key={input}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium text-slate-700 capitalize">{input.replace('_', ' ')}</span>
                                            <span className="text-slate-400">{count}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                                style={{ width: `${(count / topInputs[0][1]) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Learning Events */}
                    <div className="md:col-span-3 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <h3 className="font-semibold text-slate-700 text-sm mb-4">Recent Learning Sessions</h3>
                        <div className="space-y-2">
                            {prefs.slice(0, 10).map(pref => (
                                <div key={pref.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                                    <Brain className="w-3.5 h-3.5 text-aida-teal mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-slate-700 font-medium truncate block">"{pref.originalPrompt.slice(0, 80)}{pref.originalPrompt.length > 80 ? '…' : ''}"</span>
                                        <span className="text-slate-400 mt-0.5 block">{new Date(pref.savedAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LearningDashboard;


