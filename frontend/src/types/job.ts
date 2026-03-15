export interface Job {
  id: string;
  task_id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error_message?: string;
  token_usage?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}
