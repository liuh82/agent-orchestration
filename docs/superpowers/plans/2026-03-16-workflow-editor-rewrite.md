# Workflow Editor Rewrite (T8) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely rewrite the workflow editor to support 13 node types with Schema v1 data format, following n8n-style interaction patterns.

**Architecture:** 7-step sequential refactoring: types → store → node panel → node components → canvas → config panel → workflow management. Each step is independently verifiable. Data flows from React Flow canvas ↔ Zustand store ↔ Schema v1 JSON.

**Tech Stack:** React 18 + TypeScript + @xyflow/react + Zustand + styled-components + Ant Design 5 + dagre

**Spec docs:** `docs/dev-prompts/v2/task-t8-workflow-editor.md` + `docs/dev-prompts/v2/workflow-schema-v1.md`

---

## Chunk 1: Types & Node Metadata

### Task 1: Rewrite `frontend/src/types/workflow.ts`

**Files:**
- Rewrite: `frontend/src/types/workflow.ts`

- [ ] **Step 1: Write the complete type definitions**

Replace the entire file with Schema v1 aligned types. Key changes:

```typescript
import type { Node, Edge } from '@xyflow/react';

/* ── 节点类型枚举（13 种，严格对齐 Schema v1 §2） ── */
export type WorkflowNodeType =
  | 'manual_trigger'
  | 'cron_trigger'
  | 'webhook_trigger'
  | 'agent'
  | 'if'
  | 'switch'
  | 'loop'
  | 'wait'
  | 'sub_workflow'
  | 'http_request'
  | 'code'
  | 'transform'
  | 'output';

/* ── 节点 data 接口（严格对齐 Schema v1 §3） ── */

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
}

export interface IfNodeData {
  label: string;
  conditions: {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'regex' | 'empty' | 'not_empty';
    value: string;
  }[];
  logic: 'and' | 'or';
}

export interface SwitchNodeData {
  label: string;
  field: string;
  cases: {
    label: string;
    operator: string;
    value: string;
  }[];
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

export interface SubWorkflowNodeData {
  label: string;
  workflowId: string;
  workflowName?: string;
  parameterMapping?: {
    sourcePath: string;
    targetVar: string;
  }[];
  maxDepth?: number;
}

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

export interface TransformNodeData {
  label: string;
  mappings: {
    targetVar: string;
    sourceExpression: string;
  }[];
}

export interface OutputNodeData {
  label: string;
  format: 'json' | 'text' | 'markdown';
  outputPath?: string;
}

export type NodeData =
  | ManualTriggerNodeData
  | CronTriggerNodeData
  | WebhookTriggerNodeData
  | AgentNodeData
  | IfNodeData
  | SwitchNodeData
  | LoopNodeData
  | WaitNodeData
  | SubWorkflowNodeData
  | HttpRequestNodeData
  | CodeNodeData
  | TransformNodeData
  | OutputNodeData;

/* ── 节点 / 连线 / 配置 / 定义（Schema v1 §1-4） ── */

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
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

/* ── React Flow 兼容类型 ── */
export type ReactFlowNode = Node<NodeData>;
export type ReactFlowEdge = Edge;

/* ── 节点分类与元信息 ── */

export type NodeCategory = 'trigger' | 'agent' | 'logic' | 'workflow' | 'data' | 'output';

export interface NodeMeta {
  type: WorkflowNodeType;
  label: string;
  category: NodeCategory;
  color: string;
  icon: string; // Ant Design icon component name
  defaultData: () => NodeData;
  handles: {
    input?: string;
    outputs: string[];
  };
}

export const NODE_META: Record<WorkflowNodeType, NodeMeta> = {
  manual_trigger: {
    type: 'manual_trigger',
    label: '手动触发',
    category: 'trigger',
    color: '#22c55e',
    icon: 'PlayCircleOutlined',
    defaultData: () => ({ label: '手动触发' }),
    handles: { outputs: ['target'] },
  },
  cron_trigger: {
    type: 'cron_trigger',
    label: '定时触发',
    category: 'trigger',
    color: '#22c55e',
    icon: 'ClockCircleOutlined',
    defaultData: () => ({ label: '定时触发', cronExpression: '0 * * * *' }),
    handles: { outputs: ['target'] },
  },
  webhook_trigger: {
    type: 'webhook_trigger',
    label: 'Webhook 触发',
    category: 'trigger',
    color: '#22c55e',
    icon: 'ApiOutlined',
    defaultData: () => ({ label: 'Webhook 触发', method: 'POST', path: '/webhook' }),
    handles: { outputs: ['target'] },
  },
  agent: {
    type: 'agent',
    label: 'Agent 执行',
    category: 'agent',
    color: '#3b82f6',
    icon: 'RobotOutlined',
    defaultData: () => ({ label: 'Agent', prompt: '' }),
    handles: { input: 'target', outputs: ['source'] },
  },
  if: {
    type: 'if',
    label: 'IF 条件',
    category: 'logic',
    color: '#f59e0b',
    icon: 'BranchesOutlined',
    defaultData: () => ({ label: 'IF 条件', conditions: [{ field: '', operator: 'eq', value: '' }], logic: 'and' }),
    handles: { input: 'target', outputs: ['true', 'false'] },
  },
  switch: {
    type: 'switch',
    label: 'Switch 多路',
    category: 'logic',
    color: '#f59e0b',
    icon: 'ApartmentOutlined',
    defaultData: () => ({ label: 'Switch', field: '', cases: [{ label: 'Case 1', operator: 'eq', value: '' }] }),
    handles: { input: 'target', outputs: ['case_0', 'default'] },
  },
  loop: {
    type: 'loop',
    label: '循环',
    category: 'logic',
    color: '#f59e0b',
    icon: 'ReloadOutlined',
    defaultData: () => ({ label: '循环', loopType: 'count', count: 10, maxIterations: 100 }),
    handles: { input: 'target', outputs: ['body', 'done'] },
  },
  wait: {
    type: 'wait',
    label: '等待',
    category: 'logic',
    color: '#f59e0b',
    icon: 'HourglassOutlined',
    defaultData: () => ({ label: '等待', waitType: 'duration', duration: 60 }),
    handles: { input: 'target', outputs: ['source'] },
  },
  sub_workflow: {
    type: 'sub_workflow',
    label: '子工作流',
    category: 'workflow',
    color: '#8b5cf6',
    icon: 'ForkOutlined',
    defaultData: () => ({ label: '子工作流', workflowId: '' }),
    handles: { input: 'target', outputs: ['source'] },
  },
  http_request: {
    type: 'http_request',
    label: 'HTTP 请求',
    category: 'data',
    color: '#06b6d4',
    icon: 'GlobalOutlined',
    defaultData: () => ({ label: 'HTTP 请求', url: '', method: 'GET' }),
    handles: { input: 'target', outputs: ['source'] },
  },
  code: {
    type: 'code',
    label: '代码执行',
    category: 'data',
    color: '#06b6d4',
    icon: 'CodeOutlined',
    defaultData: () => ({ label: '代码执行', language: 'python', code: '' }),
    handles: { input: 'target', outputs: ['source'] },
  },
  transform: {
    type: 'transform',
    label: '数据转换',
    category: 'data',
    color: '#06b6d4',
    icon: 'SwapOutlined',
    defaultData: () => ({ label: '数据转换', mappings: [{ targetVar: '', sourceExpression: '' }] }),
    handles: { input: 'target', outputs: ['source'] },
  },
  output: {
    type: 'output',
    label: '输出',
    category: 'output',
    color: '#ec4899',
    icon: 'SendOutlined',
    defaultData: () => ({ label: '输出', format: 'json' }),
    handles: { input: 'target', outputs: [] },
  },
};

export const NODE_CATEGORIES: { key: NodeCategory; label: string }[] = [
  { key: 'trigger', label: '触发器' },
  { key: 'agent', label: 'Agent' },
  { key: 'logic', label: '逻辑控制' },
  { key: 'workflow', label: '工作流' },
  { key: 'data', label: '数据' },
  { key: 'output', label: '输出' },
];

/* ── 执行状态（保留现有，T9 引擎用） ── */
export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'waiting' | 'completed' | 'failed' | 'cancelled';
export type NodeRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';

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

/* ── WebSocket 事件（保留现有） ── */
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

export type WsEvent = WsNodeStatusEvent | WsNodeOutputEvent | WsNodeLogEvent;
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /Users/lh8/projects/agent-orchestration/frontend && npx tsc --noEmit`
Expected: No errors from workflow.ts itself (other files may have errors due to removed types — fix next task)

