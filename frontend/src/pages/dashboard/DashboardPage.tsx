import { Skeleton } from 'antd';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { dashboardApi } from '@/api/dashboard';
import { gatewayApi } from '@/api/gateway';

const SkeletonCard = styled(Skeleton)`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: 8px;
  padding: ${spacing[4]};
`;

const SkeletonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${spacing[4]};
  margin-bottom: ${spacing[4]};

  @media (max-width: 996px) {
    grid-template-columns: 1fr;
  }
`;

export const DashboardPage = () => {
  const {
    data: statsResponse,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useQuery(['dashboard-stats'], () =>
    dashboardApi.getPersonalStats(),
  );

  const {
    data: recentResponse,
  } = useQuery(['dashboard-recent-tasks'], () => dashboardApi.getRecentTasks());

  // Bridge status — 10s 轮询
  const { data: bridgesResponse } = useQuery(
    ['gateway-bridges'],
    () => gatewayApi.listBridges(),
    { refetchInterval: 10_000 },
  );

  // Gateway tasks — 15s 轮询
  const { data: gatewayTasksResponse } = useQuery(
    ['gateway-tasks'],
    () => gatewayApi.listTasks({ limit: 50, sort_by: 'submitted_at', sort_order: 'desc' }),
    { refetchInterval: 15_000 },
  );

  const stats = statsResponse?.data ?? statsResponse;

  const cardData = {
    task_stats: stats?.tasks ?? { running: 0, completed: 0, failed: 0, total: 0 },
    token_usage: stats?.tokens ?? { today: 0, week: 0, month: 0, total: 0 },
    cost: stats?.cost ?? { today: 0, week: 0, month: 0, total: 0 },
    active_projects: stats?.projects ?? { active: 0, total: 0 },
    agent_status: stats?.agents ?? { online: 0, offline: 0, total: 0 },
    bridge_status: bridgesResponse?.data ?? [],
    recent_tasks: recentResponse?.data ?? recentResponse ?? [],
    task_timeline: gatewayTasksResponse?.data?.items ?? [],
  };

  if (statsError) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <ErrorBlock message={(statsErr as Error)?.message || '加载失败'} onRetry={() => refetchStats()} />
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <SkeletonGrid>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} active paragraph={{ rows: 4 }} title={false} />
          ))}
        </SkeletonGrid>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" />
      <DashboardGrid cardData={cardData} />
    </div>
  );
};

export default DashboardPage;
