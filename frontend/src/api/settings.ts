import api from './client';

export const settingsApi = {
  getAll: () => api.get('/admin/settings') as Promise<any>,
  update: (settings: Record<string, unknown>) =>
    api.put('/admin/settings', { settings }) as Promise<any>,
};
