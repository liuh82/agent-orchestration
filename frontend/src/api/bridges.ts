import api from './client';

export const bridgeApi = {
  list: () =>
    api.get('/bridges/') as Promise<any>,

  getById: (bridgeId: string) =>
    api.get(`/bridges/${bridgeId}`) as Promise<any>,

  create: () =>
    api.post('/bridges/') as Promise<any>,

  update: (bridgeId: string, data: Record<string, unknown>) =>
    api.put(`/bridges/${bridgeId}`, data) as Promise<any>,

  delete: (bridgeId: string) =>
    api.delete(`/bridges/${bridgeId}`) as Promise<any>,

  getTasks: (bridgeId: string) =>
    api.get(`/bridges/${bridgeId}/tasks`) as Promise<any>,
};
