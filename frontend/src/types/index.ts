// Barrel export — 新类型系统

export type { ApiResponse, PagedData } from './api';
export type { User, LoginRequest, RegisterRequest, TokenResponse } from './auth';
export type { AgentType, AgentConfig, AgentInstance } from './agent';
export type { Project } from './project';
export type { Task } from './task';
export type { Job } from './job';
export type { DashboardStats } from './stats';

// Legacy: PaginatedData alias
export type { PagedData as PaginatedData } from './api';

// Legacy: Agent alias (old pages use `Agent` instead of `AgentInstance`)
export type { AgentInstance as Agent } from './agent';
export type { Bridge, BridgeTask, BridgeCreateResponse } from './bridge';

// Legacy types for old pages that haven't been migrated yet

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

export interface Heartbeat {
  id: string;
  name: string;
  description: string | null;
  actionType: string;
  actionParams: Record<string, unknown> | null;
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
  result: Record<string, unknown> | null;
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

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  engine: 'lobster' | 'openviking' | 'temporal' | 'custom';
  definition: unknown;
  config: {
    timeout: number;
    retryPolicy: RetryPolicy;
    approvalGates: ApprovalGate[];
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  engine: 'lobster' | 'openviking' | 'temporal' | 'custom';
  category: 'development' | 'deployment' | 'custom';
  definition: unknown;
}

export interface RetryPolicy {
  maxAttempts: number;
  delay: number;
  backoff: 'linear' | 'exponential';
}

export interface ApprovalGate {
  id: string;
  name: string;
  description: string;
  approvers: string[];
  condition: string;
  type: 'automatic' | 'manual';
}
