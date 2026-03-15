import api from './client';

export const notificationApi = {
  list: () => api.get('/v1/notifications/channels') as Promise<any>,
  create: (data: { channel_type: string; name: string; config: Record<string, unknown>; triggers?: unknown[] }) =>
    api.post('/v1/notifications/channels', data) as Promise<any>,
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/v1/notifications/channels/${id}`, data) as Promise<any>,
  delete: (id: string) =>
    api.delete(`/v1/notifications/channels/${id}`) as Promise<any>,
  test: (id: string) =>
    api.post(`/v1/notifications/channels/${id}/test`) as Promise<any>,
  listGlobal: () => api.get('/v1/notifications/channels') as Promise<any>,
};
