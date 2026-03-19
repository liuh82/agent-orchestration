export interface Task {
  id: string;
  project_id: string;
  user_id?: string;
  project_name?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent_id?: string;
  assigned_agent?: string;
  agent_name?: string;
  workflow_id?: string;
  workflow_name?: string;
  workflow_snapshot?: Record<string, unknown>;
  schedule_type?: 'once' | 'cron' | 'interval';
  schedule_config?: Record<string, unknown>;
  config_overrides?: TaskConfigOverride[];
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
  /** Gateway 费用（美元） */
  cost_usd?: number;
  /** Gateway 重试次数 */
  retry_count?: number;
  /** Gateway 最大重试次数 */
  max_retries?: number;
}

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'scheduled'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'pending_human';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskConfigOverride {
  workflow_node_id: string;
  agent_type_id?: string;
  config_override: Record<string, unknown>;
}

export interface ScheduleConfig {
  type: 'immediate' | 'cron' | 'interval';
  cron_expression?: string;
  interval_seconds?: number;
}

export interface TaskAgentConfig {
  id: string;
  task_id: string;
  workflow_node_id: string;
  agent_type_id?: string;
  config_override: Record<string, unknown> | null;
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

/** Workflow node from backend definition */
export interface WorkflowNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
  config_override_schema?: Record<string, unknown>;
  label?: string;
}
