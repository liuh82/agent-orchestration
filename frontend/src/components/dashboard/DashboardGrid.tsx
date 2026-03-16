import { useMemo } from 'react';
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { TaskStatsCard } from './cards/TaskStatsCard';
import { TokenUsageCard } from './cards/TokenUsageCard';
import { CostCard } from './cards/CostCard';
import { ActiveProjectsCard } from './cards/ActiveProjectsCard';
import { AgentStatusCard } from './cards/AgentStatusCard';
import { RecentTasksCard } from './cards/RecentTasksCard';
import { useDashboardStore } from '@/stores/useDashboardStore';
import type { CardType } from '@/stores/useDashboardStore';
import 'react-grid-layout/css/styles.css';

const CardWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
  padding: ${spacing[4]};
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${spacing[3]};
  flex-shrink: 0;
`;

const CardTitle = styled.span`
  font-size: 13px;
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.secondary};
`;

const CardBody = styled.div`
  flex: 1;
  overflow: auto;
`;

const CARD_META: Record<string, { title: string }> = {
  task_stats: { title: '任务统计' },
  token_usage: { title: 'Token 消耗' },
  cost: { title: '成本统计' },
  active_projects: { title: '活跃项目' },
  agent_status: { title: 'Agent 状态' },
  recent_tasks: { title: '最近任务' },
};

const CARD_COMPONENTS: Record<CardType, React.FC<{ data: any }>> = {
  task_stats: TaskStatsCard,
  token_usage: TokenUsageCard,
  cost: CostCard,
  active_projects: ActiveProjectsCard,
  agent_status: AgentStatusCard,
  recent_tasks: RecentTasksCard,
};

interface DashboardGridProps {
  cardData: Record<string, any>;
}

export const DashboardGrid = ({ cardData }: DashboardGridProps) => {
  const { layouts, cards, collapsedCards } = useDashboardStore();
  const { width, containerRef } = useContainerWidth();

  const layoutItems = useMemo(() => {
    return cards.map((card) => {
      const Comp = CARD_COMPONENTS[card.type];
      const meta = CARD_META[card.type];
      const isCollapsed = collapsedCards.has(card.id);

      return (
        <CardWrapper key={card.id} style={isCollapsed ? { height: 60 } : undefined}>
          <CardHeader>
            <CardTitle>{meta?.title ?? card.type}</CardTitle>
          </CardHeader>
          {!isCollapsed && (
            <CardBody>
              {Comp && <Comp data={cardData[card.type]} />}
            </CardBody>
          )}
        </CardWrapper>
      );
    });
  }, [cards, cardData, collapsedCards]);

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>}>
      <ResponsiveGridLayout
        className="dashboard-grid"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768 }}
        cols={{ lg: 12, md: 10, sm: 6 }}
        rowHeight={80}
        width={width}
        dragConfig={{ enabled: false }}
        resizeConfig={{ enabled: false }}
        compactor={verticalCompactor}
        margin={[Number(spacing[4]), Number(spacing[4])]}
      >
        {layoutItems}
      </ResponsiveGridLayout>
    </div>
  );
};
