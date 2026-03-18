import type { Node, Edge } from '@xyflow/react';

/* ================================================================
 *  Nexus Workflow Types — Schema v1
 *  13 node types: 3 triggers, 1 agent, 4 logic, 1 workflow, 3 data, 1 output
 * ================================================================ */

/* ── 1. Node Type Enum ── */

export type WorkflowNodeType =
  | 'manual_trigger'
  | 'cron_trigger'
  | 'webhook_trigger'
  | 'input'
  | 'agent'
  | 'if'
  | 'switch'
  | 'loop'
  | 'wait'
  | 'fork'
  | 'join'
  | 'sub_workflow'
  | 'http_request'
  | 'code'
  | 'transform'
  | 'output'
  | 'context_output'
  | 'result_output';

/* ── 2. Node Category ── */

export type NodeCategory = 'trigger' | 'agent' | 'logic' | 'workflow' | 'data' | 'output';

/* ── 3. Node Data Interfaces ── */

// --- Trigger Nodes ---

export interface ManualTriggerNodeData {
  label: string;
}

export interface CronTriggerNodeData {
  label: string;
  cronExpression: string;
  timezone?: string;
}

export interface WebhookTriggerNodeData {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  headers?: Record<string, string>;
}

// --- Input Node ---

export interface InputNodeData {
  label: string;
  source: 'project' | 'task' | 'manual' | 'upstream';
  fields: string[];
  includeFiles: boolean;
  template?: string;
  outputAlias: string;
}

// --- Agent Node ---

export interface AgentNodeData {
  label: string;
  agentId?: string;
  agentType?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  overridableFields?: string[];
  // Advanced settings
  maxRetries?: number;
  onError?: 'stop' | 'skip' | 'retry' | 'fallback';
  fallbackValue?: string;
  outputFilter?: string[];
  enableCache?: boolean;
  cacheTTL?: number;
  // Agent advanced fields (P0 additions)
  agentSelectMode?: 'select' | 'manual';
  workDir?: string;
  envVars?: string;
  outputFormat?: 'text' | 'json' | 'markdown';
  outputAlias?: string;
  gitEnabled?: boolean;
}

// --- Logic Nodes ---

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'regex'
  | 'empty'
  | 'not_empty';

export interface ConditionRule {
  field: string;
  operator: ConditionOperator;
  value: string;
}

export interface IfNodeData {
  label: string;
  conditions: ConditionRule[];
  logic: 'and' | 'or';
}

export interface SwitchCase {
  label: string;
  operator: string;
  value: string;
}

export interface SwitchNodeData {
  label: string;
  field: string;
  cases: SwitchCase[];
}

export interface LoopNodeData {
  label: string;
  loopType: 'count' | 'iterate';
  count?: number;
  listPath?: string;
  breakCondition?: string;
  maxIterations?: number;
}

export interface WaitNodeData {
  label: string;
  waitType: 'duration' | 'webhook';
  duration?: number;
}

// --- Workflow Node ---

export interface SubWorkflowParamMapping {
  sourcePath: string;
  targetVar: string;
}

export interface SubWorkflowOutputMapping {
  sourceField: string;
  targetVar: string;
}

export interface SubWorkflowNodeData {
  label: string;
  workflowId: string;
  workflowName?: string;
  parameterMapping?: SubWorkflowParamMapping[];
  outputMappings?: SubWorkflowOutputMapping[];
  maxDepth?: number;
  executionMode?: 'sync' | 'async';
  onError?: 'stop' | 'skip' | 'retry';
}

// --- Data Nodes ---

export interface HttpRequestNodeData {
  label: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    interval: number;
  };
}

export interface CodeNodeData {
  label: string;
  language: 'python' | 'javascript';
  code: string;
  timeout?: number;
}

export interface TransformMapping {
  targetVar: string;
  sourceExpression: string;
}

export interface TransformNodeData {
  label: string;
  mappings: TransformMapping[];
}

