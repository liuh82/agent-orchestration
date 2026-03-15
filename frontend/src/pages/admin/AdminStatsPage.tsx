import { useMemo } from 'react';
import { Col, Row, Skeleton } from 'antd';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { shadow } from '@/styles/tokens/shadow';
import api from '@/api/client';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import type { ApiResponse } from '@/types/api';
import { useQuery } from 'react-query';

/* ── styled components ── */

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
  total_token_usage: number;
  total_fee: number;
  token_trend?: Array<{ date: string; tokens: number }>;
  fee_trend?: Array<{ date: string; fee: number }>;
  agent_usage_ranking?: Array<{ name: string; tokens: number }>;
  project_token_ranking?: Array<{ name: string; tokens: number }>;
  user_activity?: Array<{ date: string; count: number }>;
}

/* ── formatters ── */

const formatToken = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};

const formatFee = (value: number): string => {
  return `\u00A5${value.toFixed(2)}`;
};

/* ── mock data generators ── */

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

const generateMockFeeTrend = () => {
  const data: Array<{ date: string; fee: number }> = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      fee: Math.round(Math.random() * 5000 + 500) / 100,
    });
  }
  return data;
};

const generateMockAgentRanking = () => {
  const names = [
    'GPT-4o-Dev',
    'Claude-Code',
    'Codex-Agent',
    'OpenCode-Pro',
    'DeepSeek-V3',
    'GPT-4o-Mini',
    'Claude-Haiku',
    'Gemini-Pro',
    'Qwen-Max',
    'Llama-3.1-70B',
  ];
  return names.map((name) => ({
    name,
    tokens: Math.floor(Math.random() * 500000) + 20000,
  })).sort((a, b) => b.tokens - a.tokens).slice(0, 10);
};

const generateMockProjectRanking = () => {
  const names = [
    'API-Gateway',
    'User-Service',
    'Data-Pipeline',
    'Frontend-App',
    'ML-Inference',
    'Auth-Module',
    'Payment-Service',
    'Notification-Hub',
    'Analytics-Dashboard',
    'CI/CD-Platform',
  ];
  return names.map((name) => ({
    name,
    tokens: Math.floor(Math.random() * 400000) + 10000,
  })).sort((a, b) => b.tokens - a.tokens).slice(0, 10);
};

const generateMockUserActivity = () => {
  const data: Array<{ date: string; count: number }> = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      count: Math.floor(Math.random() * 50) + 5,
    });
  }
  return data;
};

/* ── shared tooltip style & numeric radius ── */

const barRadiusSm = Number(radius.sm);

const tooltipStyle: React.CSSProperties = {
  background: colors.surface.raised,
  border: `1px solid ${colors.border.DEFAULT}`,
  borderRadius: radius.lg,
  color: colors.text.primary,
  fontSize: typography.fontSize.base,
  boxShadow: shadow.md,
};

/* ── axis styles ── */

const xAxisTickStyle = {
  fill: colors.text.secondary,
  fontSize: typography.fontSize.sm,
};

const yAxisTickStyle = {
  fill: colors.text.secondary,
  fontSize: typography.fontSize.sm,
};

/* ── main component ── */

