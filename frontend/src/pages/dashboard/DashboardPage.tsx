import { useMemo } from 'react';
import { Col, Row, Progress, Skeleton, Table } from 'antd';
import {
  RobotOutlined,
  ProjectOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { animation } from '@/styles/tokens/animation';
import { statsApi } from '@/api/stats';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import type { DashboardStats } from '@/types/stats';
import type { ColumnsType } from 'antd/es/table';

/* ── styled components ── */

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: ${spacing[5]};

  @media (max-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 576px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: border-color ${animation.duration.normal} ${animation.easing.default};

  &:hover {
    border-color: ${colors.border.hover};
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
`;

const StatIconWrapper = styled.div<{ $color: string }>`
  width: 40px;
  height: 40px;
  border-radius: ${radius.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $color }) => $color};
  color: ${colors.text.primary};
  font-size: ${typography.fontSize.xl};
  margin-bottom: ${spacing[4]};
`;

const StatValue = styled.div`
  font-size: ${typography.fontSize['3xl']};
  font-weight: ${typography.fontWeight.bold};
  color: ${colors.text.primary};
  line-height: ${typography.lineHeight.tight};
`;

const StatLabel = styled.div`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
  margin-top: ${spacing[1]};
`;

const SectionCard = styled.div<{ $scrollable?: boolean }>`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  ${({ $scrollable }) => $scrollable && `
    height: 380px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `}
`;

const SectionTitle = styled.h3`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin: 0 0 ${spacing[4]} 0;
`;

const AgentStatusItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  padding: ${spacing[3]} 0;
  border-bottom: 1px solid ${colors.border.DEFAULT};

  &:last-child {
    border-bottom: none;
  }
`;

const StatusDot = styled.span<{ $status: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $status }) =>
    $status === 'online'
      ? colors.success[500]
      : $status === 'busy'
        ? colors.warning[500]
        : $status === 'error'
          ? colors.error[500]
          : colors.neutral[500]};

  ${({ $status }) =>
    ($status === 'online' || $status === 'busy') &&
    `
    animation: pulse 2s ease-in-out infinite;
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `}
`;

const AgentNameText = styled.span`
  font-size: ${typography.fontSize.base};
  color: ${colors.text.primary};
  flex: 1;
`;

const AgentStatusBadge = styled.span`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
`;

const ProgressWrapper = styled.div`
  margin-top: ${spacing[4]};
`;

const NoDataText = styled.div`
  color: ${colors.text.muted};
  font-size: ${typography.fontSize.base};
  text-align: center;
  padding: ${spacing[8]} 0;
`;

const ChartWrapper = styled.div`
  height: 240px;
  width: 100%;
`;

const SkeletonCard = styled(Skeleton)`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

/* ── mock data helper ── */

const generateMockChartData = () => {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return days.map((name) => ({
    name,
    tokens: Math.floor(Math.random() * 40000) + 20000,
  }));
};

/* ── recent tasks columns ── */

