import api from './client';

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }),

  getMe: () => api.get('/auth/me'),

  updateMe: (data: { name?: string; avatar?: string; settings?: Record<string, unknown> }) =>
    api.put('/auth/me', data),

  changePassword: (old_password: string, new_password: string) =>
    api.put('/auth/password', { old_password, new_password }),

  refresh: () =>
    // refresh_token 通过 httpOnly cookie 自动发送，无需传参
    api.post('/auth/refresh'),

  logout: () =>
    api.post('/auth/logout'),
};
