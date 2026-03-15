import React, { useState } from 'react';
import { AGENT_LIBRARY } from '../data/agentLibrary';
import { getAgentTypes } from '../services/dbService';
import { Bot, Search, ChevronRight, FolderOpen } from 'lucide-react';

const AgentLibraryPage: React.FC = () => {
    const [search, setSearch] = useState('');
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const agentTypes = getAgentTypes();

    const filtered = AGENT_LIBRARY.filter(a => {
        const matchesSearch = !search ||
            a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.description.toLowerCase().includes(search.toLowerCase());
        const matchesType = !selectedType || a.type === selectedType;
        return matchesSearch && matchesType;
    });

    const grouped = agentTypes.reduce<Record<string, typeof AGENT_LIBRARY>>((acc, type) => {
        const agents = filtered.filter(a => a.type === type);
        if (agents.length > 0) acc[type] = agents;
        return acc;
    }, {});

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Agent Library</h2>
                <p className="text-slate-500 mt-1 text-sm">Browse all available AI agents organized by type. Agents will be individually deployable modules in future releases.</p>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-3 mb-6 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search agents..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedType(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!selectedType ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        All
                    </button>
                    {agentTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => setSelectedType(t => t === type ? null : type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedType === type ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Agent Groups */}
            <div className="space-y-6">
                {Object.entries(grouped).map(([type, agents]) => (
                    <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
                            <div className="p-1.5 bg-indigo-100 rounded-lg">
                                <FolderOpen className="w-4 h-4 text-indigo-600" />
                            </div>
                            <span className="font-semibold text-slate-700">{type}</span>
                            <span className="ml-auto text-xs text-slate-400">{agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {agents.map(agent => (
                                <div key={agent.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors group">
                                    <span className="text-2xl">{agent.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-slate-800">{agent.name}</div>
                                        <div className="text-xs text-slate-500 truncate">{agent.description}</div>
                                    </div>
                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">{agent.id}</span>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {Object.keys(grouped).length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <Bot className="w-14 h-14 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No agents found</p>
                        <p className="text-sm mt-1">Try a different search term or filter</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentLibraryPage;
