import api from './client';

export const projectApi = {
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    api.get('/projects/', { params }) as Promise<any>,

  getById: (id: string) =>
    api.get(`/projects/${id}/`) as Promise<any>,

  create: (data: {
    name: string;
    description?: string;
    spec?: string;
    workflow_id?: string;
    config_overrides?: Record<string, Record<string, unknown>>;
  }) =>
    api.post('/projects/', data) as Promise<any>,

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/projects/${id}/`, data) as Promise<any>,

  archive: (id: string) =>
    api.delete(`/projects/${id}/`) as Promise<any>,

  getTasks: (
    projectId: string,
    params?: { page?: number; page_size?: number; status?: string; sort_by?: string; sort_order?: string },
  ) =>
    api.get(`/projects/${projectId}/tasks/`, { params }) as Promise<any>,

  createTask: (
    projectId: string,
    data: {
      name: string;
      description?: string;
      workflow_id?: string;
      assigned_agent?: string;
      config_overrides?: Array<{
        workflow_node_id: string;
        agent_type_id?: string;
        config_override: Record<string, unknown>;
      }>;
      schedule?: {
        type: 'immediate' | 'cron' | 'interval';
        cron_expression?: string;
        interval_seconds?: number;
      };
    },
  ) =>
    api.post(`/projects/${projectId}/tasks/`, data) as Promise<any>,

  // ── 文档 ──
  getDocuments: (projectId: string) =>
    api.get(`/projects/${projectId}/documents/`) as Promise<any>,

  createDocument: (
    projectId: string,
    data: Record<string, unknown> | FormData,
  ) => {
    const isFormData = data instanceof FormData;
    return api.post(`/projects/${projectId}/documents/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }) as Promise<any>;
  },

  updateDocument: (
    projectId: string,
    docId: string,
    data: { title?: string; content?: string },
  ) =>
    api.put(`/projects/${projectId}/documents/${docId}/`, data) as Promise<any>,

  deleteDocument: (projectId: string, docId: string) =>
    api.delete(`/projects/${projectId}/documents/${docId}/`) as Promise<any>,

  // ── Agent 配置文件 ──
  getAgentConfigs: (projectId: string) =>
    api.get(`/projects/${projectId}/agent-configs/`) as Promise<any>,

  saveAgentConfig: (
    projectId: string,
    data: { agent_type: string; config_type: string; content: string },
  ) =>
    api.post(`/projects/${projectId}/agent-configs/`, data) as Promise<any>,

  // ── 文件管理 ──
  getFiles: (projectId: string) =>
    api.get(`/projects/${projectId}/files/`) as Promise<any>,

  deleteFile: (projectId: string, fileId: string) =>
    api.delete(`/projects/${projectId}/files/${fileId}/`) as Promise<any>,
};
