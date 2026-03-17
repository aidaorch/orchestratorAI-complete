/**
 * dbService.ts — Backend API integration for data persistence.
 * Handles: workflow history, templates via backend APIs.
 */

import { WorkflowResult, WorkflowHistory, LearnedPreference } from '../types';
import apiClient from './apiClient';

// ----- Prompt History (kept in localStorage for UX) -----
const PROMPT_HISTORY_KEY = 'oai_prompt_history';

export const getPromptHistory = (): string[] => {
    try {
        const raw = localStorage.getItem(PROMPT_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const savePrompt = (prompt: string): void => {
    const history = getPromptHistory();
    const updated = [prompt, ...history.filter(p => p !== prompt)].slice(0, 50);
    localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(updated));
};

// ----- Workflow History (Backend API) -----
export const getWorkflowHistory = async (): Promise<WorkflowHistory[]> => {
    try {
        const response = await apiClient.get('/workflow/list');
        // Backend returns { workflows: [...], total, page, pages }
        const workflows = response.data.workflows || [];
        return workflows.map((wf: any) => ({
            id: wf.workflow_id,
            prompt: wf.original_prompt || '',
            workflow: wf.workflow_data || {},
            savedAt: wf.created_at
        }));
    } catch (error) {
        console.error('Error fetching workflow history:', error);
        return [];
    }
};

export const saveWorkflowToHistory = async (prompt: string, workflow: WorkflowResult): Promise<void> => {
    try {
        // Workflows are automatically saved when generated
        // This function is kept for compatibility but may not be needed
        console.log('Workflow already saved during generation');
    } catch (error) {
        console.error('Error saving workflow:', error);
    }
};

// ----- Custom Agent Types (kept in localStorage) -----
const CUSTOM_AGENT_TYPES_KEY = 'oai_custom_agent_types';
const DEFAULT_AGENT_TYPES = [
    'Content', 'Design', 'Scheduler', 'Heatmaps', 'Bounce',
    'Subject Line Checker', 'Scraper', 'CRM', 'Outreach', 'Analytics',
];

export const getAgentTypes = (): string[] => {
    try {
        const raw = localStorage.getItem(CUSTOM_AGENT_TYPES_KEY);
        const custom = raw ? JSON.parse(raw) : [];
        return [...DEFAULT_AGENT_TYPES, ...custom];
    } catch {
        return DEFAULT_AGENT_TYPES;
    }
};

export const addCustomAgentType = (type: string): void => {
    try {
        const raw = localStorage.getItem(CUSTOM_AGENT_TYPES_KEY);
        const custom = raw ? JSON.parse(raw) : [];
        if (!custom.includes(type) && !DEFAULT_AGENT_TYPES.includes(type)) {
            localStorage.setItem(CUSTOM_AGENT_TYPES_KEY, JSON.stringify([...custom, type]));
        }
    } catch (error) {
        console.error('Error adding custom agent type:', error);
    }
};

// ----- Learned Preferences (Backend API) -----
export const getLearnedPreferences = async (): Promise<LearnedPreference[]> => {
    try {
        const response = await apiClient.get('/learning/preferences');
        return (response.data as any[]).map((p: any) => ({
            id: p.preference_id,
            originalPrompt: p.original_prompt || '',
            agentTypeChanges: p.agent_type_changes || {},
            timingPreferences: p.timing_preferences || {},
            inputTypePreferences: p.input_type_preferences || {},
            savedAt: p.created_at,
        }));
    } catch (error) {
        console.error('Error fetching learned preferences:', error);
        return [];
    }
};

export const saveLearnedPreference = async (pref: Omit<LearnedPreference, 'id' | 'savedAt'>): Promise<void> => {
    try {
        await apiClient.post('/learning/preferences', {
            original_prompt: pref.originalPrompt,
            agent_type_changes: pref.agentTypeChanges,
            timing_preferences: pref.timingPreferences,
            input_type_preferences: pref.inputTypePreferences,
        });
    } catch (error) {
        console.error('Error saving learned preference:', error);
    }
};