---

## Chunk 2: Zustand Store

### Task 2: Rewrite `frontend/src/stores/useWorkflowStore.ts`

**Files:**
- Rewrite: `frontend/src/stores/useWorkflowStore.ts`

- [ ] **Step 1: Rewrite the store**

Key changes from current:
1. Use `ReactFlowNode` / `ReactFlowEdge` from new types
2. Add `saveDefinition()` → returns Schema v1 JSON string
3. Add `loadDefinition(json)` → parses Schema v1 JSON string into store
4. Add `duplicateNode(nodeId)`
5. Add `deleteSelected()`
6. Keep existing undo/redo logic
7. Add `description`, `variables`, `config` fields for Schema v1
8. Remove MonitorStore (separate concern)

```typescript
import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData, WorkflowDefinition, WorkflowConfig, WorkflowEdge, WorkflowNode } from '@/types/workflow';

interface WorkflowEditorState {
  workflowId: string | null;
  workflowName: string;
  workflowDescription: string;
  variables: Record<string, unknown>;
  config: WorkflowConfig;
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeIds: string[];
  history: { nodes: Node<NodeData>[]; edges: Edge[] }[];
  historyIndex: number;

  // Setters
  setWorkflowId: (id: string | null) => void;
  setWorkflowName: (name: string) => void;
  setWorkflowDescription: (desc: string) => void;
  setVariables: (vars: Record<string, unknown>) => void;
  setConfig: (config: WorkflowConfig) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;

  // Node CRUD
  addNode: (node: Node<NodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  removeNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;

  // Edge CRUD
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;

  // Selection
  setSelectedNodeIds: (ids: string[]) => void;
  deleteSelected: () => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Schema v1 serialization
  saveDefinition: () => WorkflowDefinition;
  loadDefinition: (json: string) => void;

  // Reset
  reset: () => void;
}

const MAX_HISTORY = 50;

export const useWorkflowStore = create<WorkflowEditorState>((set, get) => ({
  workflowId: null,
  workflowName: '',
  workflowDescription: '',
  variables: {},
  config: {},
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  history: [],
  historyIndex: -1,

  setWorkflowId: (id) => set({ workflowId: id }),
  setWorkflowName: (name) => set({ workflowName: name }),
  setWorkflowDescription: (desc) => set({ workflowDescription: desc }),
  setVariables: (vars) => set({ variables: vars }),
  setConfig: (config) => set({ config }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) => {
    get().pushHistory();
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  updateNodeData: (nodeId, data) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }));
  },

  removeNode: (nodeId) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
    }));
  },

  duplicateNode: (nodeId) => {
    const { nodes, pushHistory } = get();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    pushHistory();
    const newNode: Node<NodeData> = {
      ...node,
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      data: { ...node.data, label: `${node.data.label} (副本)` },
      selected: false,
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
  },

  addEdge: (edge) => {
    get().pushHistory();
    set((state) => ({ edges: [...state.edges, edge] }));
  },

  removeEdge: (edgeId) => {
    get().pushHistory();
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }));
  },

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

  deleteSelected: () => {
    const { selectedNodeIds, pushHistory } = get();
    if (selectedNodeIds.length === 0) return;
    pushHistory();
    set((state) => {
      const idSet = new Set(selectedNodeIds);
      return {
        nodes: state.nodes.filter((n) => !idSet.has(n.id)),
        edges: state.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
        selectedNodeIds: [],
      };
    });
  },

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    set({
      nodes: structuredClone(prev.nodes),
      edges: structuredClone(prev.edges),
      historyIndex: historyIndex - 1,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    set({
      nodes: structuredClone(next.nodes),
      edges: structuredClone(next.edges),
      historyIndex: historyIndex + 1,
    });
  },

  saveDefinition: () => {
    const { workflowName, workflowDescription, nodes, edges, variables, config } = get();
    const schemaNodes: WorkflowNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.type as WorkflowNode['type'],
      position: n.position,
      data: n.data,
      disabled: n.disabled,
    }));
    const schemaEdges: WorkflowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: e.label ?? undefined,
    }));
    return {
      version: '1.0',
      name: workflowName || '未命名工作流',
      description: workflowDescription,
      nodes: schemaNodes,
      edges: schemaEdges,
      variables: Object.keys(variables).length > 0 ? variables : undefined,
      config,
    };
  },

  loadDefinition: (json: string) => {
    try {
      const def: WorkflowDefinition = JSON.parse(json);
      const rfNodes: Node<NodeData>[] = def.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        disabled: n.disabled,
      }));
      const rfEdges: Edge[] = def.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: 'smoothstep',
        animated: true,
        style: { strokeWidth: 2 },
      }));
      set({
        workflowName: def.name,
        workflowDescription: def.description,
        variables: def.variables ?? {},
        config: def.config ?? {},
        nodes: rfNodes,
        edges: rfEdges,
        selectedNodeIds: [],
        history: [{ nodes: structuredClone(rfNodes), edges: structuredClone(rfEdges) }],
        historyIndex: 0,
      });
    } catch (err) {
      console.error('Failed to parse workflow definition:', err);
    }
  },

  reset: () => set({
    workflowId: null,
    workflowName: '',
    workflowDescription: '',
    variables: {},
    config: {},
    nodes: [],
    edges: [],
    selectedNodeIds: [],
    history: [],
    historyIndex: -1,
  }),
}));

/* ── Monitor store（独立） ── */

interface WorkflowMonitorState {
  nodeStates: Record<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting'>;
  executionStatus: string;
  logs: Array<{ node_id: string; message: string; timestamp: string; level: string }>;

  setNodeState: (nodeId: string, status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting') => void;
  setExecutionStatus: (status: string) => void;
  appendLog: (log: { node_id: string; message: string; timestamp: string; level: string }) => void;
  reset: () => void;
}

export const useWorkflowMonitorStore = create<WorkflowMonitorState>((set) => ({
  nodeStates: {},
  executionStatus: 'running',
  logs: [],

  setNodeState: (nodeId, status) =>
    set((state) => ({ nodeStates: { ...state.nodeStates, [nodeId]: status } })),

  setExecutionStatus: (status) => set({ executionStatus: status }),

  appendLog: (log) =>
    set((state) => ({ logs: [...state.logs, log] })),

  reset: () => set({ nodeStates: {}, executionStatus: 'running', logs: [] }),
}));
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /Users/lh8/projects/agent-orchestration/frontend && npx tsc --noEmit 2>&1 | head -30`

