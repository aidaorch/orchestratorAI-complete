import { WorkflowResult } from '../types';
import apiClient from './apiClient';

export interface TemplateVersion {
    id: string;
    version: number;
    workflow: WorkflowResult;
    savedAt: string;
    changeNote: string;
}

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    workflow: WorkflowResult;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    versions: TemplateVersion[];
    stepCount?: number;  // Optional — only present in list view
}

// ---- Save template via backend ----
export const saveTemplate = async (
    workflow: WorkflowResult,
    name: string,
    description: string = '',
    tags: string[] = [],
    changeNote: string = 'Initial save'
): Promise<WorkflowTemplate> => {
    const response = await apiClient.post('/template/save', {
        name,
        description,
        workflow_data: workflow,
        tags,
        change_note: changeNote
    });
    return mapTemplateResponse(response.data);
};

// ---- Get template list (metadata only — no workflow_data) ----
export const getTemplates = async (): Promise<WorkflowTemplate[]> => {
    try {
        const response = await apiClient.get('/template/list');
        const templates: any[] = response.data.templates || [];
        // List endpoint returns metadata + step_count; workflow is empty placeholder
        return templates.map(t => ({
            id: t.template_id,
            name: t.name,
            description: t.description || '',
            workflow: { 
                workflow_metadata: { 
                    workflow_name: t.name, 
                    instance_id: t.template_id, 
                    is_template: true, 
                    version: String(t.version_number || 1) 
                }, 
                steps: [] 
            },
            createdAt: t.created_at,
            updatedAt: t.updated_at || t.created_at,
            tags: Array.isArray(t.tags) ? t.tags : [],
            versions: [],
            stepCount: t.step_count || 0  // NEW: from backend
        }));
    } catch (error) {
        console.error('Error fetching templates:', error);
        return [];
    }
};

// ---- Get full template by ID (includes workflow_data) ----
export const getTemplateById = async (id: string): Promise<WorkflowTemplate | null> => {
    try {
        const response = await apiClient.get(`/template/${id}`);
        return mapTemplateResponse(response.data);
    } catch (error) {
        console.error('Error fetching template:', error);
        return null;
    }
};

export const deleteTemplate = async (id: string): Promise<void> => {
    await apiClient.delete(`/template/${id}`);
};

export const cloneTemplate = async (id: string): Promise<WorkflowTemplate | null> => {
    try {
        const response = await apiClient.post(`/template/${id}/clone`);
        return mapTemplateResponse(response.data);
    } catch (error) {
        console.error('Error cloning template:', error);
        return null;
    }
};

export const restoreTemplateVersion = async (_templateId: string, _versionId: string): Promise<WorkflowTemplate | null> => {
    console.log('Version restore not yet implemented in backend');
    return null;
};

export const exportTemplateToJSON = async (id: string): Promise<string | null> => {
    const template = await getTemplateById(id);
    if (!template) return null;
    return JSON.stringify(template, null, 2);
};

export const importTemplateFromJSON = async (json: string): Promise<WorkflowTemplate | null> => {
    try {
        const parsed = JSON.parse(json) as WorkflowTemplate;
        if (!parsed.name || !parsed.workflow) return null;
        return saveTemplate(parsed.workflow, parsed.name, parsed.description || '', parsed.tags || []);
    } catch {
        return null;
    }
};

// ---- Internal mapper ----
function mapTemplateResponse(data: any): WorkflowTemplate {
    const raw = data.workflow_data ?? {};
    // Ensure the stored workflow_data has proper structure
    const workflow: WorkflowResult = {
        workflow_metadata: raw.workflow_metadata ?? {
            workflow_name: data.name ?? 'Template',
            instance_id: data.template_id ?? `tpl_${Date.now()}`,
            is_template: true,
            version: String(data.version_number || 1)
        },
        steps: Array.isArray(raw.steps) ? raw.steps : []
    };
    return {
        id: data.template_id,
        name: data.name,
        description: data.description || '',
        workflow,
        createdAt: data.created_at,
        updatedAt: data.updated_at || data.created_at,
        tags: Array.isArray(data.tags) ? data.tags : [],
        versions: []
    };
}
