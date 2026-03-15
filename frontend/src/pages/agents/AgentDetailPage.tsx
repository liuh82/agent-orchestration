import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Button,
  Tabs,
  Table,
  Skeleton,
  Tag,
  Descriptions,
  Input,
  message,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ExperimentOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { agentApi } from '@/api/agents';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { EmptyState } from '@/components/common/EmptyState';
import type { AgentInstance } from '@/types/agent';
import type { ApiResponse } from '@/types/api';
import type { ColumnsType } from 'antd/es/table';

/* ── styled components ── */

const TabContent = styled.div`
  min-height: 300px;
`;

const InfoCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  margin-bottom: ${spacing[5]};
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: ${spacing[4]};
  margin-top: ${spacing[5]};
`;

const StatCard = styled.div`
  background: ${colors.surface.raised};
  border-radius: ${radius.lg};
  padding: ${spacing[4]};
  text-align: center;
`;

const StatValue = styled.div`
  font-size: ${typography.fontSize['2xl']};
  font-weight: ${typography.fontWeight.bold};
  color: ${colors.text.primary};
`;

const StatLabel = styled.div`
  font-size: ${typography.fontSize.xs};
  color: ${colors.text.muted};
  margin-top: ${spacing[1]};
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
  }

  .ant-table-tbody > tr > td {
    border-bottom: 1px solid ${colors.border.DEFAULT};
    color: ${colors.text.primary};
    font-size: ${typography.fontSize.base};
  }
`;

const ConfigEditor = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

const ConfigJsonViewer = styled.pre`
  background: ${colors.neutral[950]};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
  padding: ${spacing[5]};
  font-family: ${typography.fontFamily.mono};
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.primary};
  overflow-x: auto;
  line-height: ${typography.lineHeight.relaxed};
  white-space: pre-wrap;
  word-break: break-all;
`;

const ConfigToolbar = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${spacing[3]};
  margin-bottom: ${spacing[5]};
`;

const StatusDot = styled.span<{ $status: AgentInstance['status'] }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: ${spacing[2]};
  background: ${({ $status }) =>
    $status === 'online'
      ? colors.success[500]
      : $status === 'busy'
        ? colors.warning[500]
        : colors.neutral[500]};
