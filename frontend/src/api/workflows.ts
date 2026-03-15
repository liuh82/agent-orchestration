import api from './client';

export const workflowsApi = {
  list: () => api.get('/workflows') as Promise<any>,

  create: (data: Record<string, unknown>) =>
    api.post('/workflows', data) as Promise<any>,

  getById: (id: string) =>
    api.get(`/workflows/${id}`) as Promise<any>,

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/workflows/${id}`, data) as Promise<any>,

  delete: (id: string) =>
    api.delete(`/workflows/${id}`) as Promise<any>,

  execute: (id: string, data?: { name?: string }) =>
    api.post(`/workflows/${id}/execute`, data) as Promise<any>,

  /** 执行实例操作 */
  pauseExecution: (executionId: string) =>
    api.post(`/workflows/executions/${executionId}/pause`) as Promise<any>,

  resumeExecution: (executionId: string) =>
    api.post(`/workflows/executions/${executionId}/resume`) as Promise<any>,

  cancelExecution: (executionId: string) =>
    api.post(`/workflows/executions/${executionId}/cancel`) as Promise<any>,

  getExecution: (executionId: string) =>
    api.get(`/workflows/executions/${executionId}`) as Promise<any>,

  listExecutions: () =>
    api.get('/workflows/executions') as Promise<any>,

  /** 模板 */
  listTemplates: () =>
    api.get('/workflows/templates') as Promise<any>,

  getTemplate: (id: string) =>
    api.get(`/workflows/templates/${id}`) as Promise<any>,

  deleteTemplate: (id: string) =>
    api.delete(`/workflows/templates/${id}`) as Promise<any>,

  saveAsTemplate: (data: Record<string, unknown>) =>
    api.post('/workflows/save-as-template', data) as Promise<any>,

  /** 节点类型 schema */
  getNodeTypes: () =>
    api.get('/workflows/node-types') as Promise<any>,
};
