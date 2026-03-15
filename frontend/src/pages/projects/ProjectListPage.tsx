import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Button, Modal, Form, Input, Skeleton } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { ProjectCard } from './ProjectCard';
import { projectApi } from '@/api/projects';
import type { ApiResponse, PagedData } from '@/types/api';
import type { Project } from '@/types/project';

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

export const ProjectListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm<{ name: string; description?: string }>();

  // Fetch project list
  const {
    data: projectsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<PagedData<Project>>>(
    ['projects', { page: 1, page_size: 100 }],
    () => projectApi.list({ page: 1, page_size: 100 }),
    { refetchOnWindowFocus: false },
  );

  const projects = projectsData?.data?.items ?? [];

  // Create project mutation
  const createMutation = useMutation(
    (values: { name: string; description?: string }) => projectApi.create(values),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['projects']);
        setCreateModalOpen(false);
        form.resetFields();
      },
    },
  );

  const handleCreate = () => {
    form.validateFields().then((values) => {
      createMutation.mutate(values);
    });
  };

  // ---- Loading state: 6 skeleton cards ----
  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="项目"
          actions={
            <Button type="primary" icon={<PlusOutlined />}>
              创建项目
            </Button>
          }
        />
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
      </div>
    );
  }

  // ---- Error state ----
  if (isError) {
    return (
      <div>
        <PageHeader title="项目" />
        <ErrorBlock
          message={
            error instanceof Error
              ? error.message
              : '项目列表加载失败，请稍后重试'
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="项目"
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            创建项目
          </Button>
        }
      />

      {/* Empty state */}
      {projects.length === 0 && (
        <EmptyState
          description="还没有项目，点击创建开始使用"
          action={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              创建项目
            </Button>
          }
        />
      )}

      {/* Project card grid */}
      {projects.length > 0 && (
        <GridContainer>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </GridContainer>
      )}

      {/* Create project modal */}
      <Modal
        title="创建项目"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={createMutation.isLoading}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea
              rows={3}
              placeholder="请输入项目描述（可选）"
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectListPage;
