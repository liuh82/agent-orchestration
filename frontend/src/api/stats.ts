import api from './client';

export const statsApi = {
  getDashboard: () =>
    api.get('/stats/dashboard') as Promise<any>,

  getProjectStats: (id: string) =>
    api.get(`/stats/projects/${id}`) as Promise<any>,

  getAgentStats: (id: string) =>
    api.get(`/stats/agents/${id}`) as Promise<any>,
};