---

## Chunk 3: Node Components

### Task 3: Create shared styled components for dark theme nodes

**Files:**
- Create: `frontend/src/components/workflow/nodes/node-styles.ts`

- [ ] **Step 1: Create shared node styles**

Define styled components used by all 13 node types. Dark theme colors from the task spec:
- Background: `#1e293b`, Border: `#334155`
- Selected: `#3b82f6`
- Text: white/gray

```typescript
import styled, { keyframes } from 'styled-components';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';

export const NODE_BG = '#1e293b';
export const NODE_BORDER = '#334155';
export const NODE_BORDER_SELECTED = '#3b82f6';
export const NODE_TEXT = '#f1f5f9';
export const NODE_TEXT_SECONDARY = '#94a3b8';
export const NODE_TEXT_MUTED = '#64748b';

export const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
  50% { box-shadow: 0 0 0 6px rgba(59,130,246,0); }
`;

export const NodeWrapper = styled.div<{ $color: string; $selected?: boolean; $disabled?: boolean; $isTrigger?: boolean }>`
  min-width: 180px;
  min-height: 60px;
  background: ${NODE_BG};
  border: 2px solid ${({ $color, $selected }) =>
    $selected ? NODE_BORDER_SELECTED : $isTrigger ? $color : NODE_BORDER};
  border-radius: ${radius.lg};
  box-shadow: ${({ $selected }) =>
    $selected ? `0 0 0 2px ${NODE_BORDER_SELECTED}40, 0 4px 12px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.2)'};
  padding: ${spacing[2]} ${spacing[3]};
  display: flex;
  flex-direction: column;
  gap: ${spacing[1]};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  border-style: ${({ $disabled }) => ($disabled ? 'dashed' : 'solid')};
  transition: border-color 0.15s, box-shadow 0.15s;
