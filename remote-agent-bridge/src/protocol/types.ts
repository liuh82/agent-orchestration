export type MessageType =
  | 'auth.request'
  | 'auth.response'
  | 'bridge.register'
  | 'task.submit'
  | 'task.progress'
  | 'task.complete'
  | 'task.cancel'
  | 'ping'
  | 'pong'
  | 'ack'
  | 'error';

export type BridgeStatus =
  | 'INITIALIZING'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'REGISTERING'
  | 'READY'
  | 'SHUTTING_DOWN'
  | 'TERMINATED';

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskPriority = 'high' | 'normal' | 'low';
export type AgentType = 'cli' | 'codex' | 'pi' | 'acp' | 'vscode' | 'cursor' | 'intellij';

export type OSType = 'darwin' | 'win32' | 'linux';

export interface BridgeMessage {
  msgId: string;
  type: MessageType;
  ts: number;
  data: unknown;
}

export interface AuthRequest {
  type: 'auth.request';
  token: string;
  bridgeId: string;
  platform: OSType;
  hostname: string;
  osVersion: string;
  nodeVersion: string;
  bridgeVersion: string;
}

export interface AuthResponse {
  type: 'auth.response';
  success: boolean;
  bridgeId?: string;
  error?: string;
}

export interface BridgeRegister {
  type: 'bridge.register';
  bridgeId: string;
  platform: OSType;
  hostname: string;
  osVersion: string;
  nodeVersion: string;
  bridgeVersion: string;
  availableAdapters: AvailableAdapter[];
  activeIDEs: ActiveIDE[];
}

export interface AvailableAdapter {
  type: AgentType;
  agentName: string;
  version?: string;
  executablePath?: string;
}

export interface ActiveIDE {
  name: string;
  version: string;
  workspace?: string;
}

export interface TaskSubmit {
  type: 'task.submit';
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: AgentType;
  timeout: number;
  priority: TaskPriority;
  callbackId?: string;
  preferredIde?: string;
}

export interface TaskProgress {
  type: 'task.progress';
  taskId: string;
  status: TaskStatus;
  output?: string;
  progress?: number;
  error?: string;
}

export interface TaskComplete {
  type: 'task.complete';
  taskId: string;
  result: {
    exitCode: number;
    output: string;
    changedFiles: string[];
    duration: number;
  };
}

export interface TaskCancel {
  type: 'task.cancel';
  taskId: string;
  reason: string;
}

export interface Ping {
  type: 'ping';
  timestamp: number;
}

export interface Pong {
  type: 'pong';
  timestamp: number;
}

export interface Ack {
  type: 'ack';
  originalMsgId: string;
  success: boolean;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
  details?: unknown;
}

export interface UnknownMessage {
  msgId?: string;
  type?: unknown;
  ts?: number;
  data?: unknown;
  raw: string;
}

export interface DecodedMessage {
  msgId: string;
  type: MessageType;
  ts: number;
  data: unknown;
}
