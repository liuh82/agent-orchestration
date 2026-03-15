import api from './client';
import type { DashboardStats } from '@/types/stats';

interface ApiDashboardData {
  agents: { total: number; online: number; offline: number; busy: number; error: number };
  projects: { total: number; active: number; archived: number };
  tasks: { total: number; pending: number; running: number; completed: number; failed: number };
  tokens: { total: number; today: number; this_week: number; this_month: number };
}

function mapDashboardStats(raw: ApiDashboardData): DashboardStats {
  return {
    agent_count: raw.agents.total,
    agent_online_count: raw.agents.online,
    project_count: raw.projects.total,
    task_count: raw.tasks.total,
    task_completed_count: raw.tasks.completed,
    token_usage_today: raw.tokens.today,
    token_usage_month: raw.tokens.this_month,
    recent_tasks: [],
  };
}

export const statsApi = {
  getDashboard: async (): Promise<{ data: DashboardStats }> => {
    const res = await api.get<ApiDashboardData>('/v1/stats/dashboard');
    // client.ts 已自动解包 { code, data }，res.data 就是 ApiDashboardData
    return { data: mapDashboardStats(res.data) };
  },

  getProjectStats: (id: string) =>
    api.get(`/stats/projects/${id}`) as Promise<any>,

  getAgentStats: (id: string) =>
    api.get(`/stats/agents/${id}`) as Promise<any>,
};
