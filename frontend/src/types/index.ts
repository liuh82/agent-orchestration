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

// ==================== Org 相关类型 ====================
export interface OrgNode {
  id: string;
  name: string;
  title: string;
  department: string;
  level: number;
  parentId: string | null;
  childrenIds: string[];
  children?: OrgNode[];
  email?: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string | null;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  departmentId: string;
  position: string;
  roleIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'active' | 'completed' | 'archived';
  ownerId: string;
  departmentId: string | null;
  dueDate: string | null;
  progress: number;
  tags: string[];
  metrics: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  title: string;
  type: string;
  content: string;
  requesterId: string;
  approverIds: string[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  priority: string;
  dueDate: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  approvalHistory: ApprovalHistory[];
}

export interface ApprovalHistory {
  id: string;
  approvalId: string;
  action: string;
  actorId: string;
  actorName: string;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  type: string;
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  userName: string;
  departmentId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestData: string | null;
  responseData: string | null;
  statusCode: number;
  errorMessage: string | null;
  durationMs: number | null;
  metadata: string | null;
  createdAt: string;
}

// ==================== Heartbeats 相关类型 ====================
export interface Heartbeat {
  id: string;
  name: string;
  description: string | null;
  actionType: string;
  actionParams: Record<string, any> | null;
  intervalSeconds: number;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HeartbeatLog {
  id: string;
  heartbeatId: string;
  status: 'running' | 'success' | 'failed';
  result: Record<string, any> | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface HeartbeatStats {
  total: number;
  active: number;
  inactive: number;
  failed24h: number;
}