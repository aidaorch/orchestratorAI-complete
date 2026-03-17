import apiClient from './apiClient';

export interface AdminStats {
  total_users: number;
  active_users: number;
  admin_users: number;
  new_users_this_week: number;
  total_workflows: number;
  total_templates: number;
  total_executions: number;
}

export interface AdminUser {
  user_id: string;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  last_login: string | null;
  workflow_count: number;
  template_count: number;
}

export interface AdminWorkflow {
  workflow_id: string;
  workflow_name: string;
  username: string;
  step_count: number | null;
  original_prompt: string | null;
  created_at: string;
}

export interface AdminTemplate {
  template_id: string;
  name: string;
  username: string;
  usage_count: number;
  is_public: boolean;
  step_count: number;
  created_at: string;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface AuditLogEntry {
  log_id: string;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  status: string;
  detail: string | null;
  created_at: string;
}

export const adminService = {
  getStats: async (): Promise<AdminStats> => {
    const { data } = await apiClient.get('/admin/stats');
    return data;
  },

  getUsers: async (page = 1, search = ''): Promise<{ users: AdminUser[]; total: number; pages: number }> => {
    const { data } = await apiClient.get('/admin/users', { params: { page, limit: 20, search: search || undefined } });
    return data;
  },

  updateUser: async (userId: string, patch: { is_active?: boolean; is_admin?: boolean }) => {
    const { data } = await apiClient.patch(`/admin/users/${userId}`, patch);
    return data;
  },

  resetPassword: async (userId: string, newPassword: string) => {
    const { data } = await apiClient.post(`/admin/users/${userId}/reset-password`, { new_password: newPassword });
    return data;
  },

  deleteUser: async (userId: string) => {
    const { data } = await apiClient.delete(`/admin/users/${userId}`);
    return data;
  },

  getWorkflows: async (page = 1, search = ''): Promise<{ workflows: AdminWorkflow[]; total: number; pages: number }> => {
    const { data } = await apiClient.get('/admin/workflows', { params: { page, limit: 20, search: search || undefined } });
    return data;
  },

  deleteWorkflow: async (workflowId: string) => {
    const { data } = await apiClient.delete(`/admin/workflows/${workflowId}`);
    return data;
  },

  getTemplates: async (page = 1, search = ''): Promise<{ templates: AdminTemplate[]; total: number; pages: number }> => {
    const { data } = await apiClient.get('/admin/templates', { params: { page, limit: 20, search: search || undefined } });
    return data;
  },

  deleteTemplate: async (templateId: string) => {
    const { data } = await apiClient.delete(`/admin/templates/${templateId}`);
    return data;
  },

  getAuditLogs: async (page = 1, action = '', username = ''): Promise<{ logs: AuditLogEntry[]; total: number; pages: number }> => {
    const { data } = await apiClient.get('/admin/audit-logs', {
      params: { page, limit: 50, action: action || undefined, username: username || undefined },
    });
    return data;
  },

  getServerLogs: async (logFile: 'error' | 'app', lines = 200): Promise<{ lines: string[]; file: string; exists: boolean; total_lines?: number }> => {
    const { data } = await apiClient.get('/admin/server-logs', { params: { log_file: logFile, lines } });
    return data;
  },
};
