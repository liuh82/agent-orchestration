import { useState, useCallback, useRef } from 'react';
import { Button, Input, Segmented, Table, Skeleton, Popconfirm, message, Tabs, Modal, Form, Select, Tag } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { agentApi } from '@/api/agents';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { AgentCard } from './AgentCard';
import api from '@/api/client';
import type { AgentInstance } from '@/types/agent';
import type { ApiResponse, PagedData } from '@/types/api';
import type { ColumnsType } from 'antd/es/table';

/* ── styled components ── */

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[4]};
  margin-bottom: ${spacing[5]};
`;

const SearchWrapper = styled.div`
  width: 320px;
`;

const CardGrid = styled.div`
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

const SkeletonGrid = styled.div`
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

const SkeletonCard = styled(Skeleton)`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

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
  gap: ${spacing[2]};
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

const SkeletonTable = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

/* ── interfaces ── */

interface AgentTableRow extends AgentInstance {
  key: string;
}

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

interface AgentTypeFormValues {
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

/* ── helper functions ── */

const formatToken = (value?: number): string => {
  if (value == null) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
};

/* ── agent actions sub-component ── */

const AgentActions = ({ agent, basePath }: { agent: AgentInstance; basePath: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(agentApi.delete, {
    onSuccess: () => {
      void message.success('代理已删除');
      queryClient.invalidateQueries(['agents']);
    },
    onError: () => {
      void message.error('删除失败');
    },
  });

  return (
    <ActionButtons>
      <Button
        type="link"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`${basePath}/${agent.id}`);
        }}
      >
        详情
      </Button>
      <Popconfirm
        title="确认删除"
        description={`确定要删除代理「${agent.name}」吗？`}
        onConfirm={(e) => {
          e?.stopPropagation();
          deleteMutation.mutate(agent.id);
        }}
        onCancel={(e) => e?.stopPropagation()}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Button
          type="link"
          size="small"
          danger
          onClick={(e) => e.stopPropagation()}
        >
          删除
        </Button>
      </Popconfirm>
    </ActionButtons>
  );
};

/* ── Agent List Tab Content ── */

interface AgentListTabProps {
  basePath: string;
}

const AgentListTab = ({ basePath }: AgentListTabProps) => {
  const navigate = useNavigate();

  const columns: ColumnsType<AgentTableRow> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: AgentInstance['status']) => (
        <StatusBadge status={status} />
      ),
    },
    {
      title: '模型',
      dataIndex: ['config', 'model'],
      key: 'model',
      width: 160,
      render: (model?: string) => (
        <span style={{ color: colors.text.secondary }}>
          {model || '-'}
        </span>
      ),
    },
    {
      title: '今日 Token',
      dataIndex: 'token_usage_today',
      key: 'token_usage_today',
      width: 120,
      render: (value?: number) => formatToken(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: AgentTableRow) => (
        <AgentActions agent={record} basePath={basePath} />
      ),
    },
  ];

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearch(value);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        setDebouncedSearch(value);
        setPage(1);
      }, 300);
    },
    [],
  );

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<
    ApiResponse<PagedData<AgentInstance>>,
    Error
  >(
    ['agents', { page, page_size: pageSize, search: debouncedSearch }],
    () => agentApi.list({ page, page_size: pageSize, search: debouncedSearch }),
    {
      keepPreviousData: true,
    },
  );

  const agents = response?.data?.items ?? [];
  const total = response?.data?.total ?? 0;

  const handleCardClick = (agent: AgentInstance) => {
    navigate(`${basePath}/${agent.id}`);
  };

  if (isError) {
    return (
      <ErrorBlock
        message={error?.message || '加载代理列表失败'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <>
      <Toolbar>
        <SearchWrapper>
          <Input
            prefix={<SearchOutlined style={{ color: colors.text.muted }} />}
            placeholder="搜索代理名称..."
            value={search}
            onChange={handleSearch}
            allowClear
          />
        </SearchWrapper>

        <Segmented
          options={[
            { label: '卡片', value: 'cards' },
            { label: '表格', value: 'table' },
          ]}
          value={viewMode}
          onChange={(val) => setViewMode(val as 'cards' | 'table')}
        />
      </Toolbar>

      {isLoading ? (
        <SkeletonGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} active paragraph={{ rows: 5 }} title={false} />
          ))}
        </SkeletonGrid>
      ) : agents.length === 0 ? (
        <EmptyState
          description="还没有代理，点击创建开始使用"
          action={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(`${basePath}/new`)}
            >
              创建代理
            </Button>
          }
        />
      ) : viewMode === 'cards' ? (
        <CardGrid>
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onClick={handleCardClick} />
          ))}
        </CardGrid>
      ) : (
        <TableWrapper>
          <Table<AgentTableRow>
            columns={columns}
            dataSource={agents.map((a) => ({ ...a, key: a.id }))}
            rowKey="key"
            onRow={(record) => ({
              onClick: () => navigate(`${basePath}/${record.id}`),
              style: { cursor: 'pointer' },
            })}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 个代理`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
          />
        </TableWrapper>
      )}
    </>
  );
};

/* ── Agent Type Tab Content ── */

const AgentTypeTab = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm<AgentTypeFormValues>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const createMutation = useMutation(
    (values: AgentTypeFormValues) =>
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
    ({ id, values }: { id: string; values: AgentTypeFormValues }) =>
      api.put(`/v1/admin/agent-types/${id}`, values) as Promise<any>,
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
      api.delete(`/v1/admin/agent-types/${id}`) as Promise<any>,
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

  if (isError) {
    return (
      <ErrorBlock
        message={(error as Error)?.message || '加载 Agent 类型列表失败'}
        onRetry={() => refetch()}
      />
    );
  }

  if (isLoading) {
    return (
      <div>
        <div style={{ marginBottom: spacing[5] }}>
          <Button type="primary" icon={<PlusOutlined />}>
            新增类型
          </Button>
        </div>
        <SkeletonTable>
          <Skeleton active paragraph={{ rows: 6 }} title={false} />
        </SkeletonTable>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: spacing[5] }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
          新增类型
        </Button>
      </div>

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
    </>
  );
};

/* ── main component ── */

export const AgentListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin/agents' : '/agents';

  const [activeTab, setActiveTab] = useState<string>('agents');

  const tabItems = [
    {
      key: 'agents',
      label: '代理列表',
      children: <AgentListTab basePath={basePath} />,
    },
    {
      key: 'types',
      label: '类型管理',
      children: <AgentTypeTab />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="代理中心"
        actions={
          activeTab === 'agents' ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate(`${basePath}/new`)}
            >
              创建代理
            </Button>
          ) : undefined
        }
      />

      <Tabs
        activeKey={activeTab}
        items={tabItems}
        onChange={setActiveTab}
      />
    </div>
  );
};

export default AgentListPage;
