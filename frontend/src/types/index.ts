// API 响应格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

// Agent 相关类型
export interface Agent {
  id: string;
  name: string;
  type: 'claude-code' | 'custom' | 'lobster';
  status: 'online' | 'offline' | 'busy';
  model: string;
  timeout: number;
  skills: string[];
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
  lastSeen?: string;
}

// 工作流相关类型
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  engine: 'lobster' | 'openviking' | 'temporal' | 'custom';
  definition: any;
  config: {
    timeout: number;
    retryPolicy: RetryPolicy;
    approvalGates: ApprovalGate[];
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// 工作流模板
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  engine: WorkflowEngineType;
  category: 'development' | 'deployment' | 'custom';
  definition: any;
}

// 任务相关类型
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  workflowId?: string;
  input: any;
  output: any;
  logs: LogEntry[];
}

// 重试策略
export interface RetryPolicy {
  maxAttempts: number;
  delay: number;
  backoff: 'linear' | 'exponential';
}

// 审批门禁
export interface ApprovalGate {
  id: string;
  name: string;
  description: string;
  approvers: string[];
  condition: string;
  type: 'automatic' | 'manual';
}

// 工作流引擎类型
export type WorkflowEngineType = 'lobster' | 'openviking' | 'temporal' | 'custom';

// 日志条目
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

// 执行上下文
export interface ExecutionContext {
  projectId: string;
  variables: Record<string, any>;
  inputData: any;
  metadata: {
    userId: string;
    requestId: string;
    startTime: string;
  };
}

// 执行结果
export interface ExecutionResult {
  success: boolean;
  output: any;
  logs: LogEntry[];
  executionTime: number;
  status: 'completed' | 'failed' | 'cancelled' | 'paused';
}

// 执行状态
export interface ExecutionStatus {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  startTime: string;
  endTime?: string;
  progress: number;
  currentStep: string;
  logs: LogEntry[];
}