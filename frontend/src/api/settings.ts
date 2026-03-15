import api from './client';

export const settingsApi = {
  getAll: () => api.get('/v1/admin/settings') as Promise<any>,
  update: (settings: Record<string, unknown>) =>
    api.put('/v1/admin/settings', { settings }) as Promise<any>,
};
