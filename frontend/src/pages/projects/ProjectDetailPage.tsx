import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Button, Table, Modal, Form, Input, Select, Tag, Tabs, Space, Skeleton, message, Card,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  InboxOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
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
import { CreateTaskModal } from './components/CreateTaskModal';
import { DocumentManager } from './components/DocumentManager';
import { AgentConfigEditor } from './components/AgentConfigEditor';
import { FileManager } from './components/FileManager';
import { projectApi } from '@/api/projects';
import type { ApiResponse, PagedData } from '@/types/api';
import type { Project } from '@/types/project';
import type { Task } from '@/types/task';

// --------------- Priority helpers ---------------
const priorityColors: Record<string, string> = {
  low: 'default',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};
const priorityLabels: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '紧急' };

const scheduleLabels: Record<string, string> = { immediate: '立即', cron: '定时', interval: '循环' };
const scheduleBadgeColors: Record<string, string> = { immediate: 'default', cron: 'purple', interval: 'cyan' };

// --------------- Status badge mapping ---------------
const statusToBadge: Record<string, string> = {
  pending: 'pending', running: 'running', completed: 'completed',
  failed: 'failed', cancelled: 'cancelled', paused: 'paused',
  scheduled: 'pending',
};

// --------------- Styled components ---------------
const InfoCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  margin-bottom: ${spacing[6]};
`;

const ProjectTitle = styled.h2`
  font-size: ${typography.fontSize.xl};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin: 0 0 ${spacing[1]} 0;
`;

const DescriptionText = styled.p<{ $expanded?: boolean }>`
  font-size: ${typography.fontSize.base};
  color: ${colors.text.secondary};
  margin: ${spacing[3]} 0 ${spacing[4]} 0;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  ${props => props.$expanded ? '-webkit-line-clamp: unset; white-space: pre-wrap;' : ''}
`;

const ToggleBtn = styled.span`
  cursor: pointer;
  color: ${colors.text.brand};
  font-size: ${typography.fontSize.sm};
  user-select: none;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${spacing[4]};
  margin-bottom: ${spacing[6]};
`;

const StatCard = styled(Card)`
  .ant-card-body {
    padding: ${spacing[4]} ${spacing[5]};
    text-align: center;
  }
`;

const StatCardValue = styled.div`
  font-size: ${typography.fontSize.xl};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin-bottom: ${spacing[1]};
`;

const StatCardLabel = styled.div`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.muted};
`;

const TableWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

const TableHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${spacing[4]};
`;

const TableTitle = styled.h3`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin: 0;
`;

const FilterRow = styled.div`
  display: flex;
  gap: ${spacing[2]};
  margin-bottom: ${spacing[4]};
`;

const TabContent = styled.div`
  min-height: 300px;
`;

const CollapseWrapper = styled.div`
  margin-bottom: ${spacing[6]};
`;

