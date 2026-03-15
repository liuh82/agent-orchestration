export interface DashboardStats {
  agent_count: number;
  agent_online_count: number;
  project_count: number;
  task_count: number;
  task_completed_count: number;
  token_usage_today: number;
  token_usage_month: number;
  cost_this_month?: number;
  recent_tasks: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
  }>;
}
