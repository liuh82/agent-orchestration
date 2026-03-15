import styled from 'styled-components';
import { RightOutlined } from '@ant-design/icons';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { shadow } from '@/styles/tokens/shadow';
import { animation } from '@/styles/tokens/animation';
import type { AgentInstance } from '@/types/agent';

/* ── styled components ── */

const CardWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  cursor: pointer;
  transition: border-color ${animation.duration.normal} ${animation.easing.default},
              transform ${animation.duration.normal} ${animation.easing.default},
              box-shadow ${animation.duration.normal} ${animation.easing.default};

  &:hover {
    border-color: ${colors.border.hover};
    transform: translateY(-1px);
    box-shadow: ${shadow.sm};
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  margin-bottom: ${spacing[3]};
`;

const StatusDot = styled.span<{ $status: AgentInstance['status'] }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $status }) =>
    $status === 'online'
      ? colors.success[500]
      : $status === 'busy'
        ? colors.warning[500]
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

const AgentName = styled.span`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TypeBadge = styled.span`
  display: inline-block;
  padding: 2px ${spacing[2]};
  border-radius: ${radius.sm};
  font-size: ${typography.fontSize.xs};
  font-weight: ${typography.fontWeight.medium};
  background: rgba(99,102,241,0.12);
  color: ${colors.text.brand};
`;

const ModelInfo = styled.div`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
  margin-bottom: ${spacing[4]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Divider = styled.div`
  height: 1px;
  background: ${colors.border.DEFAULT};
  margin-bottom: ${spacing[4]};
`;

const StatsRow = styled.div`
  display: flex;
  gap: ${spacing[4]};
  margin-bottom: ${spacing[3]};
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StatValue = styled.span`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
`;

const StatLabel = styled.span`
  font-size: ${typography.fontSize.xs};
  color: ${colors.text.muted};
`;

const TokenInfo = styled.div`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: ${spacing[4]};
  color: ${colors.text.muted};
  font-size: ${typography.fontSize.sm};
  transition: color ${animation.duration.normal} ${animation.easing.default};

  ${CardWrapper}:hover & {
    color: ${colors.text.brand};
  }
`;

/* ── component ── */

interface AgentCardProps {
  agent: AgentInstance;
  onClick: (agent: AgentInstance) => void;
}

export const AgentCard = ({ agent, onClick }: AgentCardProps) => {
  const formatToken = (value?: number): string => {
    if (value == null) return '0';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return String(value);
  };

  return (
    <CardWrapper onClick={() => onClick(agent)}>
      <CardHeader>
        <StatusDot $status={agent.status} />
        <AgentName>{agent.name}</AgentName>
      </CardHeader>

      <TypeBadge>{agent.agent_type_id}</TypeBadge>

      {agent.config?.model && (
        <ModelInfo>Model: {agent.config.model}</ModelInfo>
      )}

      <Divider />

      <StatsRow>
        <StatItem>
          <StatValue>0</StatValue>
          <StatLabel>任务</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue>0</StatValue>
          <StatLabel>完成</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue>0</StatValue>
          <StatLabel>失败</StatLabel>
        </StatItem>
      </StatsRow>

      <TokenInfo>Token: {formatToken(agent.token_usage_today ?? agent.token_usage_month)}</TokenInfo>

      <CardFooter>
        详情 <RightOutlined style={{ fontSize: 10, marginLeft: 4 }} />
      </CardFooter>
    </CardWrapper>
  );
};
