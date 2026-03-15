export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_agent_id?: string;
  created_by: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}