`;

export const NodeHeader = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.semibold};
  color: ${NODE_TEXT};
`;

export const NodeIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${radius.md};
  background: ${({ $color }) => `${$color}20`};
  color: ${({ $color }) => $color};
  font-size: 14px;
  flex-shrink: 0;
`;

export const NodeLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
`;

export const NodeDescription = styled.div`
  font-size: 11px;
  color: ${NODE_TEXT_SECONDARY};
  font-family: ${typography.fontFamily.mono};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
`;

export const HandleLabel = styled.span`
  position: absolute;
  font-size: 10px;
  color: ${NODE_TEXT_MUTED};
  pointer-events: none;
  white-space: nowrap;
`;

export const handleStyle = (color: string) => ({
  background: color,
  width: 10,
  height: 10,
  border: '2px solid #1e293b',
});

export const inputHandleStyle = {
  background: '#64748b',
  width: 10,
  height: 10,
  border: '2px solid #1e293b',
};
```

### Task 4: Create BaseNode component

**Files:**
- Rewrite: `frontend/src/components/workflow/nodes/BaseNode.tsx`

- [ ] **Step 1: Rewrite BaseNode**

```typescript
import { memo, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeWrapper, NodeHeader, NodeIcon, NodeLabel, NodeDescription, inputHandleStyle, handleStyle } from './node-styles';
import type { NodeData } from '@/types/workflow';
import { NODE_META } from '@/types/workflow';

