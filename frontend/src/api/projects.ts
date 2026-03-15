import api from './client';

export const projectApi = {
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    api.get('/projects', { params }) as Promise<any>,

  getById: (id: string) =>
    api.get(`/projects/${id}`) as Promise<any>,

  create: (data: { name: string; description?: string; spec?: string }) =>
    api.post('/projects', data) as Promise<any>,

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/projects/${id}`, data) as Promise<any>,

  archive: (id: string) =>
    api.delete(`/projects/${id}`) as Promise<any>,

  getTasks: (projectId: string, params?: { page?: number; page_size?: number }) =>
    api.get(`/projects/${projectId}/tasks`, { params }) as Promise<any>,

  createTask: (projectId: string, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/tasks`, data) as Promise<any>,
};
