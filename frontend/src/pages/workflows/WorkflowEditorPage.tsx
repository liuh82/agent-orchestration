import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, type Connection, type Edge, BackgroundVariant } from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import { message } from 'antd';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { workflowsApi } from '@/api/workflows';
import { EditorToolbar } from '@/components/workflow/EditorToolbar';
import { NodePanel } from '@/components/workflow/NodePanel';
import { NodeConfigPanel } from '@/components/workflow/NodeConfigPanel';
import { AgentNode, ConditionNode, HumanNode, ParallelNode, TransformNode, NotificationNode, TimerNode } from '@/components/workflow/nodes';
import type { WorkflowNodeType, WorkflowNodeData, WorkflowNode } from '@/types/workflow';
import { NODE_TYPE_OPTIONS } from '@/types/workflow';

const EditorLayout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const EditorBody = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const CanvasWrapper = styled.div`
  flex: 1;
  background: #fafafa;
`;

const nodeTypes = {
  agent: AgentNode,
  condition: ConditionNode,
  human: HumanNode,
  parallel: ParallelNode,
  transform: TransformNode,
  notification: NotificationNode,
  timer: TimerNode,
};

const layoutGraph = (nodes: WorkflowNode[], edges: Edge[]) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 200, height: 100 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (pos) {
      return { ...node, position: { x: pos.x - 100, y: pos.y - 50 } };
    }
    return node;
  });
};

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export const WorkflowEditorPage = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { workflowId, workflowName, nodes, edges, setWorkflowId, setWorkflowName, addNode, setSelectedNodeId, loadDefinition, setEdges } = useWorkflowStore();

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const [isSaving, setIsSaving] = useState(false);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);

  // Sync store → local
  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(edges);
  }, [edges, setLocalEdges]);

  // Load existing workflow if editing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const templateId = params.get('template');
    if (templateId) {
      workflowsApi.getTemplate(templateId).then((res: any) => {
        const def = res?.data?.definition;
        if (def?.nodes && def?.edges) {
          const laid = layoutGraph(def.nodes, def.edges);
          loadDefinition(laid, def.edges);
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
          const def = wf.definition;
          if (def?.nodes && def?.edges) {
            const laid = layoutGraph(def.nodes, def.edges);
            loadDefinition(laid, def.edges);
          }
        }
      });
    }
  }, []);

  // Load agents for config panel
  useEffect(() => {
    import('@/api/agents').then(({ agentApi }) => {
      agentApi.list().then((res: any) => {
        const list = res?.data?.items ?? res?.data ?? [];
        setAgents(list.map((a: any) => ({ id: a.id, name: a.name })));
      }).catch(() => {});
    });
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      setLocalEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2 } }, eds));
      setEdges([...localEdges, { ...params, animated: true, style: { strokeWidth: 2 } } as any]);
    },
    [localEdges, setEdges, setLocalEdges],
  );

  const onNodeClick = useCallback(
    (_: any, node: any) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType;
      if (!type) return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 50,
      };

      const opt = NODE_TYPE_OPTIONS.find((o) => o.value === type);
      const newNode: WorkflowNode = {
        id: generateId(),
        type,
        position,
        data: {
          label: opt?.label ?? type,
          nodeType: type,
        } as WorkflowNodeData,
      };

      addNode(newNode);
    },
    [addNode],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: workflowName || '未命名工作流',
        definition: { nodes: localNodes, edges: localEdges },
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
  }, [workflowId, workflowName, localNodes, localEdges, setWorkflowId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          useWorkflowStore.getState().undo();
        }
        if (e.key === 'z' && e.shiftKey) {
          e.preventDefault();
          useWorkflowStore.getState().redo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const defaultEdgeOptions = useMemo(() => ({
    animated: true,
    style: { strokeWidth: 2, stroke: colors.border.DEFAULT },
    type: 'smoothstep',
  }), []);

  return (
    <EditorLayout>
      <EditorToolbar onSave={handleSave} isSaving={isSaving} />
      <EditorBody>
        <NodePanel />
        <CanvasWrapper ref={reactFlowWrapper}>
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
            deleteKeyCode="Delete"
          >
            <Background variant={BackgroundVariant.Dots} color="#d1d5db" gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const opt = NODE_TYPE_OPTIONS.find((o) => o.value === node.type);
                return opt?.color ?? '#999';
              }}
              style={{ background: '#fafafa', border: '1px solid #e5e7eb' }}
            />
          </ReactFlow>
        </CanvasWrapper>
        <NodeConfigPanel agents={agents} />
      </EditorBody>
    </EditorLayout>
  );
};

export default WorkflowEditorPage;
