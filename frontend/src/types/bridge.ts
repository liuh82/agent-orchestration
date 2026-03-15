export interface Bridge {
  id: string;
  bridge_id: string;
  platform: string;
  hostname: string;
  os_version?: string;
  node_version?: string;
  bridge_version?: string;
  status: 'online' | 'offline';
  last_seen: number;
  available_adapters?: string[];
  active_tasks?: number;
  max_concurrent?: number;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BridgeTask {
  id: string;
  task_id: string;
  bridge_id: string;
  agent_type: string;
  status: string;
  priority: number;
  progress: number;
  submitted_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface BridgeCreateResponse {
  bridge_id: string;
  api_key: string;
  ws_url: string;
  setup_command: string;
  install_guide: string;
}
