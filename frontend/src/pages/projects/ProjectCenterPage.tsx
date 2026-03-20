import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { Button, Table, Tag, Skeleton, Select, Empty, Space, Tabs, message, Tooltip } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { typography } from '@/styles/tokens/typography';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { ProjectCard } from './ProjectCard';
import { CreateProjectModal } from './components/CreateProjectModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { projectApi } from '@/api/projects';
import { tasksApi } from '@/api/tasks';
import type { ApiResponse, PagedData } from '@/types/api';
import type { Project } from '@/types/project';
import type { Task } from '@/types/task';

// --------------- Constants ---------------

const statusToBadge: Record<string, string> = {
  pending: 'pending', running: 'running', completed: 'completed',
  failed: 'failed', cancelled: 'cancelled', paused: 'paused',
  scheduled: 'pending',
};

const priorityColors: Record<string, string> = {
  low: 'default', medium: 'blue', high: 'orange', critical: 'red',
};
const priorityLabels: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '紧急' };

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

// --------------- Styled components ---------------

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${spacing[6]};

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const SkeletonCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

const SkeletonRow = styled.div`
  &:not(:last-child) {
    margin-bottom: ${spacing[3]};
  }
`;

const TabContent = styled.div`
  min-height: 300px;
`;

const TableWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

const FilterRow = styled.div`
  display: flex;
  gap: ${spacing[2]};
  margin-bottom: ${spacing[4]};
`;

// --------------- Component ---------------