interface BaseNodeProps {
  id: string;
  data: NodeData;
  selected?: boolean;
  type: string;
  disabled?: boolean;
  icon?: ReactNode;
  description?: string;
  /** Extra source handles (for multi-output nodes) */
  extraSourceHandles?: Array<{ id: string; label: string; color: string; position?: 'left' | 'right' | 'top' | 'bottom' }>;
  /** Whether this node has NO input handle (triggers) */
  noInput?: boolean;
}

export const BaseNode = memo(({
  data, selected, type, disabled, icon, description, extraSourceHandles, noInput,
}: BaseNodeProps) => {
  const meta = NODE_META[type as keyof typeof NODE_META];
  const color = meta?.color ?? '#64748b';
  const isTrigger = meta?.category === 'trigger';

  return (
    <NodeWrapper $color={color} $selected={selected} $disabled={disabled} $isTrigger={isTrigger}>
      {!noInput && (
        <Handle type="target" position={Position.Top} style={inputHandleStyle} />
      )}
      <NodeHeader $color={color}>
        <NodeIcon $color={color}>{icon}</NodeIcon>
        <NodeLabel>{(data as any).label || meta?.label || type}</NodeLabel>
      </NodeHeader>
      {description && <NodeDescription>{description}</NodeDescription>}

      {/* Default single output handle (bottom center) */}
      {!extraSourceHandles && meta?.handles.outputs.length > 0 && (
        <Handle
          type="source"
          position={Position.Bottom}
          id={meta.handles.outputs[0]}
          style={handleStyle(color)}
        />
      )}

      {/* Multi-output handles */}
      {extraSourceHandles?.map((h, i) => {
        const total = extraSourceHandles.length;
        const leftPercent = total === 1 ? 50 : (i + 1) * (100 / (total + 1));
        return (
          <div key={h.id} style={{ position: 'relative' }}>
            <Handle
              type="source"
              position={Position.Bottom}
              id={h.id}
              style={{
                ...handleStyle(h.color || color),
                left: `${leftPercent}%`,
                position: 'absolute',
              }}
            />
          </div>
        );
      })}
    </NodeWrapper>
  );
});
BaseNode.displayName = 'BaseNode';
```

### Task 5: Create individual node components (13 types)

**Files:**
- Create/rewrite all files in `frontend/src/components/workflow/nodes/`
- Rewrite: `frontend/src/components/workflow/nodes/index.ts`

- [ ] **Step 1: Create each node component**

Each component follows the same pattern: import `BaseNode`, extract specific data fields for description, pass icon + extra handles if needed.

**Trigger nodes (no input handle):**
- `ManualTriggerNode.tsx` — `PlayCircleOutlined`, noInput, no extra handles
- `CronTriggerNode.tsx` — `ClockCircleOutlined`, noInput, description shows cronExpression
- `WebhookTriggerNode.tsx` — `ApiOutlined`, noInput, description shows method + path

**Single I/O nodes:**
- `AgentNode.tsx` — `RobotOutlined`, description shows model or agentId
- `WaitNode.tsx` — `HourglassOutlined`, description shows duration or "webhook"
- `SubWorkflowNode.tsx` — `ForkOutlined`, description shows workflowName
- `HttpRequestNode.tsx` — `GlobalOutlined`, description shows method + url
- `CodeNode.tsx` — `CodeOutlined`, description shows language
- `TransformNode.tsx` — `SwapOutlined`, description shows mappings count
- `OutputNode.tsx` — `SendOutlined`, no output handle, description shows format

**Multi-output nodes (extra handles):**
- `IfNode.tsx` — `BranchesOutlined`, extraSourceHandles: `[{id:'true', label:'是', color:'#22c55e'}, {id:'false', label:'否', color:'#ef4444'}]`
- `SwitchNode.tsx` — `ApartmentOutlined`, extraSourceHandles: dynamic from `data.cases` (case_0, case_1, ...) + default
- `LoopNode.tsx` — `ReloadOutlined`, extraSourceHandles: `[{id:'body', label:'循环体', color:'#3b82f6'}, {id:'done', label:'完成', color:'#22c55e'}]`

Example — `IfNode.tsx`:
```typescript
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BranchesOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { IfNodeData } from '@/types/workflow';

