import { create } from 'zustand';
import api from '@/api/client';
import type { User } from '@/types/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<{ access_token: string }>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  login: async (email, password) => {
    // 直接用 axios 避免拦截器（login 时尚无 token）
    const res = await api.post('/auth/login', { email, password });
    const { user, access_token } = res.data;
    set({ user, accessToken: access_token, isAuthenticated: true });
  },

  register: async (email, password, name) => {
    const res = await api.post('/auth/register', { email, password, name });
    const { user, access_token } = res.data;
    set({ user, accessToken: access_token, isAuthenticated: true });
  },

  logout: () => {
    // 调后端 logout 清除 httpOnly cookie + 撤销 token
    api.post('/auth/logout').catch(() => {});
    set({ user: null, accessToken: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  refreshAccessToken: async () => {
    // refresh_token 通过 httpOnly cookie 自动发送，无需手动传参
    const res = await api.post('/auth/refresh');
    const { access_token } = res.data;
    set({ accessToken: access_token });
    return { access_token };
  },

  fetchMe: async () => {
    try {
      // 如果没有 accessToken，先尝试刷新
      const state = get();
      if (!state.accessToken) {
        try {
          await state.refreshAccessToken();
        } catch {
          set({ user: null, isAuthenticated: false });
          return;
        }
      }
      const res = await api.get('/auth/me');
      set({ user: res.data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