// --- Output Node ---

export interface OutputNodeData {
  label: string;
  format: 'json' | 'text' | 'markdown';
  outputPath?: string;
}

// --- Context Output Node ---

export interface ContextOutputTarget {
  field: 'summary' | 'notes' | 'context' | 'tags' | 'custom';
  source: string;
  template?: string;
}

export interface ContextOutputNodeData {
  label: string;
  targets: ContextOutputTarget[];
  appendMode: boolean;
}

// --- Result Output Node ---

export interface ResultOutputNodeData {
  label: string;
  outputFormat: 'json' | 'markdown' | 'plain_text' | 'structured';
  resultField: string;
  onComplete: 'mark_done' | 'mark_done_and_notify' | 'none';
}

/* ── 4. Node Data Union ── */

export type NodeData =
  | ManualTriggerNodeData
  | CronTriggerNodeData
  | WebhookTriggerNodeData
  | InputNodeData
  | AgentNodeData
  | IfNodeData
  | SwitchNodeData
  | LoopNodeData
  | WaitNodeData
  | SubWorkflowNodeData
  | HttpRequestNodeData
  | CodeNodeData
  | TransformNodeData
  | OutputNodeData
  | ContextOutputNodeData
  | ResultOutputNodeData;

/* ── 5. Handle Definitions ── */

export interface HandleDefinition {
  id: string;
  type: 'source' | 'target';
  label?: string;
}

export interface NodeHandleConfig {
  inputs: HandleDefinition[];
  outputs: HandleDefinition[];
}

/* ── 6. Node Meta ── */

export interface NodeMeta {
  type: WorkflowNodeType;
  label: string;
  category: NodeCategory;
  color: string;
  icon: string;
  defaultData: () => NodeData;
  handles: NodeHandleConfig;
}

/* ── 7. NODE_META Registry ── */