export const IfNode = memo(({ data, selected, id, type }: NodeProps) => {
  const d = data as unknown as IfNodeData;
  return (
    <BaseNode
      id={id}
      data={data as any}
      selected={selected}
      type={type!}
      icon={<BranchesOutlined />}
      description={d.conditions.length === 1 ? `${d.conditions[0].field} ${d.conditions[0].operator} ${d.conditions[0].value}` : `${d.conditions.length} 条件 (${d.logic})`}
      extraSourceHandles={[
        { id: 'true', label: '是', color: '#22c55e' },
        { id: 'false', label: '否', color: '#ef4444' },
      ]}
    />
  );
});
IfNode.displayName = 'IfNode';
```

Example — `SwitchNode.tsx`:
```typescript
import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ApartmentOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { SwitchNodeData } from '@/types/workflow';

export const SwitchNode = memo(({ data, selected, id, type }: NodeProps) => {
  const d = data as unknown as SwitchNodeData;
  const handles = d.cases.map((c, i) => ({
    id: `case_${i}`,
    label: c.label,
    color: '#3b82f6',
  }));
  handles.push({ id: 'default', label: '默认', color: '#64748b' });

  return (
    <BaseNode
      id={id}
      data={data as any}
      selected={selected}
      type={type!}
      icon={<ApartmentOutlined />}
      description={`${d.cases.length} 个分支`}
      extraSourceHandles={handles}
    />
  );
});
SwitchNode.displayName = 'SwitchNode';
```

- [ ] **Step 2: Update `index.ts` barrel export**

Export all 13 node components.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd /Users/lh8/projects/agent-orchestration/frontend && npx tsc --noEmit`

