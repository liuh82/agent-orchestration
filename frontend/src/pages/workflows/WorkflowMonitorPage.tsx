import { useEffect, useRef, useState, useCallback } from 'react';
import { ReactFlow, Background, Controls, BackgroundVariant } from '@xyflow/react';
import { Button, Tag, message, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { workflowsApi } from '@/api/workflows';
import { WorkflowWebSocket } from '@/utils/websocket';
import { useWorkflowMonitorStore } from '@/stores/useWorkflowStore';
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
import type { WsEvent } from '@/types/workflow';

const MonitorLayout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${spacing[3]} ${spacing[4]};
  background: ${colors.surface.DEFAULT};
  border-bottom: 1px solid ${colors.border.DEFAULT};
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
`;

const CanvasWrapper = styled.div`
  flex: 1;
  background: #fafafa;
`;

const LogPanel = styled.div<{ $collapsed: boolean }>`
  background: ${colors.surface.DEFAULT};
  border-top: 1px solid ${colors.border.DEFAULT};
  height: ${({ $collapsed }) => ($collapsed ? '36px' : '200px')};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const LogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${spacing[2]} ${spacing[4]};
  font-size: 13px;
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.secondary};
  cursor: pointer;
  flex-shrink: 0;
`;

const LogContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 ${spacing[4]} ${spacing[3]};
  font-family: ${typography.fontFamily.mono};
  font-size: 12px;
  line-height: 1.8;
`;

const LogLine = styled.div<{ $level: string }>`
  color: ${({ $level }) =>
    $level === 'error' ? colors.error[500] :
    $level === 'warn' ? colors.warning[500] :
    colors.text.secondary
  };
`;

const STATUS_COLORS: Record<string, string> = {
  pending: colors.neutral[400],
  running: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  skipped: '#9ca3af',
  paused: '#f59e0b',
};

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

export const WorkflowMonitorPage = () => {
  const { executionId } = useParams<{ executionId: string }>();
  const navigate = useNavigate();
  const wsRef = useRef<WorkflowWebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { nodeStates, executionStatus, logs, setNodeState, setExecutionStatus, appendLog } = useWorkflowMonitorStore();
  const [logCollapsed, setLogCollapsed] = useState(false);

  const { data: executionData, isLoading } = useQuery(
    ['workflow-execution', executionId],
    () => workflowsApi.getExecution(executionId!),
    { enabled: !!executionId },
  );

  const execution = executionData?.data ?? executionData;
  const statusColor = STATUS_COLORS[executionStatus] ?? colors.neutral[500];

  const handleWsMessage = useCallback((event: WsEvent) => {
    switch (event.type) {
      case 'node.status_changed':
        setNodeState(event.node_id, event.status);
        break;
      case 'node.log':
        appendLog({
          node_id: event.node_id,
          message: event.message,
          timestamp: event.timestamp,
          level: event.level,
        });
        break;
      case 'execution.status_changed':
        setExecutionStatus(event.status);
        break;
    }
  }, [setNodeState, setExecutionStatus, appendLog]);

  useEffect(() => {
    if (!executionId) return;
    const ws = new WorkflowWebSocket();
    ws.connect(executionId, handleWsMessage);
    wsRef.current = ws;
    return () => { ws.disconnect(); };
  }, [executionId, handleWsMessage]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Apply node states as border color overlays
  const styledNodes = execution?.definition?.nodes?.map((node: any) => {
    const runState = nodeStates[node.id];
    const borderColor = runState ? STATUS_COLORS[runState] : undefined;
    return {
      ...node,
      draggable: false,
      selectable: false,
      style: borderColor ? { border: `2px solid ${borderColor}`, opacity: runState === 'pending' ? 0.5 : 1 } : {},
    };
  }) ?? [];

  const handlePause = async () => {
    if (!executionId) return;
    try {
      await workflowsApi.pauseExecution(executionId);
      void message.success('已暂停');
    } catch { void message.error('操作失败'); }
  };

  const handleResume = async () => {
    if (!executionId) return;
    try {
      await workflowsApi.resumeExecution(executionId);
      void message.success('已恢复');
    } catch { void message.error('操作失败'); }
  };

  const handleCancel = async () => {
    if (!executionId) return;
    try {
      await workflowsApi.cancelExecution(executionId);
      void message.success('已取消');
    } catch { void message.error('操作失败'); }
  };

  const statusLabel: Record<string, string> = {
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '已失败',
    cancelled: '已取消',
  };

  if (isLoading) {
    return <div style={{ padding: spacing[8], textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <MonitorLayout>
      <Toolbar>
        <Left>
          <Tooltip title="返回列表">
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/workflows')} />
          </Tooltip>
          <span style={{ fontSize: 15, fontWeight: 600, color: colors.text.primary }}>
            {execution?.workflowName || '流程执行'}
          </span>
          <Tag color={statusColor}>{statusLabel[executionStatus] || executionStatus}</Tag>
        </Left>
        <Right>
          {executionStatus === 'running' && (
            <Button size="small" icon={<PauseCircleOutlined />} onClick={handlePause}>暂停</Button>
          )}
          {executionStatus === 'paused' && (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={handleResume}>恢复</Button>
          )}
          {(executionStatus === 'running' || executionStatus === 'paused') && (
            <Button size="small" danger icon={<StopOutlined />} onClick={handleCancel}>取消</Button>
          )}
        </Right>
      </Toolbar>

      <CanvasWrapper>
        <ReactFlow
          nodes={styledNodes}
          edges={execution?.definition?.edges ?? []}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          defaultEdgeOptions={{ style: { strokeWidth: 2, stroke: colors.border.DEFAULT } }}
        >
          <Background variant={BackgroundVariant.Dots} color="#d1d5db" gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </CanvasWrapper>

      <LogPanel $collapsed={logCollapsed}>
        <LogHeader onClick={() => setLogCollapsed(!logCollapsed)}>
          <span>实时日志 ({logs.length})</span>
          <span>{logCollapsed ? '展开 ▲' : '收起 ▼'}</span>
        </LogHeader>
        {!logCollapsed && (
          <LogContent>
            {logs.length === 0 ? (
              <div style={{ color: colors.text.muted, padding: spacing[2] }}>等待日志...</div>
            ) : (
              logs.map((log, i) => (
                <LogLine key={i} $level={log.level}>
                  <span style={{ color: colors.text.muted, marginRight: spacing[2] }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('zh-CN') : ''}
                  </span>
                  {log.node_id && (
                    <span style={{ color: colors.primary[500], marginRight: spacing[2] }}>[{log.node_id}]</span>
                  )}
                  {log.message}
                </LogLine>
              ))
            )}
            <div ref={logEndRef} />
          </LogContent>
        )}
      </LogPanel>
    </MonitorLayout>
  );
};

export default WorkflowMonitorPage;
