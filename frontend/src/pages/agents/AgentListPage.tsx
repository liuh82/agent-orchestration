import { useState, useCallback, useRef } from 'react';
import { Button, Input, Segmented, Table, Skeleton, Popconfirm, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
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

/* ── table columns ── */

interface AgentTableRow extends AgentInstance {
  key: string;
}

const formatToken = (value?: number): string => {
  if (value == null) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
};

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
    width: 180,
    render: (_: unknown, record: AgentTableRow) => (
      <AgentActions agent={record} />
    ),
  },
];

/* ── agent actions sub-component ── */

const AgentActions = ({ agent }: { agent: AgentInstance }) => {
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

  const startMutation = useMutation(() => agentApi.start(agent.id), {
    onSuccess: () => {
      void message.success('代理已启动');
      queryClient.invalidateQueries(['agents']);
    },
    onError: () => {
      void message.error('启动失败');
    },
  });

  const stopMutation = useMutation(() => agentApi.stop(agent.id), {
    onSuccess: () => {
      void message.success('代理已停止');
      queryClient.invalidateQueries(['agents']);
    },
    onError: () => {
      void message.error('停止失败');
    },
  });

  return (
    <ActionButtons>
      <Button
        type="link"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/agents/${agent.id}`);
        }}
      >
        详情
      </Button>
      {agent.status === 'online' || agent.status === 'busy' ? (
        <Button
          type="link"
          size="small"
          danger
          loading={stopMutation.isLoading}
          onClick={(e) => {
            e.stopPropagation();
            stopMutation.mutate();
          }}
        >
          停止
        </Button>
      ) : (
        <Button
          type="link"
          size="small"
          loading={startMutation.isLoading}
          onClick={(e) => {
            e.stopPropagation();
            startMutation.mutate();
          }}
        >
          启动
        </Button>
      )}
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

/* ── main component ── */

export const AgentListPage = () => {
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
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
    navigate(`/agents/${agent.id}`);
  };

  /* ── error state ── */
  if (isError) {
    return (
      <div>
        <PageHeader title="代理中心" />
        <ErrorBlock
          message={error?.message || '加载代理列表失败'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="代理中心"
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/agents/new')}
          >
            创建代理
          </Button>
        }
      />

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

      {/* ── loading state ── */}
      {isLoading ? (
        <SkeletonGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} active paragraph={{ rows: 5 }} title={false} />
          ))}
        </SkeletonGrid>
      ) : agents.length === 0 ? (
        /* ── empty state ── */
        <EmptyState
          description="还没有代理，点击创建开始使用"
          action={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/agents/new')}
            >
              创建代理
            </Button>
          }
        />
      ) : viewMode === 'cards' ? (
        /* ── card grid view ── */
        <CardGrid>
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onClick={handleCardClick} />
          ))}
        </CardGrid>
      ) : (
        /* ── table view ── */
        <TableWrapper>
          <Table<AgentTableRow>
            columns={columns}
            dataSource={agents.map((a) => ({ ...a, key: a.id }))}
            rowKey="key"
            onRow={(record) => ({
              onClick: () => navigate(`/agents/${record.id}`),
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
    </div>
  );
};

export default AgentListPage;