---

## Chunk 4: Node Panel (Left Sidebar)

### Task 6: Rewrite `frontend/src/components/workflow/NodePanel.tsx`

**Files:**
- Rewrite: `frontend/src/components/workflow/NodePanel.tsx`

- [ ] **Step 1: Rewrite with categories**

Dark theme, collapsible categories, icon mapping for all 13 node types. Each item is draggable with `application/reactflow` data transfer.

Key structure:
```
Panel (dark bg #0f172a)
  ├── "触发器" section (collapsible)
  │   ├── 手动触发 (green)
  │   ├── 定时触发 (green)
  │   └── Webhook 触发 (green)
  ├── "Agent" section
  │   └── Agent 执行 (blue)
  ├── "逻辑控制" section
  │   ├── IF 条件 (amber)
  │   ├── Switch 多路 (amber)
  │   ├── 循环 (amber)
  │   └── 等待 (amber)
  ├── "工作流" section
  │   └── 子工作流 (purple)
  ├── "数据" section
  │   ├── HTTP 请求 (cyan)
  │   ├── 代码执行 (cyan)
  │   └── 数据转换 (cyan)
  └── "输出" section
      └── 输出 (pink)
```

Use `Collapse` from Ant Design or simple custom collapsible. Dark theme styling.

---

## Chunk 5: Canvas / Editor Page

### Task 7: Rewrite `frontend/src/pages/workflows/WorkflowEditorPage.tsx`

**Files:**
- Rewrite: `frontend/src/pages/workflows/WorkflowEditorPage.tsx`

- [ ] **Step 1: Rewrite editor page**

Key changes:
1. Register all 13 node types in `nodeTypes` map
2. Update `onDrop` to use `NODE_META[type].defaultData()` for initial data
3. Save format: `JSON.stringify(store.saveDefinition())` into `definition` field
4. Load format: parse `definition` field via `store.loadDefinition(jsonString)`
5. Dark theme canvas background (`#0f172a`) with dots grid
6. MiniMap dark theme
7. Ctrl+D → duplicateNode, Delete → deleteSelected
8. Sync store ↔ local React Flow state properly

**Node type registration:**
```typescript
import {
  ManualTriggerNode, CronTriggerNode, WebhookTriggerNode,
  AgentNode, IfNode, SwitchNode, LoopNode, WaitNode,
  SubWorkflowNode, HttpRequestNode, CodeNode, TransformNode, OutputNode,
} from '@/components/workflow/nodes';

const nodeTypes = {
  manual_trigger: ManualTriggerNode,
  cron_trigger: CronTriggerNode,
  webhook_trigger: WebhookTriggerNode,
  agent: AgentNode,
  if: IfNode,
  switch: SwitchNode,
  loop: LoopNode,
  wait: WaitNode,
  sub_workflow: SubWorkflowNode,
  http_request: HttpRequestNode,
  code: CodeNode,
  transform: TransformNode,
  output: OutputNode,
};
```

**Save payload:**
```typescript
const def = store.saveDefinition();
const payload = {
  name: def.name,
  description: def.description,
  definition: JSON.stringify(def),
};
```

**Keyboard shortcuts:**
```typescript
if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) {
  e.preventDefault();
  const ids = selectedNodeIds;
  if (ids.length === 1) store.duplicateNode(ids[0]);
}
```

