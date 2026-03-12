import api from './client';
import { ApiResponse, Heartbeat, HeartbeatLog, HeartbeatStats } from '../types';

export const heartbeatsApi = {
  // ===== Heartbeats =====
  getHeartbeats: () =>
    api.get<ApiResponse<Heartbeat[]>>('/heartbeats'),

  getHeartbeatStats: () =>
    api.get<{ success: boolean; data: HeartbeatStats; message: string }>('/heartbeats/stats'),

  getHeartbeat: (heartbeatId: string) =>
    api.get<ApiResponse<Heartbeat>>(`/heartbeats/${heartbeatId}`),

  createHeartbeat: (data: Partial<Heartbeat>) =>
    api.post<ApiResponse<Heartbeat>>('/heartbeats', data),

  updateHeartbeat: (heartbeatId: string, data: Partial<Heartbeat>) =>
    api.put<ApiResponse<Heartbeat>>(`/heartbeats/${heartbeatId}`, data),

  deleteHeartbeat: (heartbeatId: string) =>
    api.delete(`/heartbeats/${heartbeatId}`),

  enableHeartbeat: (heartbeatId: string) =>
    api.post(`/heartbeats/${heartbeatId}/enable`),

  disableHeartbeat: (heartbeatId: string) =>
    api.post(`/heartbeats/${heartbeatId}/disable`),

  triggerHeartbeat: (heartbeatId: string) =>
    api.post(`/heartbeats/${heartbeatId}/trigger`),

  // ===== Logs =====
  getHeartbeatLogs: (heartbeatId: string, limit = 50) =>
    api.get<ApiResponse<HeartbeatLog[]>>(`/heartbeats/${heartbeatId}/logs`, {
      params: { limit }
    }),
};
