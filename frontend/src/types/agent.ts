export interface AgentType {
  id: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  capabilities: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentConfig {
  model?: string;
  timeout?: number;
  max_retries?: number;
  skills?: string[];
  [key: string]: unknown;
}

export interface AgentInstance {
  id: string;
  name: string;
  agent_type_id: string;
  status: 'online' | 'offline' | 'busy';
  bridge_url?: string;
  config: AgentConfig;
  last_seen?: string;
  token_usage_today?: number;
  token_usage_month?: number;
  created_at: string;
  updated_at: string;
  // Legacy backward-compat fields (old pages expect these directly)
  type?: string;
  model?: string;
  timeout?: number;
  skills?: string[];
  capabilities?: string[];
}