- [ ] **Step 2: Update `EditorToolbar.tsx` for new store API**

Minor changes: use `selectedNodeIds` instead of `selectedNodeId`, add auto-layout button.

---

## Chunk 6: Node Config Panel (Right Sidebar)

### Task 8: Rewrite `frontend/src/components/workflow/NodeConfigPanel.tsx`

**Files:**
- Rewrite: `frontend/src/components/workflow/NodeConfigPanel.tsx`

- [ ] **Step 1: Create type-specific config form components**

Create individual form components for each node type category:

1. **Common section** (all nodes): Label input + Delete button + Disable toggle
2. **Trigger forms**: ManualTriggerForm, CronTriggerForm, WebhookTriggerForm
3. **Agent form**: Agent dropdown + prompt + model + temperature + maxTokens + timeout
4. **Logic forms**: IfForm (dynamic condition rows + and/or toggle), SwitchForm (dynamic case rows), LoopForm (loopType toggle), WaitForm (waitType toggle)
5. **Data forms**: HttpRequestForm, CodeForm (code editor textarea), TransformForm (dynamic mapping rows)
6. **Output form**: Format select + outputPath
7. **Advanced mode**: Toggle to show raw JSON editor (monospace textarea)

Each form uses Ant Design `Form` with `onValuesChange` → `store.updateNodeData()`.

**IfNodeForm example:**
- Condition rows: each row has field input, operator select, value input, delete button
- "Add condition" button
- Logic toggle: and / or radio

**CodeNodeForm example:**
- Language select: python / javascript
- Code textarea with monospace font
- Timeout number input

- [ ] **Step 2: Wire up in NodeConfigPanel**

```typescript
export const NodeConfigPanel = () => {
  const { nodes, selectedNodeIds, updateNodeData, removeNode } = useWorkflowStore();
  const selectedNode = nodes.find((n) => selectedNodeIds.includes(n.id));
  if (!selectedNode) return null;

  const [advancedMode, setAdvancedMode] = useState(false);

  if (advancedMode) {
    return <AdvancedJsonEditor node={selectedNode} onBack={() => setAdvancedMode(false)} />;
  }

  const FormComponent = CONFIG_FORM_MAP[selectedNode.type!];
  return (
    <Panel>
      <PanelHeader>
        <NodeIcon />
        <NodeTypeName />
        <SwitchToAdvanced onClick={() => setAdvancedMode(true)} />
      </PanelHeader>
      <CommonFields node={selectedNode} />
      <FormComponent node={selectedNode} />
    </Panel>
  );
};
```

---

## Chunk 7: Workflow Management

### Task 9: Update API and list page for Schema v1

**Files:**
- Modify: `frontend/src/api/workflows.ts`
- Modify: `frontend/src/pages/workflows/WorkflowListPage.tsx`

- [ ] **Step 1: Update API types**

Add proper TypeScript types for API request/response:

```typescript
export interface WorkflowCreatePayload {
  name: string;
  description?: string;
  definition: string; // JSON.stringify(WorkflowDefinition)
}
```

- [ ] **Step 2: Add import/export to EditorToolbar**

Add "Export JSON" button → downloads Schema v1 JSON file.
Add "Import JSON" button → file input, parse, loadDefinition.

- [ ] **Step 3: Verify list page still works**

The list page (`WorkflowListPage.tsx`) should work as-is since it uses generic API. No changes needed unless the API response format changes.

---

## Completion Checklist

- [ ] All 13 node types can be dragged to canvas
- [ ] Node config panel renders type-specific forms
- [ ] IF node has true/false output ports
- [ ] Switch node has case_0/case_1/.../default output ports
- [ ] Loop node has body/done output ports
- [ ] Edge data format matches Schema v1 §4
- [ ] Save produces Schema v1 JSON
- [ ] Load parses Schema v1 JSON correctly
- [ ] Undo/redo works
- [ ] No console errors
- [ ] No TypeScript type errors