`;

const SectionTitle = styled.h3`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin: 0 0 ${spacing[4]} 0;
`;

/* ── log entry interface ── */

interface LogEntry {
  id: string;
  level: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const formatToken = (value?: number): string => {
  if (value == null) return '-';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
};

const formatDate = (date?: string): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

/* ── log columns ── */

const logColumns: ColumnsType<LogEntry> = [
  {
    title: '时间',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 200,
    render: (ts: string) => (
      <span style={{ color: colors.text.secondary, fontSize: typography.fontSize.sm }}>
        {new Date(ts).toLocaleString('zh-CN')}
      </span>
    ),
  },
  {
    title: '级别',
    dataIndex: 'level',
    key: 'level',
    width: 100,
    render: (level: string) => {
      const levelColorMap: Record<string, string> = {
        info: colors.info[500],
        warn: colors.warning[500],
        warning: colors.warning[500],
        error: colors.error[500],
        debug: colors.text.muted,
      };
      return (
        <Tag
          color={levelColorMap[level] || colors.neutral[700]}
          style={{ margin: 0, textTransform: 'uppercase' }}
        >
          {level}
        </Tag>
      );
    },
  },
  {
    title: '消息',
    dataIndex: 'message',
    key: 'message',
    render: (msg: string) => (
      <span style={{ color: colors.text.primary, fontSize: typography.fontSize.base }}>
        {msg}
      </span>
    ),
  },
];

/* ── component ── */

export const AgentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const agentsListPath = location.pathname.startsWith('/admin') ? '/admin/agents' : '/agents';
  const queryClient = useQueryClient();
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(20);
  const [editingConfig, setEditingConfig] = useState(false);
  const [configJson, setConfigJson] = useState('');

  // Fetch agent detail
  const {
    data: agentResponse,
    isLoading: agentLoading,
    isError: agentError,
    error: agentErrorObj,
    refetch: refetchAgent,
  } = useQuery<ApiResponse<AgentInstance>, Error>(
    ['agent', id],
    () => agentApi.getById(id!),
    {
      enabled: !!id,
      refetchInterval: 10000, // auto-refresh every 10s for status updates
    },
  );

  // Fetch agent logs
  const {
    data: logsResponse,
    isLoading: logsLoading,
  } = useQuery<
    ApiResponse<{ items: LogEntry[]; total: number }>,
    Error
  >(
    ['agent-logs', id, logPage, logPageSize],
    () => agentApi.getLogs(id!, { page: logPage, page_size: logPageSize }),
    {
      enabled: !!id,
    },
  );

  const agent = agentResponse?.data;

  // Logs normalization - handle both array and paged response shapes
  const logsData = logsResponse?.data;
  const logEntries = Array.isArray(logsData?.items)
    ? logsData.items
    : Array.isArray(logsData)
      ? logsData as LogEntry[]
      : [];
  const logTotal =
    logsData?.total ??
    (Array.isArray(logsData) ? logsData.length : 0);

  // Mutations
  const startMutation = useMutation(
    () => agentApi.start(id!),
    {
      onSuccess: () => {
        void message.success('代理已启动');
        queryClient.invalidateQueries(['agent', id]);
      },
      onError: () => { void message.error('启动失败'); },
    },
  );

  const stopMutation = useMutation(
    () => agentApi.stop(id!),
    {
      onSuccess: () => {
        void message.success('代理已停止');
        queryClient.invalidateQueries(['agent', id]);
      },
      onError: () => { void message.error('停止失败'); },
    },
  );

  const testMutation = useMutation(
    () => agentApi.test(id!),
    {
      onSuccess: () => { void message.success('测试连接成功'); },
      onError: () => { void message.error('测试连接失败'); },
    },
  );

  const updateMutation = useMutation(
    (data: Record<string, unknown>) => agentApi.update(id!, data),
    {
      onSuccess: () => {
        void message.success('配置已保存');
        setEditingConfig(false);
        queryClient.invalidateQueries(['agent', id]);
      },
      onError: () => { void message.error('保存失败'); },
    },
  );

  const deleteMutation = useMutation(
    () => agentApi.delete(id!),
    {
      onSuccess: () => {
        void message.success('代理已删除');
        navigate(agentsListPath);
      },
      onError: () => { void message.error('删除失败'); },
    },
  );

  const handleStartEditingConfig = () => {
    if (agent?.config) {
      setConfigJson(JSON.stringify(agent.config, null, 2));
    } else {
      setConfigJson('{\n  \n}');
    }
    setEditingConfig(true);
  };

  const handleSaveConfig = () => {
    try {
      const parsed = JSON.parse(configJson);
      updateMutation.mutate({ config: parsed });
    } catch {
      void message.error('JSON 格式错误，请检查后重试');
    }
  };

  const handleCancelEditingConfig = () => {
    setEditingConfig(false);
  };

  const isOnline = agent?.status === 'online' || agent?.status === 'busy';

  /* ── error state ── */
  if (agentError) {
    return (
      <div>
        <PageHeader
          title="代理详情"
          actions={
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(agentsListPath)}>
              返回
            </Button>
          }
        />
        <ErrorBlock
          message={agentErrorObj?.message || '加载代理详情失败'}
          onRetry={() => refetchAgent()}
        />
      </div>
    );
  }

  /* ── loading state ── */
  if (agentLoading) {
    return (
      <div>
        <PageHeader
          title="代理详情"
          actions={
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(agentsListPath)}>
              返回
            </Button>
          }
        />
        <Skeleton active paragraph={{ rows: 10 }} title={false} />
      </div>
    );
  }

  if (!agent) {
    return (
      <div>
        <PageHeader
          title="代理详情"
          actions={
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(agentsListPath)}>
              返回
            </Button>
          }
        />
        <EmptyState description="未找到该代理" />
      </div>
    );
  }

  const tabItems = [
    {
      key: 'overview',
      label: '概览',
      children: (
        <TabContent>
          {/* ── basic info ── */}
          <InfoCard>
            <SectionTitle>基本信息</SectionTitle>
            <Descriptions
              column={{ xs: 1, sm: 2 }}
              colon={false}
              labelStyle={{ color: colors.text.muted, fontSize: typography.fontSize.sm }}
              contentStyle={{ color: colors.text.primary, fontSize: typography.fontSize.base }}
            >
              <Descriptions.Item label="名称">{agent.name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusDot $status={agent.status} />
                <StatusBadge status={agent.status} />
              </Descriptions.Item>
              <Descriptions.Item label="类型 ID">{agent.agent_type_id}</Descriptions.Item>
              <Descriptions.Item label="连接地址">{agent.bridge_url || '-'}</Descriptions.Item>
              <Descriptions.Item label="模型">{agent.config?.model || '-'}</Descriptions.Item>
              <Descriptions.Item label="超时">{agent.config?.timeout ?? '-'}s</Descriptions.Item>
              <Descriptions.Item label="最大重试">{agent.config?.max_retries ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="最后活跃">{formatDate(agent.last_seen)}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDate(agent.created_at)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDate(agent.updated_at)}</Descriptions.Item>
            </Descriptions>
          </InfoCard>

          {/* ── stats ── */}
          <SectionTitle>统计</SectionTitle>
          <StatGrid>
            <StatCard>
              <StatValue>{formatToken(agent.token_usage_today)}</StatValue>
              <StatLabel>今日 Token</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{formatToken(agent.token_usage_month)}</StatValue>
              <StatLabel>本月 Token</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{agent.config?.timeout ?? '-'}</StatValue>
              <StatLabel>超时时间(s)</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{agent.config?.max_retries ?? '-'}</StatValue>
              <StatLabel>最大重试</StatLabel>
            </StatCard>
          </StatGrid>

          {/* ── skills ── */}
          {agent.config?.skills && agent.config.skills.length > 0 && (
            <>
              <SectionTitle style={{ marginTop: spacing[6] }}>技能</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[2] }}>
                {agent.config.skills.map((skill) => (
                  <Tag
                    key={skill}
                    style={{
                      background: 'rgba(99,102,241,0.12)',
                      color: colors.text.brand,
                      border: 'none',
                    }}
                  >
                    {skill}
                  </Tag>
                ))}
              </div>
            </>
          )}
        </TabContent>
      ),
    },
    {
      key: 'logs',
      label: '日志',
      children: (
        <TabContent>
          <TableWrapper>
            <Table<LogEntry>
              columns={logColumns}
              dataSource={logEntries}
              rowKey="id"
              loading={logsLoading}
              size="small"
              locale={{ emptyText: '暂无日志' }}
              pagination={{
                current: logPage,
                pageSize: logPageSize,
                total: logTotal,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p, ps) => {
                  setLogPage(p);
                  setLogPageSize(ps);
                },
              }}
            />
          </TableWrapper>
        </TabContent>
      ),
    },
    {
      key: 'config',
      label: '配置',
      children: (
        <TabContent>
          <ConfigEditor>
            <ConfigToolbar>
              {editingConfig ? (
                <>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={handleCancelEditingConfig}
                  >
                    取消
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={updateMutation.isLoading}
                    onClick={handleSaveConfig}
                  >
                    保存
                  </Button>
                </>
              ) : (
                <Button
                  icon={<EditOutlined />}
                  onClick={handleStartEditingConfig}
                >
                  编辑
                </Button>
              )}
            </ConfigToolbar>

            {editingConfig ? (
              <Input.TextArea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                rows={16}
                style={{
                  fontFamily: typography.fontFamily.mono,
                  fontSize: typography.fontSize.sm,
                  background: colors.neutral[950],
                  color: colors.text.primary,
                  border: `1px solid ${colors.border.DEFAULT}`,
                  borderRadius: radius.lg,
                }}
              />
            ) : (
              <ConfigJsonViewer>
                {JSON.stringify(agent.config, null, 2)}
              </ConfigJsonViewer>
            )}
          </ConfigEditor>
        </TabContent>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={agent.name}
        actions={
          <div style={{ display: 'flex', gap: spacing[3], alignItems: 'center' }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(agentsListPath)}
            >
              返回
            </Button>

            {isOnline ? (
              <Popconfirm
                title="确认停止"
                description={`确定要停止代理「${agent.name}」吗？`}
                onConfirm={() => stopMutation.mutate()}
                okText="停止"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button danger loading={stopMutation.isLoading}>
                  <PauseCircleOutlined /> 停止
                </Button>
              </Popconfirm>
            ) : (
              <Button
                type="primary"
                loading={startMutation.isLoading}
                onClick={() => startMutation.mutate()}
              >
                <PlayCircleOutlined /> 启动
              </Button>
            )}

            <Button
              loading={testMutation.isLoading}
              onClick={() => testMutation.mutate()}
            >
              <ExperimentOutlined /> 测试
            </Button>

            <Popconfirm
              title="确认删除"
              description={`确定要删除代理「${agent.name}」吗？此操作不可撤销。`}
              onConfirm={() => deleteMutation.mutate()}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger>删除</Button>
            </Popconfirm>
          </div>
        }
      />

      <Tabs
        items={tabItems}
        defaultActiveKey="overview"
        style={{ marginTop: spacing[4] }}
      />
    </div>
  );
};

export default AgentDetailPage;
