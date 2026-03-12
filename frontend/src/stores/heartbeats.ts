import { create } from 'zustand';
import { Heartbeat, HeartbeatLog, HeartbeatStats } from '../types';
import { heartbeatsApi } from '../api/heartbeats';

interface HeartbeatsState {
  heartbeats: Heartbeat[];
  heartbeatLogs: { [key: string]: HeartbeatLog[] };
  stats: HeartbeatStats | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchHeartbeats: () => Promise<void>;
  fetchHeartbeatStats: () => Promise<void>;
  createHeartbeat: (data: Partial<Heartbeat>) => Promise<void>;
  updateHeartbeat: (id: string, data: Partial<Heartbeat>) => Promise<void>;
  deleteHeartbeat: (id: string) => Promise<void>;
  enableHeartbeat: (id: string) => Promise<void>;
  disableHeartbeat: (id: string) => Promise<void>;
  triggerHeartbeat: (id: string) => Promise<void>;
  fetchHeartbeatLogs: (id: string, limit?: number) => Promise<void>;
}

export const useHeartbeatsStore = create<HeartbeatsState>((set) => ({
  heartbeats: [],
  heartbeatLogs: {},
  stats: null,
  loading: false,
  error: null,

  fetchHeartbeats: async () => {
    set({ loading: true, error: null });
    try {
      const response = await heartbeatsApi.getHeartbeats();
      set({ heartbeats: response.data.data || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch heartbeats',
        loading: false
      });
    }
  },

  fetchHeartbeatStats: async () => {
    set({ loading: true, error: null });
    try {
      const response = await heartbeatsApi.getHeartbeatStats();
      set({ stats: response.data.data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch stats',
        loading: false
      });
    }
  },

  createHeartbeat: async (data) => {
    set({ loading: true, error: null });
    try {
      await heartbeatsApi.createHeartbeat(data);
      await heartbeatsApi.getHeartbeats(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create heartbeat',
        loading: false
      });
    }
  },

  updateHeartbeat: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await heartbeatsApi.updateHeartbeat(id, data);
      await heartbeatsApi.getHeartbeats(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update heartbeat',
        loading: false
      });
    }
  },

  deleteHeartbeat: async (id) => {
    set({ loading: true, error: null });
    try {
      await heartbeatsApi.deleteHeartbeat(id);
      await heartbeatsApi.getHeartbeats(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete heartbeat',
        loading: false
      });
    }
  },

  enableHeartbeat: async (id) => {
    set({ loading: true, error: null });
    try {
      await heartbeatsApi.enableHeartbeat(id);
      await heartbeatsApi.getHeartbeats(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to enable heartbeat',
        loading: false
      });
    }
  },

  disableHeartbeat: async (id) => {
    set({ loading: true, error: null });
    try {
      await heartbeatsApi.disableHeartbeat(id);
      await heartbeatsApi.getHeartbeats(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to disable heartbeat',
        loading: false
      });
    }
  },

  triggerHeartbeat: async (id) => {
    set({ loading: true, error: null });
    try {
      await heartbeatsApi.triggerHeartbeat(id);
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to trigger heartbeat',
        loading: false
      });
    }
  },

  fetchHeartbeatLogs: async (id, limit = 50) => {
    set({ loading: true, error: null });
    try {
      const response = await heartbeatsApi.getHeartbeatLogs(id, limit);
      set((state) => ({
        heartbeatLogs: {
          ...state.heartbeatLogs,
          [id]: response.data.data || []
        },
        loading: false
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
        loading: false
      });
    }
  },
}));
