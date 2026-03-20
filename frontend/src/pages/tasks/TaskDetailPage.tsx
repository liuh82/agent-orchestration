import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Button, Table, Tag, Space, Tooltip, message, Tabs, Modal, Form, Input, Select, Popconfirm, Progress } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { ToolUseCard } from '@/components/tasks/ToolUseCard';
import { FileChangeList } from '@/components/tasks/FileChangeList';
import { useTaskStream } from '@/hooks/useTaskStream';
import api from '@/api/client';
import { tasksApi } from '@/api/tasks';
import type { ApiResponse } from '@/types/api';
import type { Task } from '@/types/task';
import type { Job } from '@/types/job';

// --------------- Constants ---------------
const priorityColors: Record<Task['priority'], string> = {
  low: 'default',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};

const priorityLabels: Record<Task['priority'], string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
};

const statusToBadge: Record<
  Task['status'],
  'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'pending_human'
> = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
  paused: 'paused',
  pending_human: 'pending',
  scheduled: 'pending',
};

const jobStatusToBadge: Record<
  Job['status'],
  'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
> = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};

// --------------- Log types ---------------
interface TaskLog {
  id: string;
  task_id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}

// --------------- Styled components ---------------
const InfoCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  margin-bottom: ${spacing[6]};
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${spacing[4]};
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[1]};
`;

const InfoLabel = styled.span`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.muted};
`;

const InfoValue = styled.span`
  font-size: ${typography.fontSize.base};
  color: ${colors.text.primary};
  font-weight: ${typography.fontWeight.medium};
  word-break: break-word;
`;

const TableWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

const DescriptionText = styled.p`
  font-size: ${typography.fontSize.base};
  color: ${colors.text.secondary};
  margin: ${spacing[3]} 0 ${spacing[4]} 0;
  line-height: 1.6;
`;

const NoteBanner = styled.div`
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: ${radius.lg};
  padding: ${spacing[3]} ${spacing[4]};
  margin-bottom: ${spacing[4]};
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.warning};
`;

// ---- 实时输出样式 ----

const StreamPanel = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[4]};
  display: flex;
  flex-direction: column;
  max-height: 70vh;
`;

const StreamHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  margin-bottom: ${spacing[3]};
  flex-shrink: 0;
`;

const StreamStatus = styled.span<{ $color: string }>`
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.semibold};
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  gap: ${spacing[1]};
`;

const StreamBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${spacing[2]};
  background: ${colors.neutral[50]};
  border-radius: ${radius.lg};
  min-height: 200px;
`;

const StreamTextLine = styled.div<{ $isError?: boolean; $isThinking?: boolean }>`
  font-family: ${({ $isThinking }) => $isThinking ? typography.fontFamily.mono : typography.fontFamily.sans};
  font-size: ${({ $isThinking }) => $isThinking ? typography.fontSize.xs : typography.fontSize.sm};
  color: ${({ $isError, $isThinking }) =>
    $isError ? colors.text.error : $isThinking ? colors.text.muted : colors.text.primary};
  padding: ${spacing[1]} 0;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  opacity: ${({ $isThinking }) => $isThinking ? 0.7 : 1};
`;

const StreamSummary = styled.div`
  margin-top: ${spacing[3]};
  padding: ${spacing[3]} ${spacing[4]};
  background: ${colors.neutral[50]};
  border-radius: ${radius.lg};
  border-left: 3px solid ${colors.primary[500]};
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
  line-height: 1.6;
  flex-shrink: 0;
`;

const { Option } = Select;
const { TextArea } = Input;

// --------------- Helper ---------------
function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = end - start;
  if (diffMs < 0) return '-';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