export const ProjectCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('projects');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [indieStatusFilter, setIndieStatusFilter] = useState<string>('');

  // ── Project list ──
  const {
    data: projectsData,
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErr,
    refetch: refetchProjects,
  } = useQuery<ApiResponse<PagedData<Project>>>(
    ['projects', { page: 1, page_size: 100 }],
    () => projectApi.list({ page: 1, page_size: 100 }),
    { refetchOnWindowFocus: false },
  );
  const projects = (projectsData as any)?.items ?? (projectsData as any)?.data?.items ?? [];

  // ── Independent tasks ──
  const {
    data: indieTasksData,
    isLoading: indieLoading,
    isError: indieError,
    error: indieErr,
    refetch: refetchIndie,
    isFetching: indieFetching,
  } = useQuery<ApiResponse<PagedData<Task>>>(
    ['independent-tasks', indieStatusFilter || undefined],
    () => tasksApi.list({
      page: 1,
      page_size: 50,
      project_id: '__none__',
      status: indieStatusFilter || undefined,
    } as any),
    { enabled: activeTab === 'indie-tasks', refetchOnWindowFocus: false },
  );
  const indieTasks = (indieTasksData as any)?.items ?? (indieTasksData as any)?.data?.items ?? [];

  // ── Create project handler ──
  const handleProjectCreated = useCallback(
    (data: { name: string; description?: string; workflow_id?: string; config_overrides?: Record<string, Record<string, unknown>> }) => {
      projectApi.create(data).then(() => {
        queryClient.invalidateQueries(['projects']);
        setCreateProjectOpen(false);
        message.success('项目创建成功');
        // Navigate to the new project detail page
        // Find the newly created project (it should be the first one)
        setTimeout(() => {
          queryClient.invalidateQueries(['projects']).then(() => {
            // The project was just created, navigate to it
          });
        }, 300);
      }).catch(() => message.error('项目创建失败'));
    },
    [queryClient],
  );

  // ── Create independent task handler ──
  const handleIndieTaskCreated = useCallback(
    (data: Record<string, unknown>) => {
      tasksApi.create(data as any).then(() => {
        queryClient.invalidateQueries(['independent-tasks']);
        setCreateTaskOpen(false);
        message.success('独立任务创建成功');
      }).catch(() => message.error('任务创建失败'));
    },
    [queryClient],
  );

  // ── Tab items ──
  const tabItems = [
    {
      key: 'projects',
      label: '全部项目',
      children: (
        <TabContent>
          {projectsLoading ? (
            <GridContainer>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i}>
                  <SkeletonRow>
                    <Skeleton active title={{ width: '60%' }} paragraph={false} />
                  </SkeletonRow>
                  <SkeletonRow>
                    <Skeleton active title={false} paragraph={{ rows: 2 }} />
                  </SkeletonRow>
                  <SkeletonRow>
                    <Skeleton active title={false} paragraph={{ rows: 1 }} />
                  </SkeletonRow>
                </SkeletonCard>
              ))}
            </GridContainer>
          ) : projectsError ? (
            <ErrorBlock
              message={projectsErr instanceof Error ? projectsErr.message : '项目列表加载失败'}
              onRetry={() => refetchProjects()}
            />
          ) : projects.length === 0 ? (
            <EmptyState
              description="还没有项目，点击创建开始使用"
              action={
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateProjectOpen(true)}>
                  创建项目
                </Button>
              }
            />
          ) : (
            <GridContainer>
              {projects.map((project: any) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => navigate(`/projects/${project.id}`)}
                />
              ))}
            </GridContainer>
          )}
        </TabContent>
      ),
    },
    {
      key: 'indie-tasks',
      label: '独立任务',
      children: (
        <TabContent>
          {indieError ? (
            <ErrorBlock
              message={indieErr instanceof Error ? indieErr.message : '任务列表加载失败'}
              onRetry={() => refetchIndie()}
            />
          ) : (
            <TableWrapper>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] }}>
                <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.text.primary }}>
                  独立任务
                </h3>
                <Space>
                  <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateTaskOpen(true)}>
                    创建任务
                  </Button>
                  <Tooltip title="刷新">
                    <Button icon={<ReloadOutlined spin={indieFetching} />} onClick={() => refetchIndie()} />
                  </Tooltip>
                </Space>
              </div>
              <FilterRow>
                {statusFilterOptions.map((opt) => (
                  <Select
                    key={opt.value}
                    value={opt.value}
                    onChange={(val) => { setIndieStatusFilter(val || ''); }}
                    style={{ width: 100 }}
                    options={[opt]}
                    size="small"
                  />
                ))}
              </FilterRow>
              <Table<Task>
                dataSource={indieTasks}
                rowKey="id"
                loading={indieLoading}
                locale={{ emptyText: <Empty description="暂无独立任务" /> }}
                pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                onRow={(record) => ({
                  onClick: () => navigate(`/tasks/${record.id}`),
                  style: { cursor: 'pointer' },
                })}
                columns={[
                  {
                    title: '任务名称',
                    dataIndex: 'title',
                    key: 'title',
                    ellipsis: true,
                    render: (text: string) => (
                      <a style={{ color: colors.text.brand, textDecoration: 'none' }}>{text}</a>
                    ),
                  },
                  {
                    title: '优先级',
                    dataIndex: 'priority',
                    key: 'priority',
                    width: 80,
                    render: (val: string) => (
                      <Tag color={priorityColors[val]}>{priorityLabels[val] || val}</Tag>
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    width: 120,
                    render: (val: string) => <StatusBadge status={statusToBadge[val] ?? val} />,
                  },
                  {
                    title: '创建时间',
                    dataIndex: 'created_at',
                    key: 'created_at',
                    width: 170,
                    render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
                  },
                ]}
              />
            </TableWrapper>
          )}
        </TabContent>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="项目"
        actions={
          activeTab === 'projects' ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateProjectOpen(true)}>
              创建项目
            </Button>
          ) : (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateTaskOpen(true)}>
              创建任务
            </Button>
          )
        }
      />

      {/* Antd Tabs styled via ConfigProvider theme */}
      <div
        style={{
          background: colors.surface.DEFAULT,
          border: `1px solid ${colors.border.DEFAULT}`,
          borderRadius: radius.xl,
          padding: spacing[5],
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </div>

      {/* Create project modal */}
      <CreateProjectModal
        open={createProjectOpen}
        onCancel={() => setCreateProjectOpen(false)}
        onCreated={handleProjectCreated}
      />

      {/* Create independent task modal */}
      <CreateTaskModal
        open={createTaskOpen}
        onCancel={() => setCreateTaskOpen(false)}
        onCreated={handleIndieTaskCreated}
      />
    </div>
  );
};

export default ProjectCenterPage;