interface RecentTask {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

const recentTaskColumns: ColumnsType<RecentTask> = [
  {
    title: '任务名称',
    dataIndex: 'title',
    key: 'title',
    ellipsis: true,
    render: (title: string) => (
      <span style={{ color: colors.text.primary, fontSize: typography.fontSize.base }}>
        {title}
      </span>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    render: (status: string) => (
      <StatusBadge status={status as 'running' | 'completed' | 'failed' | 'pending' | 'cancelled' | 'online' | 'offline' | 'error' | 'busy' | 'active' | 'archived' | 'draft'} />
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
    render: (date: string) => (
      <span style={{ color: colors.text.secondary, fontSize: typography.fontSize.sm }}>
        {new Date(date).toLocaleString('zh-CN')}
      </span>
    ),
  },
];

/* ── loading skeleton ── */

const StatCardSkeleton = () => (
  <SkeletonCard active paragraph={{ rows: 2 }} title={false} />
);

/* ── component ── */

export const DashboardPage = () => {
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ data: DashboardStats }, Error>(
    ['dashboard'],
    statsApi.getDashboard,
  );

  const stats = response?.data;

  const completionRate = useMemo(() => {
    if (!stats || stats.task_count === 0) return 0;
    return Math.round((stats.task_completed_count / stats.task_count) * 100);
  }, [stats]);

  const chartData = useMemo(() => generateMockChartData(), []);

  /* ── error state ── */
  if (isError) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <ErrorBlock
          message={error?.message || '加载 Dashboard 数据失败'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ── loading state ── */
  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <Row gutter={[spacing[5], spacing[5]]}>
          {[0, 1, 2, 3].map((i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <StatCardSkeleton />
            </Col>
          ))}
        </Row>
        <Row gutter={[spacing[5], spacing[5]]} style={{ marginTop: spacing[5] }}>
          <Col xs={24} lg={14}>
            <SkeletonCard active paragraph={{ rows: 6 }} title={false} />
          </Col>
          <Col xs={24} lg={10}>
            <SkeletonCard active paragraph={{ rows: 6 }} title={false} />
          </Col>
        </Row>
        <div style={{ marginTop: spacing[5] }}>
          <SkeletonCard active paragraph={{ rows: 4 }} title={false} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* ── stat cards row ── */}
      <StatRow>
        
          <StatCard>
            <StatIconWrapper $color="rgba(34,197,94,0.12)">
              <RobotOutlined />
            </StatIconWrapper>
            <StatValue style={{ color: colors.text.success }}>
              {stats?.agent_online_count ?? 0}
              <span
                style={{
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.normal,
                  color: colors.text.secondary,
                  marginLeft: spacing[2],
                }}
              >
                / {stats?.agent_count ?? 0}
              </span>
            </StatValue>
            <StatLabel>Agent 在线</StatLabel>
          </StatCard>

        <StatCard>
            <StatIconWrapper $color="rgba(99,102,241,0.12)">
              <ProjectOutlined />
            </StatIconWrapper>
            <StatValue>{stats?.project_count ?? 0}</StatValue>
            <StatLabel>项目数</StatLabel>
          </StatCard>

        <StatCard>
            <StatIconWrapper $color="rgba(34,197,94,0.12)">
              <CheckCircleOutlined />
            </StatIconWrapper>
            <StatValue>{completionRate}%</StatValue>
            <StatLabel>任务完成率</StatLabel>
            <ProgressWrapper>
              <Progress
                percent={completionRate}
                showInfo={false}
                strokeColor={colors.success[500]}
                trailColor={colors.neutral[200]}
                size="small"
              />
            </ProgressWrapper>
          </StatCard>

        <StatCard>
            <StatIconWrapper $color="rgba(99,102,241,0.12)">
              <ThunderboltOutlined />
            </StatIconWrapper>
            <StatValue>
              {stats?.token_usage_today != null
                ? stats.token_usage_today >= 1000
                  ? `${(stats.token_usage_today / 1000).toFixed(1)}K`
                  : stats.token_usage_today
                : 0}
            </StatValue>
            <StatLabel>今日 Token 消耗</StatLabel>
          </StatCard>

        <StatCard>
            <StatIconWrapper $color="rgba(245,158,11,0.12)">
              <DollarOutlined />
            </StatIconWrapper>
            <StatValue>
              {stats?.cost_this_month != null
                ? `¥${stats.cost_this_month.toFixed(2)}`
                : '--'}
            </StatValue>
            <StatLabel>
              {stats?.cost_this_month != null
                ? '本月成本'
                : '本月成本（待接入）'}
            </StatLabel>
          </StatCard>
      </StatRow>

      {/* ── middle section: Agent status + Recent tasks ── */}
      <Row gutter={[spacing[5], spacing[5]]} style={{ marginTop: spacing[5] }}>
        <Col xs={24} lg={10}>
          <SectionCard $scrollable>
            <SectionTitle>Agent 状态面板</SectionTitle>
            <div style={{ flex: 1, overflowY: 'auto' }}>
            {stats && stats.agent_count > 0 ? (
              // When we have real agent list data, this would show actual agents
              // For now show a summary view from dashboard stats
              <>
                <AgentStatusItem>
                  <StatusDot $status="online" />
                  <AgentNameText>在线 Agent</AgentNameText>
                  <AgentStatusBadge style={{ color: colors.text.success }}>
                    {stats.agent_online_count}
                  </AgentStatusBadge>
                </AgentStatusItem>
                <AgentStatusItem>
                  <StatusDot $status="offline" />
                  <AgentNameText>离线 Agent</AgentNameText>
                  <AgentStatusBadge>
                    {stats.agent_count - stats.agent_online_count}
                  </AgentStatusBadge>
                </AgentStatusItem>
                <AgentStatusItem>
                  <StatusDot $status="online" />
                  <AgentNameText>总 Agent 数</AgentNameText>
                  <AgentStatusBadge>{stats.agent_count}</AgentStatusBadge>
                </AgentStatusItem>
              </>
            ) : (
              <NoDataText>暂无 Agent 数据</NoDataText>
            )}
            </div>
          </SectionCard>
        </Col>

        <Col xs={24} lg={14}>
          <SectionCard $scrollable>
            <SectionTitle>最近任务</SectionTitle>
            <Table<RecentTask>
              columns={recentTaskColumns}
              dataSource={stats?.recent_tasks ?? []}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: '暂无任务' }}
              scroll={{ y: 260 }}
            />
          </SectionCard>
        </Col>
      </Row>

      {/* ── bottom section: Token chart ── */}
      <div style={{ marginTop: spacing[5] }}>
        <SectionCard>
          <SectionTitle>Token 消耗趋势（最近 7 天）</SectionTitle>
          <ChartWrapper>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.primary[500]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={colors.primary[500]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border.DEFAULT} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: colors.text.secondary, fontSize: typography.fontSize.sm }}
                  axisLine={{ stroke: colors.border.DEFAULT }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: colors.text.secondary, fontSize: typography.fontSize.sm }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: colors.surface.raised,
                    border: `1px solid ${colors.border.DEFAULT}`,
                    borderRadius: radius.lg,
                    color: colors.text.primary,
                    fontSize: typography.fontSize.base,
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} tokens`, '消耗']}
                />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke={colors.primary[500]}
                  fill="url(#tokenGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </SectionCard>
      </div>
    </div>
  );
};

export default DashboardPage;
