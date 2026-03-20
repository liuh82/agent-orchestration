import { useState, useMemo } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls } from '@xyflow/react';
import { useQuery } from 'react-query';
import dagre from 'dagre';
import styled from 'styled-components';
import { Tag, Empty, Spin } from 'antd';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { workflowsApi } from '@/api/workflows';
import {
  ManualTriggerNode,
  CronTriggerNode,
  WebhookTriggerNode,
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
} from '@/components/workflow/nodes';
import type { SSEMessage } from '@/hooks/useTaskStream';

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

const STATUS_COLORS: Record<string, string> = {
  pending: colors.neutral[400],
  running: '#3b82f6',
  completed: '#22c55e',
  success: '#22c55e',
  failed: '#ef4444',
  skipped: '#9ca3af',
  paused: '#f59e0b',
  waiting: '#f59e0b',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  success: '成功',
  failed: '失败',
  skipped: '已跳过',
  paused: '已暂停',
  waiting: '等待中',
};

const Wrapper = styled.div`
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  overflow: hidden;
  margin-bottom: ${spacing[4]};
`;

const DAGHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${spacing[2]} ${spacing[4]};
  background: ${colors.surface.raised};
  border-bottom: 1px solid ${colors.border.DEFAULT};
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.secondary};
  cursor: pointer;
  user-select: none;
`;

const CanvasContainer = styled.div`
  height: 280px;
  background: #fafafa;
`;

const NodeDetailPanel = styled.div`
  padding: ${spacing[3]} ${spacing[4]};
  background: ${colors.surface.DEFAULT};
  border-top: 1px solid ${colors.border.DEFAULT};
  max-height: 200px;
  overflow-y: auto;
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: ${spacing[2]} ${spacing[3]};
  font-size: ${typography.fontSize.sm};
`;

const DetailLabel = styled.span`
  color: ${colors.text.muted};
`;

const DetailValue = styled.span`
  color: ${colors.text.primary};
  font-family: ${typography.fontFamily.mono};
  font-size: ${typography.fontSize.xs};
  word-break: break-word;
