import styled from 'styled-components';
import { Progress } from 'antd';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { shadow } from '@/styles/tokens/shadow';
import { animation } from '@/styles/tokens/animation';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { Project } from '@/types/project';

const CardWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  cursor: pointer;
  transition:
    border-color ${animation.duration.normal} ${animation.easing.default},
    transform ${animation.duration.normal} ${animation.easing.default},
    box-shadow ${animation.duration.normal} ${animation.easing.default};

  &:hover {
    border-color: ${colors.border.hover};
    transform: translateY(-1px);
    box-shadow: ${shadow.sm};
  }
`;

const ProjectName = styled.h3`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin: 0 0 ${spacing[2]} 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Description = styled.p`
  font-size: ${typography.fontSize.base};
  color: ${colors.text.secondary};
  margin: 0 0 ${spacing[4]} 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  min-height: 42px;
`;

const Divider = styled.div`
  height: 1px;
  background: ${colors.border.DEFAULT};
  margin-bottom: ${spacing[4]};
`;

const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
  margin-bottom: ${spacing[3]};
`;

const StatItem = styled.span`
  color: ${colors.text.muted};
`;

const StatValue = styled.span`
  color: ${colors.text.secondary};
  font-weight: ${typography.fontWeight.medium};
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const TokenInfo = styled.span`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.muted};
`;

const ProgressWrapper = styled.div`
  margin-bottom: ${spacing[3]};

  .ant-progress-bg {
    height: 4px !important;
    border-radius: ${radius.full} !important;
  }

  .ant-progress-inner {
    background: ${colors.neutral[800]} !important;
    border-radius: ${radius.full} !important;
  }
`;

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

/** Format a large number with K/M suffix */
function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return String(count);
}

export const ProjectCard = ({ project, onClick }: ProjectCardProps) => {
  const totalTasks = project.total_tasks ?? 0;
  const completedTasks = project.completed_tasks ?? 0;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const tokenUsage = project.total_tokens ?? 0;

  return (
    <CardWrapper onClick={onClick}>
      <ProjectName>{project.name}</ProjectName>
      <Description>{project.description ?? '暂无描述'}</Description>

      <Divider />

      <StatsRow>
        <StatItem>
          任务 <StatValue>{totalTasks}</StatValue>
        </StatItem>
        <StatItem>
          完成 <StatValue>{completedTasks}</StatValue>
        </StatItem>
        <StatItem>
          {completionPercent > 0 && <span style={{ color: colors.success[500] }}>&#10003;</span>}{' '}
          <StatValue>{completionPercent}%</StatValue>
        </StatItem>
      </StatsRow>

      <ProgressWrapper>
        <Progress
          percent={completionPercent}
          showInfo={false}
          strokeColor={
            completionPercent >= 80
              ? colors.success[500]
              : completionPercent >= 40
                ? colors.primary[400]
                : colors.warning[500]
          }
          size="small"
        />
      </ProgressWrapper>

      <FooterRow>
        <TokenInfo>Token: {formatTokenCount(tokenUsage)}</TokenInfo>
        <StatusBadge status={project.status === 'deleted' ? 'archived' : project.status} />
      </FooterRow>
    </CardWrapper>
  );
};