export const NODE_META: Record<WorkflowNodeType, NodeMeta> = {
  manual_trigger: {
    type: 'manual_trigger',
    label: '手动触发',
    category: 'trigger',
    color: '#22c55e',
    icon: 'PlayCircleOutlined',
    defaultData: (): ManualTriggerNodeData => ({
      label: '手动触发',
    }),
    handles: {
      inputs: [],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  cron_trigger: {
    type: 'cron_trigger',
    label: '定时触发',
    category: 'trigger',
    color: '#22c55e',
    icon: 'ClockCircleOutlined',
    defaultData: (): CronTriggerNodeData => ({
      label: '定时触发',
      cronExpression: '0 * * * *',
      timezone: 'UTC',
    }),
    handles: {
      inputs: [],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  webhook_trigger: {
    type: 'webhook_trigger',
    label: 'Webhook 触发',
    category: 'trigger',
    color: '#22c55e',
    icon: 'ApiOutlined',
    defaultData: (): WebhookTriggerNodeData => ({
      label: 'Webhook 触发',
      method: 'POST',
      path: '/webhook/my-workflow',
      headers: {},
    }),
    handles: {
      inputs: [],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  input: {
    type: 'input',
    label: '输入',
    category: 'trigger' as NodeCategory,
    color: '#06b6d4',
    icon: 'FolderOpenOutlined',
    defaultData: (): InputNodeData => ({
      label: '输入',
      source: 'project',
      fields: ['title', 'description'],
      includeFiles: true,
      outputAlias: 'input',
    }),
    handles: {
      inputs: [],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  agent: {
    type: 'agent',
    label: 'Agent',
    category: 'agent',
    color: '#3b82f6',
    icon: 'RobotOutlined',
    defaultData: (): AgentNodeData => ({
      label: 'Agent',
      prompt: '',
      temperature: 0.7,
      maxTokens: 4096,
      timeout: 300,
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  if: {
    type: 'if',
    label: 'IF 条件',
    category: 'logic',
    color: '#f59e0b',
    icon: 'BranchesOutlined',
    defaultData: (): IfNodeData => ({
      label: 'IF 条件',
      conditions: [],
      logic: 'and',
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [
        { id: 'true', type: 'source', label: 'True' },
        { id: 'false', type: 'source', label: 'False' },
      ],
    },
  },

  switch: {
    type: 'switch',
    label: 'Switch',
    category: 'logic',
    color: '#f59e0b',
    icon: 'ApartmentOutlined',
    defaultData: (): SwitchNodeData => ({
      label: 'Switch',
      field: '',
      cases: [],
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'default', type: 'source', label: 'Default' }],
    },
  },

  loop: {
    type: 'loop',
    label: '循环',
    category: 'logic',
    color: '#f59e0b',
    icon: 'ReloadOutlined',
    defaultData: (): LoopNodeData => ({
      label: '循环',
      loopType: 'count',
      count: 10,
      maxIterations: 100,
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [
        { id: 'body', type: 'source', label: 'Body' },
        { id: 'done', type: 'source', label: 'Done' },
      ],
    },
  },

  wait: {
    type: 'wait',
    label: '等待',
    category: 'logic',
    color: '#f59e0b',
    icon: 'HourglassOutlined',
    defaultData: (): WaitNodeData => ({
      label: '等待',
      waitType: 'duration',
      duration: 60,
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  fork: {
    type: 'fork' as const,
    label: 'Fork',
    category: 'logic' as const,
    color: '#3b82f6',
    icon: 'BranchesOutlined',
    defaultData: () => ({
      label: 'Fork',
      mode: 'broadcast' as const,
      branchCount: 2,
      branchData: [] as Array<{ label: string; data: string }>,
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [
        { id: 'branch_0', type: 'source' },
        { id: 'branch_1', type: 'source' },
      ],
    },
  },
  join: {
    type: 'join' as const,
    label: 'Join',
    category: 'logic' as const,
    color: '#3b82f6',
    icon: 'ApartmentOutlined',
    defaultData: () => ({
      label: 'Join',
      mode: 'all' as const,
      mergeStrategy: 'append' as const,
      timeout: 3600,
      onTimeout: 'continue_with_ready' as const,
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  sub_workflow: {
    type: 'sub_workflow',
    label: '子工作流',
    category: 'workflow',
    color: '#8b5cf6',
    icon: 'ForkOutlined',
    defaultData: (): SubWorkflowNodeData => ({
      label: '子工作流',
      workflowId: '',
      parameterMapping: [],
      outputMappings: [],
      maxDepth: 5,
      executionMode: 'sync',
      onError: 'stop',
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  http_request: {
    type: 'http_request',
    label: 'HTTP 请求',
    category: 'data',
    color: '#06b6d4',
    icon: 'GlobalOutlined',
    defaultData: (): HttpRequestNodeData => ({
      label: 'HTTP 请求',
      url: '',
      method: 'GET',
      timeout: 30,
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  code: {
    type: 'code',
    label: '代码执行',
    category: 'data',
    color: '#06b6d4',
    icon: 'CodeOutlined',
    defaultData: (): CodeNodeData => ({
      label: '代码执行',
      language: 'python',
      code: '',
      timeout: 60,
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  transform: {
    type: 'transform',
    label: '数据转换',
    category: 'data',
    color: '#06b6d4',
    icon: 'SwapOutlined',
    defaultData: (): TransformNodeData => ({
      label: '数据转换',
      mappings: [],
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  output: {
    type: 'output',
    label: '输出',
    category: 'output',
    color: '#ec4899',
    icon: 'SendOutlined',
    defaultData: (): OutputNodeData => ({
      label: '输出',
      format: 'json',
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [],
    },
  },

  context_output: {
    type: 'context_output',
    label: '上下文输出',
    category: 'output' as NodeCategory,
    color: '#f59e0b',
    icon: 'FileTextOutlined',
    defaultData: (): ContextOutputNodeData => ({
      label: '上下文输出',
      targets: [],
      appendMode: true,
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },

  result_output: {
    type: 'result_output',
    label: '结果输出',
    category: 'output' as NodeCategory,
    color: '#10b981',
    icon: 'CheckCircleOutlined',
    defaultData: (): ResultOutputNodeData => ({
      label: '结果输出',
      outputFormat: 'markdown',
      resultField: 'result',
      onComplete: 'mark_done',
    }),
    handles: {
      inputs: [{ id: 'source', type: 'target' }],
      outputs: [{ id: 'target', type: 'source' }],
    },
  },
};

/* ── 7b. Edge Data & Type Rules ── */

export interface CustomEdgeData {
  label?: string;
  edgeType?: 'normal' | 'conditional' | 'parallel' | 'loop';
  animated?: boolean;
  color?: string;
  sourceNodeType?: string;
  sourceHandle?: string;
}

export const EDGE_TYPE_RULES: Record<string, CustomEdgeData['edgeType']> = {
  if: 'conditional',
  switch: 'conditional',
  parallel: 'parallel',
  fork: 'parallel',
  join: 'parallel',
  loop: 'loop',
};

/* ── 8. Node Categories (for sidebar panel) ── */

export interface NodeCategoryDef {
  key: NodeCategory;
  label: string;
  color: string;
  nodeTypes: WorkflowNodeType[];
}

export const NODE_CATEGORIES: NodeCategoryDef[] = [
  {
    key: 'trigger',
    label: '触发器',
    color: '#22c55e',
    nodeTypes: ['manual_trigger', 'cron_trigger', 'webhook_trigger', 'input'],
  },
  {
    key: 'agent',
    label: 'Agent',
    color: '#3b82f6',
    nodeTypes: ['agent'],
  },
  {
    key: 'logic',
    label: '逻辑控制',
    color: '#f59e0b',
    nodeTypes: ['if', 'switch', 'loop', 'wait', 'fork', 'join'],
  },
  {
    key: 'workflow',
    label: '工作流',
    color: '#8b5cf6',
    nodeTypes: ['sub_workflow'],
  },
  {
    key: 'data',
    label: '数据',
    color: '#06b6d4',
    nodeTypes: ['http_request', 'code', 'transform'],
  },
  {
    key: 'output',
    label: '输出',
    color: '#ec4899',
    nodeTypes: ['output', 'context_output', 'result_output'],
  },
];

/* ── 9. Workflow Core Types ── */

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: {
    x: number;
    y: number;
  };
  data: NodeData;
  disabled?: boolean;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowConfig {
  timeout?: number;
  retryPolicy?: {
    maxRetries?: number;
    interval?: number;
  };
  errorStrategy?: 'stop_all' | 'continue' | 'notify';
  maxParallel?: number;
}

export interface WorkflowDefinition {
  version: '1.0';
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, unknown>;
  config: WorkflowConfig;
}

/* ── 10. React Flow Compatibility Types ── */

/** @xyflow/react Node requires Record<string, unknown> constraint, so we intersect */
export type NodeDataRf = NodeData & Record<string, unknown>;
export type ReactFlowNode = Node<NodeDataRf, WorkflowNodeType>;
export type ReactFlowEdge = Edge;

/* ── 11. Execution Types ── */

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type NodeRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting';

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

/* ── 12. WebSocket Event Types ── */

export interface WsNodeStatusEvent {
  type: 'node.status_changed';
  node_id: string;
  status: NodeRunStatus;
  output?: unknown;
  error?: string;
  duration_ms?: number;
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
  error?: string;
}

export interface WsExecutionProgressEvent {
  type: 'execution.progress';
  current_node: string;
  completed_nodes: number;
  total_nodes: number;
}

export type WsEvent =
  | WsNodeStatusEvent
  | WsNodeOutputEvent
  | WsNodeLogEvent
  | WsHumanInterventionEvent
  | WsExecutionStatusEvent
  | WsExecutionProgressEvent;
