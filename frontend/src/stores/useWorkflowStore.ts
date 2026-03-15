import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowNodeData, NodeRunStatus } from '@/types/workflow';

interface WorkflowEditorState {
  workflowId: string | null;
  workflowName: string;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  history: { nodes: Node<WorkflowNodeData>[]; edges: Edge[] }[];
  historyIndex: number;

  setWorkflowId: (id: string | null) => void;
  setWorkflowName: (name: string) => void;
  setNodes: (nodes: Node<WorkflowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node<WorkflowNodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadDefinition: (nodes: Node<WorkflowNodeData>[], edges: Edge[]) => void;
  reset: () => void;
}

const MAX_HISTORY = 50;

export const useWorkflowStore = create<WorkflowEditorState>((set, get) => ({
  workflowId: null,
  workflowName: '',
  nodes: [],
  edges: [],
  selectedNodeId: null,
  history: [],
  historyIndex: -1,

  setWorkflowId: (id) => set({ workflowId: id }),
  setWorkflowName: (name) => set({ workflowName: name }),

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
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
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

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

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

  loadDefinition: (nodes, edges) => {
    set({
      nodes,
      edges,
      history: [{ nodes: structuredClone(nodes), edges: structuredClone(edges) }],
      historyIndex: 0,
    });
  },

  reset: () => set({
    workflowId: null,
    workflowName: '',
    nodes: [],
    edges: [],
    selectedNodeId: null,
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
