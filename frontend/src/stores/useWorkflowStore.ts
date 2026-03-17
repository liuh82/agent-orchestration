import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type {
  NodeData,
  NodeDataRf,
  WorkflowDefinition,
  WorkflowConfig,
  WorkflowNode,
  WorkflowEdge,
  NodeRunStatus,
} from '@/types/workflow';
import { EDGE_TYPE_RULES } from '@/types/workflow';

/* ================================================================
 *  Workflow Editor Store
 * ================================================================ */

interface WorkflowEditorState {
  workflowId: string | null;
  workflowName: string;
  workflowDescription: string;
  variables: Record<string, unknown>;
  config: WorkflowConfig;
  nodes: Node<NodeDataRf>[];
  edges: Edge[];
  selectedNodeIds: string[];
  history: { nodes: Node<NodeDataRf>[]; edges: Edge[] }[];
  historyIndex: number;

  setWorkflowId: (id: string | null) => void;
  setWorkflowName: (name: string) => void;
  setWorkflowDescription: (desc: string) => void;
  setVariables: (vars: Record<string, unknown>) => void;
  setConfig: (config: WorkflowConfig) => void;
  setNodes: (nodes: Node<NodeDataRf>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node<NodeDataRf>) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  duplicateNode: (nodeId: string) => void;
  deleteSelected: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  saveDefinition: () => WorkflowDefinition;
  loadDefinition: (json: string) => void;
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

  duplicateNode: (nodeId) => {
    const { nodes } = get();
    const source = nodes.find((n) => n.id === nodeId);
    if (!source) return;

    get().pushHistory();

    const newId = `${nodeId}_copy_${Date.now()}`;
    const label = (source.data as { label?: string }).label ?? '';
    const newNode: Node<NodeDataRf> = {
      ...structuredClone(source),
      id: newId,
      position: { x: source.position.x + 50, y: source.position.y + 50 },
      data: { ...structuredClone(source.data), label: `${label}(副本)` },
      selected: false,
    };

    set((state) => ({ nodes: [...state.nodes, newNode] }));
  },

  deleteSelected: () => {
    const { selectedNodeIds, nodes, edges } = get();
    if (selectedNodeIds.length === 0) return;

    get().pushHistory();

    const removeSet = new Set(selectedNodeIds);
    set({
      nodes: nodes.filter((n) => !removeSet.has(n.id)),
      edges: edges.filter((e) => !removeSet.has(e.source) && !removeSet.has(e.target)),
      selectedNodeIds: [],
    });
  },

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    });
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
      disabled: (n as Node<NodeDataRf> & { disabled?: boolean }).disabled,
    }));
    const schemaEdges: WorkflowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: (typeof e.label === 'string' ? e.label : undefined) as string | undefined,
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
      const rfNodes: Node<NodeDataRf>[] = def.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data as NodeDataRf,
        disabled: n.disabled,
      }));

      // Build a node-type lookup for edge inference
      const nodeTypeMap = new Map(def.nodes.map((n) => [n.id, n.type]));

      const rfEdges: Edge[] = def.edges.map((e) => {
        const sourceNodeType = nodeTypeMap.get(e.source);
        const inferredType = sourceNodeType ? EDGE_TYPE_RULES[sourceNodeType] : undefined;

        let edgeType: string;
        if (inferredType === 'conditional' || inferredType === 'loop') {
          edgeType = 'conditional';
        } else if (inferredType === 'parallel') {
          edgeType = 'parallel';
        } else {
          edgeType = 'normal';
        }

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: e.label,
          type: edgeType,
          data: { sourceNodeType, sourceHandle: e.sourceHandle },
          style: {},
        };
      });
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

/* ── Monitor store ── */

interface WorkflowMonitorState {
  nodeStates: Record<string, NodeRunStatus>;
  executionStatus: string;
  logs: Array<{ node_id: string; message: string; timestamp: string; level: string }>;

  setNodeState: (nodeId: string, status: NodeRunStatus) => void;
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
