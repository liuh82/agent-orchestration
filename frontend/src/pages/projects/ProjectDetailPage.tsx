import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Button, Table, Modal, Form, Input, Select, Tag, Tabs, Space, Skeleton, message } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  InboxOutlined,
  ExclamationCircleOutlined,
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
import { projectApi } from '@/api/projects';
import { DocumentManager } from './components/DocumentManager';
import { AgentConfigEditor } from './components/AgentConfigEditor';
import { FileManager } from './components/FileManager';
import type { ApiResponse, PagedData } from '@/types/api';
import type { Project } from '@/types/project';
import type { Task } from '@/types/task';

// --------------- Priority color mapping ---------------
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

const statusToBadge: Record<Task['status'], 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'> = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};

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

const DescriptionText = styled.p`
  font-size: ${typography.fontSize.base};
  color: ${colors.text.secondary};
  margin: ${spacing[3]} 0 ${spacing[4]} 0;
  line-height: 1.6;
`;

const TabContent = styled.div`
  min-height: 300px;
`;

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editForm] = Form.useForm<{ name: string; description?: string }>();
  const [taskForm] = Form.useForm<{
    title: string;
    description?: string;
    priority: Task['priority'];
  }>();

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
    ['project-tasks', id, { page, page_size: pageSize }],
    () => projectApi.getTasks(id!, { page, page_size: pageSize }),
    { enabled: !!id, refetchOnWindowFocus: false },
  );

  const tasks = tasksRes?.data?.items ?? [];
  const total = tasksRes?.data?.total ?? 0;

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
      onError: () => {
        message.error('更新失败');
      },
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
      onError: () => {
        message.error('归档失败');
      },
    },
  );

  // Create task mutation
  const createTaskMutation = useMutation(
    (values: { title: string; description?: string; priority: Task['priority'] }) =>
      projectApi.createTask(id!, values),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project-tasks', id]);
        setTaskModalOpen(false);
        taskForm.resetFields();
        message.success('任务已创建');
      },
      onError: () => {
        message.error('创建任务失败');
      },
    },
  );

  // Handlers
  const handleEdit = () => {
    if (project) {
      editForm.setFieldsValue({ name: project.name, description: project.description });
    }
    setEditModalOpen(true);
  };

  const handleEditSubmit = () => {
    editForm.validateFields().then((values) => {
      editMutation.mutate(values);
    });
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

  const handleCreateTask = () => {
    taskForm.validateFields().then((values) => {
      createTaskMutation.mutate(values);
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

  // ---- Task table columns ----
  const taskColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Task) => (
        <a onClick={() => navigate(`/tasks/${record.id}`)} style={{ color: colors.text.brand, textDecoration: 'none' }}>
          {text}
        </a>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: Task['priority']) => (
        <Tag color={priorityColors[priority]}>{priorityLabels[priority]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: Task['status']) => <StatusBadge status={statusToBadge[status]} />,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
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
            {project.description && <DescriptionText>{project.description}</DescriptionText>}
            <InfoGrid>
              <InfoItem>
                <InfoLabel>状态</InfoLabel>
                <InfoValue><StatusBadge status={project.status === 'deleted' ? 'archived' : project.status} /></InfoValue>
              </InfoItem>
              <InfoItem>
                <InfoLabel>创建者</InfoLabel>
                <InfoValue>{(project as any).created_by || '-'}</InfoValue>
              </InfoItem>
              <InfoItem>
                <InfoLabel>创建时间</InfoLabel>
                <InfoValue>{new Date(project.created_at).toLocaleString('zh-CN')}</InfoValue>
              </InfoItem>
              <InfoItem>
                <InfoLabel>更新时间</InfoLabel>
                <InfoValue>{new Date(project.updated_at).toLocaleString('zh-CN')}</InfoValue>
              </InfoItem>
              <InfoItem>
                <InfoLabel>任务总数</InfoLabel>
                <InfoValue>{total}</InfoValue>
              </InfoItem>
              {(project as any).total_tokens != null && (
                <InfoItem>
                  <InfoLabel>Token 消耗</InfoLabel>
                  <InfoValue>{(project as any).total_tokens.toLocaleString()}</InfoValue>
                </InfoItem>
              )}
            </InfoGrid>
          </InfoCard>
        </TabContent>
      ),
    },
    {
      key: 'tasks',
      label: '任务',
      children: (
        <TabContent>
          <TableWrapper>
            <TableHeader>
              <TableTitle>任务列表</TableTitle>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setTaskModalOpen(true)}>
                创建任务
              </Button>
            </TableHeader>
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
      <Modal
        title="创建任务"
        open={taskModalOpen}
        onOk={handleCreateTask}
        onCancel={() => { setTaskModalOpen(false); taskForm.resetFields(); }}
        confirmLoading={createTaskMutation.isLoading}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={taskForm} layout="vertical" preserve={false} initialValues={{ priority: 'medium' as const }}>
          <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入任务标题' }]}>
            <Input placeholder="请输入任务标题" />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <Input.TextArea rows={3} placeholder="请输入任务描述（可选）" showCount maxLength={1000} />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select>
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="critical">紧急</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectDetailPage;