export const AdminStatsPage = () => {
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<AdminGlobalStats>, Error>(
    ['admin-stats'],
    () => api.get('/v1/admin/stats/global') as Promise<any>,
  );

  const stats = response?.data;

  /* ── computed chart data with mock fallbacks ── */

  const tokenTrend = useMemo(() => {
    if (stats?.token_trend && stats.token_trend.length > 0) {
      return stats.token_trend;
    }
    return generateMockTokenTrend();
  }, [stats?.token_trend]);

  const feeTrend = useMemo(() => {
    if (stats?.fee_trend && stats.fee_trend.length > 0) {
      return stats.fee_trend;
    }
    return generateMockFeeTrend();
  }, [stats?.fee_trend]);

  const agentRanking = useMemo(() => {
    if (stats?.agent_usage_ranking && stats.agent_usage_ranking.length > 0) {
      return stats.agent_usage_ranking;
    }
    return generateMockAgentRanking();
  }, [stats?.agent_usage_ranking]);

  const projectRanking = useMemo(() => {
    if (stats?.project_token_ranking && stats.project_token_ranking.length > 0) {
      return stats.project_token_ranking;
    }
    return generateMockProjectRanking();
  }, [stats?.project_token_ranking]);

  const userActivity = useMemo(() => {
    if (stats?.user_activity && stats.user_activity.length > 0) {
      return stats.user_activity;
    }
    return generateMockUserActivity();
  }, [stats?.user_activity]);

  /* ── error state ── */
  if (isError) {
    return (
      <div>
        <PageHeader title="统计分析" />
        <ErrorBlock
          message={error?.message || '加载统计数据失败'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ── loading state ── */
  if (isLoading) {
    return (
      <div>
        <PageHeader title="统计分析" />
        <Row gutter={[spacing[5], spacing[5]]}>
          <Col xs={24} lg={12}>
            <SkeletonCard active paragraph={{ rows: 6 }} title={false} />
          </Col>
          <Col xs={24} lg={12}>
            <SkeletonCard active paragraph={{ rows: 6 }} title={false} />
          </Col>
          <Col xs={24} lg={12}>
            <SkeletonCard active paragraph={{ rows: 6 }} title={false} />
          </Col>
          <Col xs={24} lg={12}>
            <SkeletonCard active paragraph={{ rows: 6 }} title={false} />
          </Col>
          <Col xs={24}>
            <SkeletonCard active paragraph={{ rows: 6 }} title={false} />
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="统计分析" />

      {/* ── Row 1: Token consumption + Fee trend (AreaCharts) ── */}
      <Row gutter={[spacing[5], spacing[5]]}>
        <Col xs={24} lg={12}>
          <SectionCard>
            <SectionTitle>Token 消耗趋势（近 30 天）</SectionTitle>
            <ChartWrapper>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tokenTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="statsTokenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.primary[500]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={colors.primary[500]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border.DEFAULT} />
                  <XAxis
                    dataKey="date"
                    tick={xAxisTickStyle}
                    axisLine={{ stroke: colors.border.DEFAULT }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={yAxisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatToken(v)}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${value.toLocaleString()} tokens`, '消耗']}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke={colors.primary[500]}
                    fill="url(#statsTokenGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </SectionCard>
        </Col>

        <Col xs={24} lg={12}>
          <SectionCard>
            <SectionTitle>费用趋势（近 30 天）</SectionTitle>
            <ChartWrapper>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={feeTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="statsFeeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.warning[500]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={colors.warning[500]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border.DEFAULT} />
                  <XAxis
                    dataKey="date"
                    tick={xAxisTickStyle}
                    axisLine={{ stroke: colors.border.DEFAULT }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={yAxisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatFee(v)}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [formatFee(value), '费用']}
                  />
                  <Area
                    type="monotone"
                    dataKey="fee"
                    stroke={colors.warning[500]}
                    fill="url(#statsFeeGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </SectionCard>
        </Col>
      </Row>

      {/* ── Row 2: Agent usage ranking + Project Token ranking (horizontal BarCharts) ── */}
      <Row gutter={[spacing[5], spacing[5]]}>
        <Col xs={24} lg={12}>
          <SectionCard>
            <SectionTitle>Agent 使用排行（Top 10）</SectionTitle>
            <ChartWrapper>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agentRanking}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border.DEFAULT} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={yAxisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatToken(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={xAxisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${value.toLocaleString()} tokens`, '消耗']}
                  />
                  <Bar
                    dataKey="tokens"
                    fill={colors.primary[400]}
                    radius={[0, barRadiusSm, barRadiusSm, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </SectionCard>
        </Col>

        <Col xs={24} lg={12}>
          <SectionCard>
            <SectionTitle>项目 Token 排行（Top 10）</SectionTitle>
            <ChartWrapper>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={projectRanking}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border.DEFAULT} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={yAxisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatToken(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={xAxisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${value.toLocaleString()} tokens`, '消耗']}
                  />
                  <Bar
                    dataKey="tokens"
                    fill={colors.info[500]}
                    radius={[0, barRadiusSm, barRadiusSm, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </SectionCard>
        </Col>
      </Row>

      {/* ── Row 3: User activity (BarChart, full width) ── */}
      <SectionCard>
        <SectionTitle>用户活跃度（近 7 天登录次数）</SectionTitle>
        <ChartWrapper>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={userActivity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border.DEFAULT} />
              <XAxis
                dataKey="date"
                tick={xAxisTickStyle}
                axisLine={{ stroke: colors.border.DEFAULT }}
                tickLine={false}
              />
              <YAxis
                tick={yAxisTickStyle}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <RechartsTooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value} 次`, '登录次数']}
              />
              <Bar
                dataKey="count"
                fill={colors.success[500]}
                radius={[barRadiusSm, barRadiusSm, 0, 0]}
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </SectionCard>
    </div>
  );
};

export default AdminStatsPage;
