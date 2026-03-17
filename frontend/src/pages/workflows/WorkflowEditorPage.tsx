import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  BackgroundVariant,
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import { message } from 'antd';
import styled from 'styled-components';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { workflowsApi } from '@/api/workflows';
import { EditorToolbar } from '@/components/workflow/EditorToolbar';
import { NodePanel } from '@/components/workflow/NodePanel';
import { NodeConfigPanel } from '@/components/workflow/NodeConfigPanel';
import {
  ManualTriggerNode,
  CronTriggerNode,
  WebhookTriggerNode,
  InputNode,
  AgentNode,
  IfNode,
  SwitchNode,
  LoopNode,
  WaitNode,
  SubWorkflowNode,
  HttpRequestNode,
  CodeNode,
  TransformNode,
  OutputNode,
  ContextOutputNode,
  ResultOutputNode,
} from '@/components/workflow/nodes';
import type {
  NodeDataRf,
  WorkflowNodeType,
  ReactFlowNode,
} from '@/types/workflow';
import { NODE_META } from '@/types/workflow';

/* ── Styled Components ── */

const EditorLayout = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
`;

const EditorBody = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const CanvasWrapper = styled.div`
  flex: 1;
  background: #ffffff;
`;

/* ── Node Type Registration (13 nodes) ── */

const nodeTypes: Record<string, any> = {
  manual_trigger: ManualTriggerNode,
  cron_trigger: CronTriggerNode,
  webhook_trigger: WebhookTriggerNode,
  input: InputNode,
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
  context_output: ContextOutputNode,
  result_output: ResultOutputNode,
};

/* ── Dagre Auto-Layout (exported for toolbar / menu usage) ── */

export const layoutGraph = (nodes: Node<NodeDataRf>[], edges: Edge[]): Node<NodeDataRf>[] => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 220, height: 100 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (pos) {
      return { ...node, position: { x: pos.x - 110, y: pos.y - 50 } };
    }
    return node;
  });
};

/* ── Helpers ── */

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/* ── Page Component ── */

export const WorkflowEditorPage = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const {
    workflowId,
    nodes,
    edges,
    setWorkflowId,
    setWorkflowName,
    setWorkflowDescription,
    setNodes,
    setEdges,
    addNode,
    setSelectedNodeIds,
    saveDefinition,
    loadDefinition,
  } = useWorkflowStore();

  /* Local ReactFlow state (synced from store) */
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const [isSaving, setIsSaving] = useState(false);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);

  /* Make this page full-screen, overriding MainLayout constraints */
  useEffect(() => {
    const contentEl = document.querySelector('main') as HTMLElement;
    const innerEl = contentEl?.querySelector(':scope > div') as HTMLElement;
    if (contentEl) {
      contentEl.style.padding = '0';
      contentEl.style.overflow = 'hidden';
      contentEl.style.background = '#f5f5f5';
    }
    if (innerEl) {
      innerEl.style.maxWidth = 'none';
      innerEl.style.height = '100%';
    }
    return () => {
      if (contentEl) {
        contentEl.style.padding = '';
        contentEl.style.overflow = '';
        contentEl.style.background = '';
      }
      if (innerEl) {
        innerEl.style.maxWidth = '';
        innerEl.style.height = '';
      }
    };
  }, []);

  /* Sync store -> local ReactFlow state */
  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(edges);
  }, [edges, setLocalEdges]);

  /* Sync local changes back to store (for save/definition) */
  useEffect(() => {
    setNodes(localNodes);
  }, [localNodes, setNodes]);

  useEffect(() => {
    setEdges(localEdges);
  }, [localEdges, setEdges]);

  /* Load existing workflow or template on mount */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const templateId = params.get('template');

    if (templateId) {
      workflowsApi.getTemplate(templateId).then((res: any) => {
        const def = res?.data?.definition;
        if (def) {
          const jsonStr = typeof def === 'string' ? def : JSON.stringify(def);
          loadDefinition(jsonStr);
        }
      });
      return;
    }

    if (id) {
      setWorkflowId(id);
      workflowsApi.getById(id).then((res: any) => {
        const wf = res?.data ?? res;
        if (wf) {
          setWorkflowName(wf.name || '');
          setWorkflowDescription(wf.description || '');
          if (wf.definition) {
            const jsonStr = typeof wf.definition === 'string'
              ? wf.definition
              : JSON.stringify(wf.definition);
            loadDefinition(jsonStr);
          }
        }
      });
    }
  }, []);

  /* Load agents for config panel */
  useEffect(() => {
    import('@/api/agents').then(({ agentApi }) => {
      agentApi.list().then((res: any) => {
        const list = res?.data?.items ?? res?.data ?? [];
        setAgents(list.map((a: any) => ({ id: a.id, name: a.name })));
      }).catch(() => {});
    });
  }, []);

  /* ── Event Handlers ── */

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        animated: true,
        style: { strokeWidth: 2, stroke: '#cbd5e1' },
        type: 'smoothstep' as const,
      };
      setLocalEdges((eds) => addEdge(newEdge, eds));
    },
    [setLocalEdges],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setSelectedNodeIds([node.id]);
    },
    [setSelectedNodeIds],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeIds([]);
  }, [setSelectedNodeIds]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType;
      if (!type) return;

      const meta = NODE_META[type];
      if (!meta) return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 110,
        y: event.clientY - reactFlowBounds.top - 50,
      };

      const newNode: ReactFlowNode = {
        id: generateId(),
        type,
        position,
        data: meta.defaultData() as NodeDataRf,
      };

      addNode(newNode);
    },
    [addNode],
  );

  /* ── Save (Schema v1) ── */

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const def = saveDefinition();
      const payload = {
        name: def.name,
        description: def.description,
        definition: JSON.stringify(def),
      };
      if (workflowId) {
        await workflowsApi.update(workflowId, payload);
      } else {
        const res = await workflowsApi.create(payload);
        const id = res?.data?.id || res?.id;
        if (id) setWorkflowId(id);
      }
      void message.success('保存成功');
    } catch {
      void message.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, saveDefinition, setWorkflowId]);

  /* ── Keyboard Shortcuts ── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      /* Skip when user is typing in an input/textarea */
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      /* Ctrl/Cmd + Z -> undo */
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useWorkflowStore.getState().undo();
        return;
      }

      /* Ctrl/Cmd + Shift + Z -> redo */
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        useWorkflowStore.getState().redo();
        return;
      }

      /* Ctrl/Cmd + D -> duplicate selected node */
      if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const ids = useWorkflowStore.getState().selectedNodeIds;
        if (ids.length === 1) {
          useWorkflowStore.getState().duplicateNode(ids[0]);
        }
        return;
      }

      /* Delete / Backspace -> delete selected */
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = useWorkflowStore.getState().selectedNodeIds;
        if (ids.length > 0) {
          e.preventDefault();
          useWorkflowStore.getState().deleteSelected();
        }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ── Default Edge Options ── */

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: true,
      style: { strokeWidth: 2, stroke: '#cbd5e1' },
      type: 'smoothstep' as const,
    }),
    [],
  );

  /* ── Render ── */

  return (
    <EditorLayout>
      <EditorBody>
        <NodePanel />
        <CanvasWrapper ref={reactFlowWrapper}>
          <EditorToolbar onSave={handleSave} isSaving={isSaving} />
          <ReactFlow
            nodes={localNodes}
            edges={localEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            deleteKeyCode={null}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="#cbd5e1"
              gap={20}
              size={1}
            />
            <Controls />
            <MiniMap
              nodeColor={(node) =>
                NODE_META[node.type as WorkflowNodeType]?.color ?? '#64748b'
              }
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}
            />
          </ReactFlow>
        </CanvasWrapper>
        <NodeConfigPanel agents={agents} />
      </EditorBody>
    </EditorLayout>
  );
};

export default WorkflowEditorPage;
