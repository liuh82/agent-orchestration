import { useMemo } from 'react';
import { Col, Row, Skeleton } from 'antd';
import {
  UserOutlined,
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
import { shadow } from '@/styles/tokens/shadow';
import api from '@/api/client';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import type { ApiResponse } from '@/types/api';

/* ── styled components ── */

const StatCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  transition: border-color ${animation.duration.normal} ${animation.easing.default};

  &:hover {
    border-color: ${colors.border.hover};
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

const StatValueSecondary = styled.span`
  font-size: ${typography.fontSize.base};
  font-weight: ${typography.fontWeight.normal};
  color: ${colors.text.secondary};
  margin-left: ${spacing[2]};
`;

const StatLabel = styled.div`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
  margin-top: ${spacing[1]};
`;

const SectionCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  margin-top: ${spacing[5]};
`;

const SectionTitle = styled.h3`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin: 0 0 ${spacing[4]} 0;
`;

const ChartWrapper = styled.div`
  height: 280px;
  width: 100%;
`;

const SkeletonCard = styled(Skeleton)`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

/* ── interfaces ── */

interface AdminGlobalStats {
  user_count: number;
  user_active_count: number;
  agent_count: number;
  agent_online_count: number;
  project_count: number;
  project_active_count: number;
  task_count: number;
  task_completed_count: number;
  job_count: number;
  job_completed_count: number;
  total_token_usage: number;
  total_fee: number;
  token_trend?: Array<{ date: string; tokens: number }>;
}

/* ── mock data helper ── */

const generateMockTokenTrend = () => {
  const data: Array<{ date: string; tokens: number }> = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      tokens: Math.floor(Math.random() * 80000) + 10000,
    });
  }
  return data;
};

/* ── stat card skeleton ── */

const StatCardSkeleton = () => (
  <SkeletonCard active paragraph={{ rows: 2 }} title={false} />
);

/* ── stat card component ── */

interface StatCardItemProps {
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  secondaryValue?: string;
  label: string;
  valuePrefix?: string;
  valueSuffix?: string;
  valueColor?: string;
  formatter?: (v: number) => string;
}

const StatCardItem = ({
  icon,
  iconBg,
  value,
  secondaryValue,
  label,
  valuePrefix = '',
  valueSuffix = '',
  valueColor,
  formatter,
}: StatCardItemProps) => (
  <StatCard>
    <StatIconWrapper $color={iconBg}>{icon}</StatIconWrapper>
    <StatValue style={valueColor ? { color: valueColor } : undefined}>
      {valuePrefix}
      {formatter ? formatter(value) : value.toLocaleString()}
      {valueSuffix}
      {secondaryValue && <StatValueSecondary>{secondaryValue}</StatValueSecondary>}
    </StatValue>
    <StatLabel>{label}</StatLabel>
  </StatCard>
);

/* ── main component ── */

export const AdminDashboard = () => {
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<AdminGlobalStats>, Error>(
    ['admin-dashboard'],
    () => api.get('/v1/admin/stats/global') as Promise<any>,
  );

  const stats = response?.data;

  const tokenTrend = useMemo(() => {
    if (stats?.token_trend && stats.token_trend.length > 0) {
      return stats.token_trend;
    }
    return generateMockTokenTrend();
  }, [stats?.token_trend]);

  const taskCompletionRate = useMemo(() => {
    if (!stats || stats.task_count === 0) return 0;
    return Math.round((stats.task_completed_count / stats.task_count) * 100);
  }, [stats]);

  const jobCompletionRate = useMemo(() => {
    if (!stats || stats.job_count === 0) return 0;
    return Math.round((stats.job_completed_count / stats.job_count) * 100);
  }, [stats]);

  const formatToken = (value: number): string => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(value);
  };

  const formatFee = (value: number): string => {
    return `\u00A5${value.toFixed(2)}`;
  };

  /* ── error state ── */
  if (isError) {
    return (
      <div>
        <PageHeader title="管理面板" />
        <ErrorBlock
          message={error?.message || '加载管理数据失败'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ── loading state ── */
  if (isLoading) {
    return (
      <div>
        <PageHeader title="管理面板" />
        <Row gutter={[spacing[5], spacing[5]]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <StatCardSkeleton />
            </Col>
          ))}
        </Row>
        <SectionCard>
          <SkeletonCard active paragraph={{ rows: 6 }} title={false} />
        </SectionCard>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="管理面板" />

      {/* ── 6 stat cards: 2 rows x 3 cols ── */}
      <Row gutter={[spacing[5], spacing[5]]}>
        <Col xs={24} sm={12} lg={8}>
          <StatCardItem
            icon={<UserOutlined />}
            iconBg="rgba(99,102,241,0.12)"
            value={stats?.user_count ?? 0}
            secondaryValue={`/ 活跃 ${stats?.user_active_count ?? 0}`}
            label="用户总数"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCardItem
            icon={<RobotOutlined />}
            iconBg="rgba(34,197,94,0.12)"
            value={stats?.agent_count ?? 0}
            secondaryValue={`/ 在线 ${stats?.agent_online_count ?? 0}`}
            label="Agent 总数"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCardItem
            icon={<ProjectOutlined />}
            iconBg="rgba(59,130,246,0.12)"
            value={stats?.project_count ?? 0}
            secondaryValue={`/ 活跃 ${stats?.project_active_count ?? 0}`}
            label="项目总数"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCardItem
            icon={<CheckCircleOutlined />}
            iconBg="rgba(34,197,94,0.12)"
            value={taskCompletionRate}
            valueSuffix="%"
            label="任务完成率"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCardItem
            icon={<ThunderboltOutlined />}
            iconBg="rgba(99,102,241,0.12)"
            value={jobCompletionRate}
            valueSuffix="%"
            label="Job 完成率"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCardItem
            icon={<DollarOutlined />}
            iconBg="rgba(245,158,11,0.12)"
            value={stats?.total_token_usage ?? 0}
            secondaryValue={`/ ${formatFee(stats?.total_fee ?? 0)}`}
            label="总 Token 消耗 / 总费用"
            formatter={formatToken}
          />
        </Col>
      </Row>

      {/* ── Token consumption trend chart ── */}
      <SectionCard>
        <SectionTitle>Token 消耗趋势（近 30 天）</SectionTitle>
        <ChartWrapper>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tokenTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="adminTokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.primary[500]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colors.primary[500]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border.DEFAULT} />
              <XAxis
                dataKey="date"
                tick={{ fill: colors.text.secondary, fontSize: typography.fontSize.sm }}
                axisLine={{ stroke: colors.border.DEFAULT }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: colors.text.secondary, fontSize: typography.fontSize.sm }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatToken(v)}
              />
              <RechartsTooltip
                contentStyle={{
                  background: colors.surface.raised,
                  border: `1px solid ${colors.border.DEFAULT}`,
                  borderRadius: radius.lg,
                  color: colors.text.primary,
                  fontSize: typography.fontSize.base,
                  boxShadow: shadow.md,
                }}
                formatter={(value: number) => [`${value.toLocaleString()} tokens`, '消耗']}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke={colors.primary[500]}
                fill="url(#adminTokenGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </SectionCard>
    </div>
  );
};

export default AdminDashboard;
