import type { Node, Edge } from '@xyflow/react';

/* ── 节点类型枚举 ── */

export type WorkflowNodeType =
  | 'agent'
  | 'condition'
  | 'human'
  | 'parallel'
  | 'transform'
  | 'notification'
  | 'timer';

export const NODE_TYPE_OPTIONS: { value: WorkflowNodeType; label: string; icon: string; color: string }[] = [
  { value: 'agent', label: 'Agent', icon: 'RobotOutlined', color: '#3b82f6' },
  { value: 'condition', label: '条件判断', icon: 'BranchesOutlined', color: '#f59e0b' },
  { value: 'human', label: '人工干预', icon: 'UserOutlined', color: '#f97316' },
  { value: 'parallel', label: '并行执行', icon: 'ApartmentOutlined', color: '#8b5cf6' },
  { value: 'transform', label: '数据转换', icon: 'SwapOutlined', color: '#06b6d4' },
  { value: 'notification', label: '通知', icon: 'BellOutlined', color: '#10b981' },
  { value: 'timer', label: '定时器', icon: 'ClockCircleOutlined', color: '#ec4899' },
];

export const NODE_TYPE_LABEL_MAP: Record<string, string> = {
  agent: 'Agent',
  condition: '条件判断',
  human: '人工干预',
  parallel: '并行执行',
  transform: '数据转换',
  notification: '通知',
  timer: '定时器',
};

/* ── 自定义节点数据 ── */

export interface AgentNodeData {
  label: string;
  nodeType: 'agent';
  agentId?: string;
  agentName?: string;
  model?: string;
  prompt?: string;
  timeout?: number;
  [key: string]: unknown;
}

export interface ConditionNodeData {
  label: string;
  nodeType: 'condition';
  expression?: string;
  trueLabel?: string;
  falseLabel?: string;
  [key: string]: unknown;
}

export interface HumanNodeData {
  label: string;
  nodeType: 'human';
  description?: string;
  approvers?: string[];
  [key: string]: unknown;
}

export interface ParallelNodeData {
  label: string;
  nodeType: 'parallel';
  branches?: number;
  [key: string]: unknown;
}

export interface TransformNodeData {
  label: string;
  nodeType: 'transform';
  transformType?: string;
  description?: string;
  [key: string]: unknown;
}

export interface NotificationNodeData {
  label: string;
  nodeType: 'notification';
  channelId?: string;
  channelName?: string;
  message?: string;
  [key: string]: unknown;
}

export interface TimerNodeData {
  label: string;
  nodeType: 'timer';
  cronExpression?: string;
  interval?: number;
  [key: string]: unknown;
}

export type WorkflowNodeData =
  | AgentNodeData
  | ConditionNodeData
  | HumanNodeData
  | ParallelNodeData
  | TransformNodeData
  | NotificationNodeData
  | TimerNodeData;

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

/* ── 工作流定义 ── */

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  definition: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  status: 'draft' | 'active' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/* ── 执行实例 ── */

export type ExecutionStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type NodeRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  nodeStates: Record<string, NodeRunStatus>;
  createdAt: string;
}

/* ── 模板 ── */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  definition: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  createdAt: string;
}

/* ── 节点类型 API schema ── */

export interface NodeTypeSchema {
  type: WorkflowNodeType;
  name: string;
  icon: string;
  color: string;
  config_schema: Record<string, unknown>;
}

/* ── WebSocket 事件 ── */

export interface WsNodeStatusEvent {
  type: 'node.status_changed';
  node_id: string;
  status: NodeRunStatus;
}

export interface WsNodeOutputEvent {
  type: 'node.output';
  node_id: string;
  output: unknown;
}

export interface WsNodeLogEvent {
  type: 'node.log';
  node_id: string;
  message: string;
  timestamp: string;
  level: string;
}

export interface WsHumanInterventionEvent {
  type: 'human_intervention.required';
  node_id: string;
  context: string;
}

export interface WsExecutionStatusEvent {
  type: 'execution.status_changed';
  status: ExecutionStatus;
}

export type WsEvent =
  | WsNodeStatusEvent
  | WsNodeOutputEvent
  | WsNodeLogEvent
  | WsHumanInterventionEvent
  | WsExecutionStatusEvent;
