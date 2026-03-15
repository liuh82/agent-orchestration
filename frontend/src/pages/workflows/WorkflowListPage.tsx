import { useState } from 'react';
import { Button, Table, Tabs, Tag, Modal, Popconfirm, message, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, CopyOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { StatusBadge } from '@/components/common/StatusBadge';
import { workflowsApi } from '@/api/workflows';

const formatDate = (val?: string) => {
  if (!val) return '-';
  return new Date(val).toLocaleString('zh-CN');
};

export const WorkflowListPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const {
    data: wfResponse,
    isLoading: wfLoading,
    isError: wfError,
    error: wfErr,
    refetch: refetchWf,
  } = useQuery(['workflows'], () => workflowsApi.list());

  const {
    data: tplResponse,
    isLoading: tplLoading,
  } = useQuery(['workflow-templates'], () => workflowsApi.listTemplates());

  const workflows = wfResponse?.data?.items ?? wfResponse?.data ?? [];
  const templates = tplResponse?.data?.items ?? tplResponse?.data ?? [];

  const handleDelete = async (id: string) => {
    try {
      await workflowsApi.delete(id);
      void message.success('工作流已删除');
      queryClient.invalidateQueries(['workflows']);
    } catch {
      void message.error('删除失败');
    }
  };

  const handleExecute = async (wf: any) => {
    try {
      await workflowsApi.execute(wf.id, { name: `${wf.name} - 执行` });
      void message.success('工作流执行已开始');
    } catch {
      void message.error('执行失败');
    }
  };

  const handleUseTemplate = (template: any) => {
    navigate(`/workflows/new?template=${template.id}`);
  };

  const workflowColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span style={{ color: colors.text.primary, fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val: string) => <span style={{ fontSize: 13, color: colors.text.secondary }}>{formatDate(val)}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/workflows/new?id=${record.id}`)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(record)}>
            执行
          </Button>
          <Popconfirm title="确定删除此工作流？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const templateColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span style={{ color: colors.text.primary, fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (val: string) => <span style={{ fontSize: 13, color: colors.text.secondary }}>{val || '-'}</span>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (val: string) => <Tag>{val || '-'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleUseTemplate(record)}>
          使用模板
        </Button>
      ),
    },
  ];

  if (wfError) {
    return (
      <div>
        <PageHeader title="工作流" />
        <ErrorBlock message={(wfErr as Error)?.message || '加载失败'} onRetry={() => refetchWf()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="工作流"
        actions={
          <Space>
            <Button icon={<CopyOutlined />} onClick={() => setTemplateModalOpen(true)}>
              从模板创建
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/workflows/new')}>
              新建流程
            </Button>
          </Space>
        }
      />

      <Tabs
        defaultActiveKey="workflows"
        items={[
          {
            key: 'workflows',
            label: '我的流程',
            children: wfLoading ? (
              <div style={{ padding: spacing[8], textAlign: 'center' }}>加载中...</div>
            ) : workflows.length === 0 ? (
              <EmptyState
                description="还没有工作流"
                action={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/workflows/new')}>
                    新建流程
                  </Button>
                }
              />
            ) : (
              <Table columns={workflowColumns} dataSource={workflows} rowKey="id" pagination={{ pageSize: 10 }} />
            ),
          },
          {
            key: 'templates',
            label: '模板库',
            children: tplLoading ? (
              <div style={{ padding: spacing[8], textAlign: 'center' }}>加载中...</div>
            ) : templates.length === 0 ? (
              <EmptyState description="暂无模板" />
            ) : (
              <Table columns={templateColumns} dataSource={templates} rowKey="id" pagination={{ pageSize: 10 }} />
            ),
          },
        ]}
      />

      {/* Template Selection Modal */}
      <Modal
        title="从模板创建"
        open={templateModalOpen}
        onCancel={() => setTemplateModalOpen(false)}
        footer={null}
        width={640}
      >
        <Table
          columns={templateColumns}
          dataSource={templates}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无可用模板' }}
          onRow={(record) => ({
            onClick: () => handleUseTemplate(record),
            style: { cursor: 'pointer' },
          })}
        />
      </Modal>
    </div>
  );
};

export default WorkflowListPage;
