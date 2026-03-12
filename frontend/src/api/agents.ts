import api from './client';
import { Agent } from '../types';

export const agentsApi = {
  // 获取所有 Agent
  getAgents: () => api.get<Agent[]>('/agents'),

  // 创建 Agent
  createAgent: (data: Partial<Agent>) => api.post<Agent>('/agents', data),

  // 获取单个 Agent
  getAgent: (id: string) => api.get<Agent>(`/agents/${id}`),

  // 更新 Agent
  updateAgent: (id: string, data: Partial<Agent>) => api.put<Agent>(`/agents/${id}`, data),

  // 删除 Agent
  deleteAgent: (id: string) => api.delete(`/agents/${id}`),

  // 获取 Agent 状态
  getAgentStatus: (id: string) => api.get(`/agents/${id}/status`),

  // 启动 Agent
  startAgent: (id: string) => api.post(`/agents/${id}/start`),

  // 停止 Agent
  stopAgent: (id: string) => api.post(`/agents/${id}/stop`),
};