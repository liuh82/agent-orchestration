import api from './client';

export const notificationApi = {
  list: () => api.get('/v1/notifications/channels') as Promise<any>,
  create: (data: Record<string, unknown>) =>
    api.post('/v1/notifications/channels', data) as Promise<any>,
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/v1/notifications/channels/${id}`, data) as Promise<any>,
  delete: (id: string) =>
    api.delete(`/v1/notifications/channels/${id}`) as Promise<any>,
  test: (id: string) =>
    api.post(`/v1/notifications/channels/${id}/test`) as Promise<any>,
  listGlobal: () => api.get('/v1/notifications/admin/channels') as Promise<any>,
  createGlobal: (data: Record<string, unknown>) =>
    api.post('/v1/notifications/admin/channels', data) as Promise<any>,
  updateGlobal: (id: string, data: Record<string, unknown>) =>
    api.put(`/v1/notifications/admin/channels/${id}`, data) as Promise<any>,
  deleteGlobal: (id: string) =>
    api.delete(`/v1/notifications/admin/channels/${id}`) as Promise<any>,
  testGlobal: (id: string) =>
    api.post(`/v1/notifications/admin/channels/${id}/test`) as Promise<any>,
};
