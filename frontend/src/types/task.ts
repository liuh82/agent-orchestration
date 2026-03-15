export interface Task {
  id: string;
  project_id: string;
  project_name?: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'pending_human';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_agent_id?: string;
  agent_name?: string;
  workflow_id?: string;
  created_by: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  human_context?: string;
  human_code_snippet?: string;
  human_attachments?: string[];
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

/** 三层级树节点 — 项目级 */
export interface TaskTreeProject {
  project_id: string;
  project_name: string;
  running_count: number;
  completed_count: number;
  failed_count: number;
  tasks: TaskTreeTask[];
}

/** 三层级树节点 — 任务级 */
export interface TaskTreeTask {
  id: string;
  project_id: string;
  title: string;
  status: Task['status'];
  priority: Task['priority'];
  assigned_agent_id?: string;
  agent_name?: string;
  progress: number;
  started_at?: string;
  updated_at: string;
  created_at: string;
  logs?: Array<{ level: string; message: string; timestamp: string }>;
  output_files?: Array<{ name: string; path: string }>;
}