function formatTokenCount(count?: number): string {
  if (count == null) return '-';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

// --------------- Component ---------------
export const TaskDetailPage: React.FC = () => {
  const { id, taskId } = useParams<{ id?: string; taskId?: string }>();
  const effectiveTaskId = taskId || id || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const streamEndRef = useRef<HTMLDivElement>(null);

  // Fetch task detail
  const {
    data: taskRes,
    isLoading: taskLoading,
    isError: taskError,
    error: taskErr,
    refetch,
  } = useQuery<ApiResponse<Task>>(
    ['task', effectiveTaskId],
    () => tasksApi.getById(effectiveTaskId!) as any,
    { enabled: !!id, refetchOnWindowFocus: false },
  );

  const task = taskRes?.data;

  // SSE 实时流 — 任务 running 时才连接
  const isTaskRunning = task?.status === 'running';
  const { events: streamEvents, progress: streamProgress, isConnected, isDone } = useTaskStream(effectiveTaskId, {
    enabled: isTaskRunning,
  });

  // 从事件流中提取文件变更列表
  const fileChanges = streamEvents
    .filter((e) => e.event?.type === 'tool_use' && (e.event.toolName === 'Write' || e.event.toolName === 'Edit'))
    .map((e) => {
      const input = e.event!.toolInput as Record<string, unknown> | undefined;
      const path = String(input?.file_path ?? '');
      const action = e.event!.toolName === 'Write' ? 'created' as const : 'edited' as const;
      return { path, action };
    });

  // 自动滚动到底部
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamEvents.length]);

  // Fetch task logs
  const {
    data: logsRes,
    isLoading: logsLoading,
  } = useQuery<ApiResponse<{ items: TaskLog[]; total: number }>>(
    ['task-logs', id],
    () => api.get(`/tasks/${id}/logs`) as any,
    { enabled: !!id, refetchOnWindowFocus: false },
  );

  const logs = Array.isArray(logsRes?.data?.items) ? logsRes.data.items : [];

  // Jobs: placeholder until job API is available
  const jobs: Job[] = []; // TODO: replace with useQuery for job API

  // Update mutation
  const updateMutation = useMutation(
    (data: Partial<Task>) => tasksApi.update(effectiveTaskId!, data),
    {
      onSuccess: () => {
        void message.success('任务更新成功');
        setEditModalVisible(false);
        void queryClient.invalidateQueries(['task', id]);
      },
      onError: () => {
        void message.error('任务更新失败');
      },
    },
  );

  // Delete mutation
  const deleteMutation = useMutation(
    () => tasksApi.delete(effectiveTaskId!),
    {
      onSuccess: () => {
        void message.success('任务删除成功');
        navigate('/tasks');
      },
      onError: () => {
        void message.error('任务删除失败');
      },
    },
  );

  // Handlers
  const handleRetryJob = (_jobId: string) => {
    // TODO: implement retry via job API
    message.info('Job 重试功能待接入后端 API');
  };

  const handleEdit = () => {
    if (!task) return;
    editForm.setFieldsValue({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      input: task.input ? JSON.stringify(task.input, null, 2) : '',
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      let parsedInput = values.input;
      if (typeof values.input === 'string' && values.input.trim()) {
        try {
          parsedInput = JSON.parse(values.input);
        } catch {
          void message.error('输入参数不是有效的 JSON');
          return;
        }
      }
      updateMutation.mutate({
        title: values.title,
        description: values.description,
        priority: values.priority,
        input: parsedInput || undefined,
      });
    } catch {
      // form validation failed
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  // ---- Loading ----
  if (taskLoading) {
    return (
      <div>
        <PageHeader title="加载中..." />
        <InfoCard>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 20, background: colors.surface.raised, borderRadius: 4 }} />
            ))}
          </Space>
        </InfoCard>
      </div>
    );
  }

  // ---- Error ----
  if (taskError) {
    return (
      <div>
        <PageHeader
          title="任务详情"
          actions={
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
            >
              返回
            </Button>
          }
        />
        <ErrorBlock
          message={
            taskErr instanceof Error
              ? taskErr.message
              : '任务加载失败，请稍后重试'
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!task) {
    return (
      <div>
        <PageHeader title="任务详情" />
        <EmptyState description="任务不存在" />
      </div>
    );
  }

  // ---- Log table columns ----
  const logColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => {
        const colorMap: Record<string, string> = {
          info: 'blue',
          warn: 'orange',
          error: 'red',
        };
        return <Tag color={colorMap[level] || 'default'}>{level.toUpperCase()}</Tag>;
      },
    },
    {
      title: '消息内容',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
  ];

  // ---- Job table columns ----
  const jobColumns = [
    {
      title: 'Agent ID',
      dataIndex: 'agent_id',
      key: 'agent_id',
      render: (agentId: string) => (
        <span style={{ color: colors.text.brand, fontFamily: typography.fontFamily.mono }}>
          {agentId}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: Job['status']) => (
        <StatusBadge status={jobStatusToBadge[status]} />
      ),
    },
    {
      title: 'Token 消耗',
      dataIndex: 'token_usage',
      key: 'token_usage',
      width: 120,
      render: (val: number | undefined) => formatTokenCount(val),
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (val: string | undefined) =>
        val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 180,
      render: (val: string | undefined) =>
        val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
    {
      title: '耗时',
      key: 'duration',
      width: 100,
      render: (_val: unknown, record: Job) =>
        formatDuration(record.started_at, record.completed_at),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_val: unknown, record: Job) =>
        record.status === 'failed' ? (
          <Tooltip title="重试">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRetryJob(record.id)}
              style={{ color: colors.primary[400] }}
            />
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title={task.title}
        actions={
          <Space>
            <Button icon={<EditOutlined />} onClick={handleEdit}>
              编辑
            </Button>
            <Popconfirm
              title="确认删除"
              description="确定要删除这个任务吗？此操作不可撤销。"
              onConfirm={handleDelete}
              okText="确认"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        }
      />

      {/* Task info card */}
      <InfoCard>
        <Space style={{ marginBottom: spacing[4] }}>
          <Tag color={priorityColors[task.priority]}>
            {priorityLabels[task.priority]}
          </Tag>
          <StatusBadge status={statusToBadge[task.status]} />
        </Space>

        {task.description && (
          <DescriptionText>{task.description}</DescriptionText>
        )}

        <InfoGrid>
          <InfoItem>
            <InfoLabel>创建时间</InfoLabel>
            <InfoValue>
              {new Date(task.created_at).toLocaleString('zh-CN')}
            </InfoValue>
          </InfoItem>
          <InfoItem>
            <InfoLabel>更新时间</InfoLabel>
            <InfoValue>
              {new Date(task.updated_at).toLocaleString('zh-CN')}
            </InfoValue>
          </InfoItem>
          {task.started_at && (
            <InfoItem>
              <InfoLabel>开始时间</InfoLabel>
              <InfoValue>
                {new Date(task.started_at).toLocaleString('zh-CN')}
              </InfoValue>
            </InfoItem>
          )}
          {task.completed_at && (
            <InfoItem>
              <InfoLabel>完成时间</InfoLabel>
              <InfoValue>
                {new Date(task.completed_at).toLocaleString('zh-CN')}
              </InfoValue>
            </InfoItem>
          )}
          {task.assigned_agent_id && (
            <InfoItem>
              <InfoLabel>分配 Agent</InfoLabel>
              <InfoValue style={{ fontFamily: typography.fontFamily.mono }}>
                {task.assigned_agent_id}
              </InfoValue>
            </InfoItem>
          )}
          {task.cost_usd != null && task.cost_usd > 0 && (
            <InfoItem>
              <InfoLabel>费用</InfoLabel>
              <InfoValue style={{ color: colors.text.brand }}>
                ${task.cost_usd.toFixed(4)}
              </InfoValue>
            </InfoItem>
          )}
          {task.retry_count != null && task.retry_count > 0 && (
            <InfoItem>
              <InfoLabel>重试</InfoLabel>
              <InfoValue>
                {task.retry_count} / {task.max_retries ?? 0}
              </InfoValue>
            </InfoItem>
          )}
        </InfoGrid>
      </InfoCard>

      {/* Job list + Logs + 实时输出 */}
      <Tabs
        defaultActiveKey="stream"
        items={[
          {
            key: 'stream',
            label: '实时输出',
            children: (
              <StreamPanel>
                <StreamHeader>
                  <Progress
                    percent={streamProgress}
                    size="small"
                    style={{ flex: 1, maxWidth: 200 }}
                    status={isDone ? (streamEvents[streamEvents.length - 1]?.success !== false ? 'success' : 'exception') : 'active'}
                  />
                  {isConnected && (
                    <StreamStatus $color={colors.info[500]}>
                      <LoadingOutlined spin /> 连接中
                    </StreamStatus>
                  )}
                  {isDone && (
                    <StreamStatus $color={streamEvents[streamEvents.length - 1]?.success !== false ? colors.success[700] : colors.error[700]}>
                      {streamEvents[streamEvents.length - 1]?.success !== false ? (
                        <><CheckCircleOutlined /> 已完成</>
                      ) : (
                        <><CloseCircleOutlined /> 已结束</>
                      )}
                    </StreamStatus>
                  )}
                  {!isConnected && !isDone && !isTaskRunning && (
                    <StreamStatus $color={colors.text.muted}>未连接</StreamStatus>
                  )}
                </StreamHeader>

                <StreamBody>
                  {streamEvents.length === 0 && (
                    <EmptyState
                      description={isTaskRunning ? '等待事件...' : '暂无实时输出'}
                    />
                  )}

                  {streamEvents.map((msg, i) => {
                    const evt = msg.event;
                    if (!evt) return null;

                    // 工具调用 → 使用 ToolUseCard
                    if (evt.type === 'tool_use') {
                      return <ToolUseCard key={i} event={evt} />;
                    }

                    // 工具结果 → 内联展示
                    if (evt.type === 'tool_result' && evt.isError) {
                      return (
                        <StreamTextLine key={i} $isError>
                          [错误] {evt.toolName ? `[${evt.toolName}] ` : ''}{evt.content}
                        </StreamTextLine>
                      );
                    }

                    // 思考过程
                    if (evt.type === 'thinking') {
                      return (
                        <StreamTextLine key={i} $isThinking>
                          💭 {evt.content}
                        </StreamTextLine>
                      );
                    }

                    // 错误事件
                    if (evt.type === 'error') {
                      return (
                        <StreamTextLine key={i} $isError>
                          ⚠ {evt.content}
                        </StreamTextLine>
                      );
                    }

                    // 普通文本
                    if (evt.type === 'text' && evt.content) {
                      return (
                        <StreamTextLine key={i}>
                          {evt.content}
                        </StreamTextLine>
                      );
                    }

                    return null;
                  })}
                  <div ref={streamEndRef} />
                </StreamBody>

                {/* 文件变更列表 */}
                {fileChanges.length > 0 && (
                  <FileChangeList files={fileChanges} />
                )}

                {/* 完成摘要 */}
                {isDone && streamEvents[streamEvents.length - 1]?.event?.content && (
                  <StreamSummary>
                    {streamEvents[streamEvents.length - 1].event!.content}
                  </StreamSummary>
                )}
              </StreamPanel>
            ),
          },
          {
            key: 'jobs',
            label: 'Job 列表',
            children: (
              <TableWrapper>
                <NoteBanner>Job API 尚未接入，以下为占位展示。</NoteBanner>

                {jobs.length === 0 ? (
                  <EmptyState description="暂无 Job 记录" />
                ) : (
                  <Table
                    columns={jobColumns}
                    dataSource={jobs}
                    rowKey="id"
                    pagination={false}
                  />
                )}
              </TableWrapper>
            ),
          },
          {
            key: 'logs',
            label: '日志',
            children: (
              <TableWrapper>
                <Table<TaskLog>
                  columns={logColumns}
                  dataSource={logs}
                  rowKey="id"
                  loading={logsLoading}
                  locale={{ emptyText: '暂无日志' }}
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                />
              </TableWrapper>
            ),
          },
        ]}
      />

      {/* Edit Modal */}
      <Modal
        title="编辑任务"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={updateMutation.isLoading}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="任务名称"
            name="title"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="输入任务名称" />
          </Form.Item>
          <Form.Item
            label="任务描述"
            name="description"
          >
            <TextArea rows={3} placeholder="输入任务描述" />
          </Form.Item>
          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select placeholder="选择优先级">
              <Option value="low">低</Option>
              <Option value="medium">中</Option>
              <Option value="high">高</Option>
              <Option value="critical">紧急</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="输入参数 (JSON)"
            name="input"
          >
            <TextArea
              rows={6}
              placeholder='{"prompt": "编写一个Python脚本"}'
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskDetailPage;
