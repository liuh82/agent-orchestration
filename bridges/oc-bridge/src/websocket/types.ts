/**
 * Protocol message types — must match backend gateway_schemas.py + ws_server.py
 */

// ---- Outgoing: Bridge → Server ----

export interface AuthRequest {
  type: "auth.request";
  msgId: string;
  ts: number;
  data: {
    token: string;
    bridgeId: string;
  };
}

export interface BridgeRegister {
  type: "bridge.register";
  bridgeId: string;
  platform: string;
  hostname: string;
  osVersion: string;
  nodeVersion: string;
  bridgeVersion: string;
  adapters: AdapterInfo[];
  activeTasks: number;
  maxConcurrent: number;
}

export interface TaskAck {
  type: "task.ack";
  taskId: string;
  ts: number;
}

export interface TaskProgress {
  type: "task.progress";
  taskId: string;
  progress: number;
  ts: number;
}

export interface TaskComplete {
  type: "task.complete";
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  changedFiles?: string[];
  duration?: number;
  ts: number;
}

export interface Pong {
  type: "pong";
}

// ---- Incoming: Server → Bridge ----

export interface AuthResponse {
  type: "auth.response";
  msgId?: string;
  ts: number;
  data: {
    success: boolean;
    bridgeId?: string;
    error?: string;
  };
}

export interface BridgeRegistered {
  type: "bridge.registered";
  bridgeId: string;
  status: string;
  resumedTasks: ResumedTask[];
}

export interface TaskSubmit {
  type: "task.submit";
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: string;
  timeout: number;
  priority: string;
  preferredIde: string | null;
  skipPermissions?: boolean;
  allowedTools?: string[];
}

export interface TaskCancel {
  type: "task.cancel";
  taskId: string;
  reason: string;
}

export interface ServerPing {
  type: "ping";
}

export interface ServerError {
  type: "error";
  code: string;
  message: string;
}

// ---- Shared ----

export interface AdapterInfo {
  type: string;
  name: string;
  version: string;
  executablePath: string;
}

export interface ResumedTask {
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: string;
  status: string;
}

/** Union type for all incoming messages from server. */
export type ServerMessage =
  | AuthResponse
  | BridgeRegistered
  | TaskSubmit
  | TaskCancel
  | ServerPing
  | ServerError;
