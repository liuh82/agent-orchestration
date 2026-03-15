import api from './client';

export const agentApi = {
  list: async (params?: { page?: number; page_size?: number; search?: string }): Promise<any> => {
    const res = await api.get<any>('/agents/', { params });
    if (Array.isArray(res.data)) {
      return { data: { items: res.data, total: res.data.length } };
    }
    return { data: res.data };
  },

  getById: (id: string) =>
    api.get(`/agents/${id}/`) as Promise<any>,

  create: (data: { type_id: string; name: string; model?: string; config?: Record<string, unknown> }) =>
    api.post('/agents/', data) as Promise<any>,

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/agents/${id}/`, data) as Promise<any>,

  delete: (id: string) =>
    api.delete(`/agents/${id}/`) as Promise<any>,

  test: (id: string) =>
    api.post(`/agents/${id}/test/`) as Promise<any>,

  start: (id: string) =>
    api.post(`/agents/${id}/start/`) as Promise<any>,

  stop: (id: string) =>
    api.post(`/agents/${id}/stop/`) as Promise<any>,

  getLogs: (id: string, params?: Record<string, unknown>) =>
    api.get(`/agents/${id}/logs/`, { params }) as Promise<any>,

  getTypes: async (): Promise<any> => {
    const res = await api.get<any>('/agents/types/');
    const data = Array.isArray(res.data) ? res.data : res.data?.items ?? res.data?.data ?? [];
    return { data };
  },
};
