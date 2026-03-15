import { useState } from 'react';
import { Table, Tag, Button, Modal, Form, Input, Select, Popconfirm, message, Skeleton } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import api from '@/api/client';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import type { ColumnsType } from 'antd/es/table';

/* ── styled components ── */

const TableWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  overflow: hidden;

  .ant-table {
    background: transparent;
  }

  .ant-table-thead > tr > th {
    background: ${colors.surface.raised};
    border-bottom: 1px solid ${colors.border.DEFAULT};
    color: ${colors.text.secondary};
    font-size: ${typography.fontSize.sm};
    font-weight: ${typography.fontWeight.medium};
  }

  .ant-table-tbody > tr > td {
    border-bottom: 1px solid ${colors.border.DEFAULT};
    color: ${colors.text.primary};
    font-size: ${typography.fontSize.base};
  }

  .ant-table-tbody > tr:hover > td {
    background: rgba(255, 255, 255, 0.02);
  }

  .ant-pagination {
    padding: ${spacing[4]} ${spacing[6]};
  }
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
`;

const SkeletonTable = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

const TagList = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[1]};
`;

const DisplayName = styled.span`
  color: ${colors.text.primary};
  font-weight: ${typography.fontWeight.medium};
`;

/* ── interfaces ── */

interface AgentType {
  id: string;
  name: string;
  display_name: string;
  protocol: string;
  capabilities: string[];
  preset_models: string[];
  is_system: boolean;
  config_schema?: Record<string, unknown>;
}

interface AgentTypeRow extends AgentType {
  key: string;
}

interface FormValues {
  name: string;
  display_name: string;
  protocol: string;
  capabilities: string[];
  preset_models: string[];
  config_schema: string;
}

/* ── protocol options ── */

const protocolOptions = [
  { label: 'WebSocket', value: 'websocket' },
  { label: 'HTTP', value: 'http' },
  { label: 'gRPC', value: 'grpc' },
  { label: 'Stdio', value: 'stdio' },
];

/* ── component ── */

