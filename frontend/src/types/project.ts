export interface Project {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  spec?: string;
  workflow_id?: string;
  config_overrides?: Record<string, Record<string, unknown>>;
  status: 'active' | 'archived' | 'deleted';
  total_tasks?: number;
  completed_tasks?: number;
  total_tokens?: number;
  total_cost?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
