import { Skeleton } from 'antd';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { dashboardApi } from '@/api/dashboard';
import { useAuthStore } from '@/stores/auth';

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
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const {
    data: statsResponse,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useQuery(['dashboard-stats'], () =>
    isAdmin ? dashboardApi.getGlobalStats() : dashboardApi.getPersonalStats(),
  );

  const {
    data: recentResponse,
  } = useQuery(['dashboard-recent-tasks'], () => dashboardApi.getRecentTasks());

  const stats = statsResponse?.data ?? statsResponse;

  const cardData = {
    task_stats: stats?.tasks ?? { running: 0, completed: 0, failed: 0, total: 0 },
    token_usage: stats?.tokens ?? { today: 0, week: 0, month: 0, total: 0 },
    cost: stats?.cost ?? { today: 0, week: 0, month: 0, total: 0 },
    active_projects: stats?.projects ?? { active: 0, total: 0 },
    agent_status: stats?.agents ?? { online: 0, offline: 0, total: 0 },
    recent_tasks: recentResponse?.data ?? recentResponse ?? [],
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
