import type { AgentType } from '../protocol/types.js';

export interface ExecuteRequest {
  prompt: string;
  cwd: string;
  agentType: AgentType;
  timeout?: number;
  signal?: AbortSignal;
  onOutput?: (line: string) => void;
  onProgress?: (percent: number) => void;
}

export interface ExecuteResult {
  exitCode: number;
  output: string;
  changedFiles: string[];
  duration: number;
  success: boolean;
}

export interface AdapterInfo {
  type: AgentType;
  agentName: string;
  version?: string;
  executablePath?: string;
  available: boolean;
}

export interface AgentAdapter {
  readonly type: AgentType;

  isAvailable(): Promise<boolean>;

  getInfo(): Promise<AdapterInfo>;

  execute(request: ExecuteRequest): Promise<ExecuteResult>;

  cancel(taskId: string): Promise<void>;

  dispose(): void | Promise<void>;
}
