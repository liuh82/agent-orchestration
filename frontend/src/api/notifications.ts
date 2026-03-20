import api from './client';

export const notificationApi = {
  list: () => api.get('/notifications/channels') as Promise<any>,
  create: (data: Record<string, unknown>) =>
    api.post('/notifications/channels', data) as Promise<any>,
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/notifications/channels/${id}`, data) as Promise<any>,
  delete: (id: string) =>
    api.delete(`/notifications/channels/${id}`) as Promise<any>,
  test: (id: string) =>
    api.post(`/notifications/channels/${id}/test`) as Promise<any>,
  listGlobal: () => api.get('/notifications/admin/channels') as Promise<any>,
  createGlobal: (data: Record<string, unknown>) =>
    api.post('/notifications/admin/channels', data) as Promise<any>,
  updateGlobal: (id: string, data: Record<string, unknown>) =>
    api.put(`/notifications/admin/channels/${id}`, data) as Promise<any>,
  deleteGlobal: (id: string) =>
    api.delete(`/notifications/admin/channels/${id}`) as Promise<any>,
  testGlobal: (id: string) =>
    api.post(`/notifications/admin/channels/${id}/test`) as Promise<any>,
};
