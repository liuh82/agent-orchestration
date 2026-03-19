import api from './client';

export interface GatewayBridge {
  bridge_id: string;
  platform: string;
  hostname: string;
  os_version?: string;
  node_version?: string;
  bridge_version?: string;
  status: 'online' | 'offline';
  last_seen: number;
  available_adapters: Array<{ type: string; agent_name: string; version?: string }>;
  active_tasks: number;
  max_concurrent: number;
  created_at?: number;
  updated_at?: number;
}

export interface GatewayTask {
  task_id: string;
  bridge_id?: string;
  prompt: string;
  project_path: string;
  agent_type: string;
  timeout: number;
  priority: string;
  status: string;
  output?: string;
  error?: string;
  exit_code?: number;
  changed_files?: string[];
  duration?: number;
  progress: number;
  cost_usd: number;
  sandbox_mode: boolean;
  sandbox_patch?: string;
  submitted_at: number;
  started_at?: number;
  completed_at?: number;
}

export const gatewayApi = {
  /** List all bridges */
  listBridges: () =>
    api.get('/gateway/bridges') as Promise<{ data: GatewayBridge[] }>,

  /** List gateway tasks with filtering */
  listTasks: (params?: {
    status?: string;
    bridge_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: string;
  }) =>
    api.get('/gateway/tasks', { params }) as Promise<{
      data: { items: GatewayTask[]; total: number };
    }>,
};
