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

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${spacing[4]};
  margin-bottom: ${spacing[4]};

  @media (max-width: 996px) {
    grid-template-columns: 1fr;
  }
`;

const CardWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
  padding: ${spacing[4]};
  display: flex;
  flex-direction: column;
  min-height: 180px;
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
  const { cards, collapsedCards } = useDashboardStore();

  return (
    <Grid>
      {cards.map((card) => {
        const Comp = CARD_COMPONENTS[card.type];
        const meta = CARD_META[card.type];
        const isCollapsed = collapsedCards.has(card.id);

        return (
          <CardWrapper key={card.id}>
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
      })}
    </Grid>
  );
};
