import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const { user, access_token } = res.data as any;
        set({ user, accessToken: access_token, isAuthenticated: true });
      },

      register: async (email, password, name) => {
        const res = await api.post('/auth/register', { email, password, name });
        const { user, access_token } = res.data as any;
        set({ user, accessToken: access_token, isAuthenticated: true });
      },

      logout: () => {
        api.post('/auth/logout').catch(() => {});
        set({ user: null, accessToken: null, isAuthenticated: false });
        window.location.href = '/login';
      },

      refreshAccessToken: async () => {
        const res = await api.post('/auth/refresh');
        const { access_token } = res.data as any;
        set({ accessToken: access_token });
        return { access_token };
      },

      fetchMe: async () => {
        try {
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
          const user = res.data as User;
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'nexus-auth',              // localStorage key
      partialize: (state) => ({
        // Only persist token and user, not functions
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