// --------------- Status filter options ---------------
const statusFilterOptions = [
  { label: '全部', value: '' },
  { label: '待执行', value: 'pending' },
  { label: '已调度', value: 'scheduled' },
  { label: '执行中', value: 'running' },
  { label: '已暂停', value: 'paused' },
  { label: '已完成', value: 'completed' },
  { label: '已失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
];

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [descExpanded, setDescExpanded] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editForm] = Form.useForm<{ name: string; description?: string }>();

  // Fetch project detail
  const {
    data: projectRes,
    isLoading: projectLoading,
    isError: projectError,
    error: projectErr,
    refetch: refetchProject,
  } = useQuery<ApiResponse<Project>>(
    ['project', id],
    () => projectApi.getById(id!),
    { enabled: !!id, refetchOnWindowFocus: false },
  );
  const project = projectRes?.data;

  // Fetch tasks
  const {
    data: tasksRes,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErr,
    refetch: refetchTasks,
  } = useQuery<ApiResponse<PagedData<Task>>>(
    ['project-tasks', id, { page, page_size: pageSize, status: statusFilter || undefined }],
    () => projectApi.getTasks(id!, { page, page_size: pageSize, status: statusFilter || undefined }),
    { enabled: !!id, refetchOnWindowFocus: false },
  );

  const tasks = (tasksRes as any)?.items ?? (tasksRes as any)?.data?.items ?? [];
  const total = (tasksRes as any)?.total ?? (tasksRes as any)?.data?.total ?? 0;

  // Edit project mutation
  const editMutation = useMutation(
    (values: { name: string; description?: string }) => projectApi.update(id!, values),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project', id]);
        setEditModalOpen(false);
        editForm.resetFields();
        message.success('项目已更新');
      },
      onError: () => { message.error('更新失败'); },
    },
  );

  // Archive project mutation
  const archiveMutation = useMutation(
    () => projectApi.archive(id!),
    {
      onSuccess: () => {
        message.success('项目已归档');
        queryClient.invalidateQueries(['projects']);
        navigate('/projects');
      },
      onError: () => { message.error('归档失败'); },
    },
  );

  // Create task handler
  const handleTaskCreated = (data: Record<string, unknown>) => {
    projectApi.createTask(id!, data as any).then(() => {
      queryClient.invalidateQueries(['project-tasks', id]);
      queryClient.invalidateQueries(['project', id]);
      setTaskModalOpen(false);
      message.success('任务已创建');
    }).catch(() => message.error('创建任务失败'));
  };

  // Handlers
  const handleEdit = () => {
    if (project) {
      editForm.setFieldsValue({ name: project.name, description: project.description });
    }
    setEditModalOpen(true);
  };

  const handleEditSubmit = () => {
    editForm.validateFields().then((values) => editMutation.mutate(values));
  };

  const handleArchive = () => {
    Modal.confirm({
      title: '确认归档',
      icon: <ExclamationCircleOutlined />,
      content: `确定要归档项目「${project?.name}」吗？归档后可在管理后台恢复。`,
      okText: '确认归档',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => archiveMutation.mutate(),
    });
  };

  // ---- Loading ----
  if (projectLoading) {
    return (
      <div>
        <PageHeader title="加载中..." />
        <InfoCard>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Skeleton active paragraph={{ rows: 3 }} />
          </Space>
        </InfoCard>
      </div>
    );
  }

  // ---- Error ----
  if (projectError) {
    return (
      <div>
        <PageHeader title="项目详情" />
        <ErrorBlock
          message={projectErr instanceof Error ? projectErr.message : '项目加载失败，请稍后重试'}
          onRetry={() => refetchProject()}
        />
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <PageHeader title="项目详情" />
        <EmptyState description="项目不存在" />
      </div>
    );
  }

  // ---- Overview stats ----
  const stats = [
    {
      title: '任务总数',
      value: project.total_tasks ?? 0,
      icon: <UnorderedListOutlined />,
      color: colors.primary[500],
    },
    {
      title: '已完成',
      value: project.completed_tasks ?? 0,
      icon: <CheckCircleOutlined />,
      color: colors.success[500],
    },
    {
      title: '关联工作流',
      value: project.workflow_id ? '已关联' : '未关联',
      icon: <ThunderboltOutlined />,
      color: project.workflow_id ? colors.warning[500] : colors.text.muted,
      isText: true,
    },
    {
      title: 'Token 消耗',
      value: project.total_tokens
        ? (project.total_tokens >= 1_000_000 ? `${(project.total_tokens / 1_000_000).toFixed(1)}M` : project.total_tokens >= 1_000 ? `${(project.total_tokens / 1_000).toFixed(0)}K` : String(project.total_tokens))
        : '0',
      icon: <ClockCircleOutlined />,
      color: colors.text.muted,
      isText: true,
    },
  ];

  // ---- Task table columns ----
  const taskColumns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: Task) => (
        <a onClick={() => navigate(`/projects/${id}/tasks/${record.id}`)} style={{ color: colors.text.brand, textDecoration: 'none' }}>
          {text}
        </a>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => (
        <Tag color={priorityColors[priority]}>{priorityLabels[priority] || priority}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => <StatusBadge status={statusToBadge[status] ?? status} />,
    },
    {
      title: '工作流',
      dataIndex: 'workflow_name',
      key: 'workflow_name',
      width: 140,
      render: (val: string) => val ? <Tag>{val}</Tag> : <span style={{ color: colors.text.muted }}>-</span>,
    },
    {
      title: 'Agent',
      dataIndex: 'agent_name',
      key: 'agent_name',
      width: 120,
      render: (val: string) => val ? <Tag color="blue">{val}</Tag> : <span style={{ color: colors.text.muted }}>-</span>,
    },
    {
      title: '执行方式',
      dataIndex: 'schedule_type',
      key: 'schedule_type',
      width: 100,
      render: (val: string) => val ? (
        <Tag color={scheduleBadgeColors[val] || 'default'}>{scheduleLabels[val] || val}</Tag>
      ) : (
        <span style={{ color: colors.text.muted }}>立即</span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
    },
  ];

  // ---- Tab items ----
  const tabItems = [
    {
      key: 'overview',
      label: '概述',
      children: (
        <TabContent>
          <InfoCard>
            <ProjectTitle>{project.name}</ProjectTitle>
            {project.description && (
              <>
                <DescriptionText $expanded={descExpanded}>{project.description}</DescriptionText>
                <ToggleBtn onClick={() => setDescExpanded(!descExpanded)}>
                  {descExpanded ? '收起' : '展开全部'}
                </ToggleBtn>
              </>
            )}
            <InfoGrid>
              <InfoItem>
                <InfoLabel>状态</InfoLabel>
                <InfoValue><StatusBadge status={project.status === 'deleted' ? 'archived' : project.status} /></InfoValue>
              </InfoItem>
              <InfoItem>
                <InfoLabel>创建时间</InfoLabel>
                <InfoValue>{new Date(project.created_at).toLocaleString('zh-CN')}</InfoValue>
              </InfoItem>
              <InfoItem>
                <InfoLabel>更新时间</InfoLabel>
                <InfoValue>{new Date(project.updated_at).toLocaleString('zh-CN')}</InfoValue>
              </InfoItem>
            </InfoGrid>
          </InfoCard>

          <CollapseWrapper>
            <StatsRow>
              {stats.map((s) => (
                <StatCard key={s.title} size="small" bordered={false}>
                  <StatCardValue style={{ color: s.color }}>{s.value}</StatCardValue>
                  <StatCardLabel>{s.title}</StatCardLabel>
                </StatCard>
              ))}
            </StatsRow>
          </CollapseWrapper>
        </TabContent>
      ),
    },
    {
      key: 'tasks',
      label: `任务 (${total})`,
      children: (
        <TabContent>
          <TableWrapper>
            <TableHeader>
              <TableTitle>任务列表</TableTitle>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setTaskModalOpen(true)}>
                创建任务
              </Button>
            </TableHeader>
            <FilterRow>
              {statusFilterOptions.map((opt) => (
                <Select
                  key={opt.value}
                  value={opt.value}
                  onChange={(val) => { setStatusFilter(val || ''); setPage(1); }}
                  style={{ width: 120 }}
                  options={[opt]}
                  size="small"
                />
              ))}
            </FilterRow>
            {tasksError ? (
              <ErrorBlock message={tasksErr instanceof Error ? tasksErr.message : '任务列表加载失败'} onRetry={() => refetchTasks()} />
            ) : tasksLoading ? (
              <Table columns={taskColumns} dataSource={[]} loading pagination={false} rowKey="id" />
            ) : tasks.length === 0 ? (
              <EmptyState icon={<InboxOutlined style={{ fontSize: 48, color: colors.text.disabled }} />} description="还没有任务，点击上方按钮创建" />
            ) : (
              <Table
                columns={taskColumns}
                dataSource={tasks}
                rowKey="id"
                pagination={{
                  current: page,
                  pageSize,
                  total,
                  showSizeChanger: false,
                  showTotal: (t) => `共 ${t} 条`,
                  onChange: (p) => setPage(p),
                }}
              />
            )}
          </TableWrapper>
        </TabContent>
      ),
    },
    {
      key: 'documents',
      label: '文档库',
      children: (
        <TabContent>
          <DocumentManager projectId={id!} />
        </TabContent>
      ),
    },
    {
      key: 'agent-config',
      label: 'Agent 配置',
      children: (
        <TabContent>
          <AgentConfigEditor projectId={id!} />
        </TabContent>
      ),
    },
    {
      key: 'files',
      label: '文件管理',
      children: (
        <TabContent>
          <FileManager projectId={id!} />
        </TabContent>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={project.name}
        actions={
          <Space>
            <Button icon={<EditOutlined />} onClick={handleEdit}>编辑</Button>
            <Button danger onClick={handleArchive}>归档</Button>
          </Space>
        }
      />

      <Tabs
        items={tabItems}
        defaultActiveKey="overview"
        style={{ marginTop: spacing[4] }}
      />

      {/* Edit project modal */}
      <Modal
        title="编辑项目"
        open={editModalOpen}
        onOk={handleEditSubmit}
        onCancel={() => { setEditModalOpen(false); editForm.resetFields(); }}
        confirmLoading={editMutation.isLoading}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={3} placeholder="请输入项目描述（可选）" showCount maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create task modal */}
      <CreateTaskModal
        open={taskModalOpen}
        onCancel={() => setTaskModalOpen(false)}
        onCreated={handleTaskCreated}
        defaultWorkflowId={project.workflow_id ?? undefined}
      />
    </div>
  );
};

export default ProjectDetailPage;
