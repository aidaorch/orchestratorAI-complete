import React, { useMemo } from 'react';
import { WorkflowResult } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart2 } from 'lucide-react';

interface AnalyticsDashboardProps {
  data: WorkflowResult;
}

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#64748b'];

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ data }) => {
  const safeSteps = Array.isArray(data?.steps) ? data.steps : [];

  const agentStats = useMemo(() => {
    const counts: Record<string, number> = {};
    safeSteps.forEach(step => {
      counts[step.agent_type] = (counts[step.agent_type] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [safeSteps]);

  const timingStats = useMemo(() => {
    const counts: Record<string, number> = {};
    safeSteps.forEach(step => {
      counts[step.timing_logic] = (counts[step.timing_logic] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, count: counts[key] }));
  }, [safeSteps]);

  if (safeSteps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12">
        <BarChart2 className="w-16 h-16 mb-4 opacity-20" />
        <p className="font-medium text-slate-600">No workflow data to analyse</p>
        <p className="text-sm mt-1">Generate or load a workflow first.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 max-w-4xl mx-auto">
        {[
          { label: 'Total Steps', value: safeSteps.length },
          { label: 'Agent Types', value: agentStats.length },
          { label: 'Timing Modes', value: timingStats.length },
          { label: 'Parallel Groups', value: new Set(safeSteps.map(s => s.parallel_group).filter(Boolean)).size },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-indigo-700">{stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
        {/* Agent Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">Agent Composition</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={agentStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {agentStats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timing Logic Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">Automation Level</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timingStats}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Step dependency table */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Step Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="pb-2 pr-4 font-semibold">#</th>
                  <th className="pb-2 pr-4 font-semibold">Agent</th>
                  <th className="pb-2 pr-4 font-semibold">Timing</th>
                  <th className="pb-2 pr-4 font-semibold">Depends On</th>
                  <th className="pb-2 font-semibold">Parallel Group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {safeSteps.map(step => (
                  <tr key={step.step_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 pr-4 text-slate-400 font-mono text-xs">{step.step_id}</td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{step.agent_type}</span>
                    </td>
                    <td className="py-2 pr-4 text-slate-600 text-xs">{step.timing_logic}</td>
                    <td className="py-2 pr-4 text-slate-500 text-xs font-mono">
                      {(step.depends_on || []).length > 0 ? `[${step.depends_on!.join(', ')}]` : '—'}
                    </td>
                    <td className="py-2 text-slate-500 text-xs">
                      {step.parallel_group || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