export const AgentTypePage = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  /* ── query ── */

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(
    ['admin-agent-types'],
    () => api.get('/v1/admin/agent-types') as Promise<any>,
  );

  const rawList: AgentType[] = response?.data?.items ?? response?.data ?? [];
  const agentTypes: AgentTypeRow[] = (Array.isArray(rawList) ? rawList : []).map(
    (item: AgentType) => ({ ...item, key: item.id }),
  );

  /* ── mutations ── */

  const createMutation = useMutation(
    (values: FormValues) =>
      api.post('/v1/admin/agent-types', values) as Promise<any>,
    {
      onSuccess: () => {
        void message.success('Agent 类型已创建');
        handleModalClose();
        queryClient.invalidateQueries(['admin-agent-types']);
      },
      onError: () => {
        void message.error('创建失败');
      },
    },
  );

  const updateMutation = useMutation(
    ({ id, values }: { id: string; values: FormValues }) =>
      api.put(`/admin/agent-types/${id}`, values) as Promise<any>,
    {
      onSuccess: () => {
        void message.success('Agent 类型已更新');
        handleModalClose();
        queryClient.invalidateQueries(['admin-agent-types']);
      },
      onError: () => {
        void message.error('更新失败');
      },
    },
  );

  const deleteMutation = useMutation(
    (id: string) =>
      api.delete(`/admin/agent-types/${id}`) as Promise<any>,
    {
      onSuccess: () => {
        void message.success('Agent 类型已删除');
        queryClient.invalidateQueries(['admin-agent-types']);
      },
      onError: () => {
        void message.error('删除失败');
      },
    },
  );

  /* ── handlers ── */

  const handleOpenCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (record: AgentTypeRow) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      display_name: record.display_name,
      protocol: record.protocol,
      capabilities: record.capabilities ?? [],
      preset_models: record.preset_models ?? [],
      config_schema:
        record.config_schema != null
          ? JSON.stringify(record.config_schema, null, 2)
          : '',
    });
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        void updateMutation.mutate({ id: editingId, values });
      } else {
        void createMutation.mutate(values);
      }
    } catch {
      // form validation failed
    }
  };

  /* ── columns ── */

  const columns: ColumnsType<AgentTypeRow> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      ellipsis: true,
    },
    {
      title: '显示名',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 160,
      ellipsis: true,
      render: (name: string) => <DisplayName>{name}</DisplayName>,
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 100,
      render: (protocol: string) => (
        <Tag>{protocol?.toUpperCase() ?? '-'}</Tag>
      ),
    },
    {
      title: '能力标签',
      dataIndex: 'capabilities',
      key: 'capabilities',
      width: 220,
      render: (caps?: string[]) =>
        caps?.length ? (
          <TagList>
            {caps.map((cap) => (
              <Tag key={cap} color="blue">{cap}</Tag>
            ))}
          </TagList>
        ) : (
          <span style={{ color: colors.text.muted }}>-</span>
        ),
    },
    {
      title: '预置模型',
      dataIndex: 'preset_models',
      key: 'preset_models',
      width: 220,
      render: (models?: string[]) =>
        models?.length ? (
          <TagList>
            {models.map((m) => (
              <Tag key={m} color="geekblue">{m}</Tag>
            ))}
          </TagList>
        ) : (
          <span style={{ color: colors.text.muted }}>-</span>
        ),
    },
    {
      title: '系统预置',
      dataIndex: 'is_system',
      key: 'is_system',
      width: 100,
      render: (isSystem: boolean) => (
        <Tag color={isSystem ? 'green' : 'default'}>
          {isSystem ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: AgentTypeRow) => (
        <ActionButtons>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          {!record.is_system && (
            <Popconfirm
              title="确认删除"
              description={`确定要删除 Agent 类型「${record.display_name || record.name}」吗？`}
              onConfirm={() => {
                void deleteMutation.mutate(record.id);
              }}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </ActionButtons>
      ),
    },
  ];

  /* ── error state ── */
  if (isError) {
    return (
      <div>
        <PageHeader title="Agent 类型" />
        <ErrorBlock
          message={(error as Error)?.message || '加载 Agent 类型列表失败'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ── loading state ── */
  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Agent 类型"
          actions={
            <Button type="primary" icon={<PlusOutlined />}>
              新增类型
            </Button>
          }
        />
        <SkeletonTable>
          <Skeleton active paragraph={{ rows: 6 }} title={false} />
        </SkeletonTable>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Agent 类型"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新增类型
          </Button>
        }
      />

      {agentTypes.length === 0 ? (
        <EmptyState
          description="暂无 Agent 类型"
          action={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新增类型
            </Button>
          }
        />
      ) : (
        <TableWrapper>
          <Table<AgentTypeRow>
            columns={columns}
            dataSource={agentTypes}
            rowKey="key"
            pagination={false}
          />
        </TableWrapper>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        title={editingId ? '编辑 Agent 类型' : '新增 Agent 类型'}
        open={modalOpen}
        onOk={handleFormSubmit}
        onCancel={handleModalClose}
        confirmLoading={createMutation.isLoading || updateMutation.isLoading}
        okText={editingId ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: spacing[4] }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如: cc-agent" />
          </Form.Item>

          <Form.Item
            name="display_name"
            label="显示名"
            rules={[{ required: true, message: '请输入显示名' }]}
          >
            <Input placeholder="例如: CC Agent" />
          </Form.Item>

          <Form.Item
            name="protocol"
            label="协议"
            rules={[{ required: true, message: '请选择协议' }]}
          >
            <Select
              placeholder="请选择协议"
              options={protocolOptions}
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="capabilities"
            label="能力标签"
          >
            <Select
              mode="tags"
              placeholder="输入后按 Enter 添加"
              tokenSeparators={[',']}
            />
          </Form.Item>

          <Form.Item
            name="preset_models"
            label="预置模型"
          >
            <Select
              mode="tags"
              placeholder="输入后按 Enter 添加"
              tokenSeparators={[',']}
            />
          </Form.Item>

          <Form.Item
            name="config_schema"
            label="配置 Schema (JSON)"
          >
            <Input.TextArea
              rows={5}
              placeholder='{"type": "object", "properties": {}}'
              style={{
                fontFamily: typography.fontFamily.mono,
                fontSize: typography.fontSize.sm,
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AgentTypePage;