`;

function layoutWithDagre(nodes: any[], edges: any[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 60 });

  const validNodes = nodes.filter((n) => n.position);
  validNodes.forEach((n) => {
    g.setNode(n.id, { width: 180, height: 60 });
  });
  edges.forEach((e: any) => {
    const src = e.source || e.from;
    const tgt = e.target || e.to;
    if (g.hasNode(src) && g.hasNode(tgt)) {
      g.setEdge(src, tgt);
    }
  });

  dagre.layout(g);

  return validNodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - 90, y: pos.y - 30 },
      draggable: false,
      selectable: false,
    };
  });
}

interface TaskWorkflowDAGProps {
  workflowId?: string;
  workflowEvents: SSEMessage[];
}

export const TaskWorkflowDAG: React.FC<TaskWorkflowDAGProps> = ({
  workflowId,
  workflowEvents,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Fetch workflow definition
  const { data: wfRes, isLoading: wfLoading } = useQuery(
    ['workflow-def', workflowId],
    () => workflowsApi.getById(workflowId!),
    { enabled: !!workflowId },
  );

  const workflow = wfRes?.data ?? wfRes;
  const definition = workflow?.definition;

  // Extract node states from SSE workflow_event messages
  const nodeStates = useMemo(() => {
    const states: Record<string, { status: string; output?: any; error?: string; duration_ms?: number }> = {};
    for (const msg of workflowEvents) {
      if (msg.type === 'workflow_event' && msg.data) {
        const data = msg.data.event?.data ?? msg.data;
        if (data.node_id) {
          const prev = states[data.node_id] || {};
          states[data.node_id] = {
            status: data.status ?? prev.status,
            output: data.output_data ?? data.output ?? prev.output,
            error: data.error_message ?? data.error ?? prev.error,
            duration_ms: data.duration_ms ?? prev.duration_ms,
          };
        }
        // Auto-select running node
        if (data.status === 'running' && data.node_id) {
          setSelectedNodeId(data.node_id);
        }
      }
    }
    return states;
  }, [workflowEvents]);

  // Apply node states as border color overlays
  const styledNodes = useMemo(() => {
    if (!definition?.nodes) return [];
    const raw = definition.nodes.map((n: any) => {
      const runState = nodeStates[n.id]?.status;
      const borderColor = runState ? STATUS_COLORS[runState] : undefined;
      const isPending = !runState;
      const isRunning = runState === 'running';
      return {
        ...n,
        draggable: false,
        selectable: false,
        style: {
          ...(borderColor ? { border: `2px solid ${borderColor}` } : {}),
          opacity: isPending ? 0.5 : 1,
          ...(isRunning ? { boxShadow: `0 0 8px ${STATUS_COLORS.running}40` } : {}),
        },
      };
    });
    return layoutWithDagre(raw, definition.edges ?? []);
  }, [definition, nodeStates]);

  const edges = definition?.edges ?? [];

  const selectedState = selectedNodeId ? nodeStates[selectedNodeId] : null;
  const selectedNodeDef = selectedNodeId
    ? definition?.nodes?.find((n: any) => n.id === selectedNodeId)
    : null;

  if (!workflowId) return null;

  return (
    <Wrapper>
      <DAGHeader onClick={() => setCollapsed(!collapsed)}>
        <span>
          {workflow?.name || '工作流'}
          {Object.keys(nodeStates).length > 0 && (
            <Tag style={{ marginLeft: spacing[2] }} color="blue">
              {Object.values(nodeStates).filter((s) => s.status === 'running').length} 执行中
            </Tag>
          )}
        </span>
        <span>{collapsed ? '展开' : '收起'}</span>
      </DAGHeader>

      {!collapsed && (
        <>
          {wfLoading ? (
            <div style={{ padding: spacing[8], textAlign: 'center' }}>
              <Spin tip="加载工作流定义..." />
            </div>
          ) : !definition?.nodes?.length ? (
            <Empty description="无工作流定义" style={{ padding: spacing[6] }} />
          ) : (
            <>
              <CanvasContainer>
                <ReactFlow
                  nodes={styledNodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  fitView
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  defaultEdgeOptions={{ style: { strokeWidth: 2, stroke: colors.border.DEFAULT } }}
                >
                  <Background variant={BackgroundVariant.Dots} color="#d1d5db" gap={16} size={1} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </CanvasContainer>

              {selectedNodeId && (selectedState || selectedNodeDef) && (
                <NodeDetailPanel>
                  <DetailGrid>
                    <DetailLabel>节点</DetailLabel>
                    <DetailValue>{selectedNodeDef?.data?.label || selectedNodeDef?.id || selectedNodeId}</DetailValue>

                    <DetailLabel>类型</DetailLabel>
                    <DetailValue>{selectedNodeDef?.type || '-'}</DetailValue>

                    <DetailLabel>状态</DetailLabel>
                    <DetailValue>
                      <Tag color={selectedState?.status ? STATUS_COLORS[selectedState.status] : 'default'}>
                        {selectedState?.status ? STATUS_LABELS[selectedState.status] || selectedState.status : '未执行'}
                      </Tag>
                    </DetailValue>

                    {selectedState?.duration_ms != null && (
                      <>
                        <DetailLabel>耗时</DetailLabel>
                        <DetailValue>{(selectedState.duration_ms / 1000).toFixed(1)}s</DetailValue>
                      </>
                    )}

                    {selectedState?.error && (
                      <>
                        <DetailLabel>错误</DetailLabel>
                        <DetailValue style={{ color: colors.text.error }}>{selectedState.error}</DetailValue>
                      </>
                    )}

                    {selectedState?.output && typeof selectedState.output === 'object' && (
                      <>
                        <DetailLabel>输出</DetailLabel>
                        <DetailValue>{JSON.stringify(selectedState.output, null, 2)}</DetailValue>
                      </>
                    )}
                  </DetailGrid>
                </NodeDetailPanel>
              )}
            </>
          )}
        </>
      )}
    </Wrapper>
  );
};

export default TaskWorkflowDAG;
