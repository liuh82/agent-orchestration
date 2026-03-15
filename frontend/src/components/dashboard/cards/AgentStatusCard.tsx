import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  padding: ${spacing[2]} 0;
`;

const Dot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const Label = styled.span`
  font-size: 13px;
  color: ${colors.text.secondary};
  flex: 1;
`;

const Count = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${colors.text.primary};
`;

export const AgentStatusCard = ({ data }: { data: any }) => {
  const online = data?.online ?? 0;
  const offline = data?.offline ?? 0;
  const total = data?.total ?? 0;

  return (
    <div>
      <StatusRow>
        <Dot $color={colors.success[500]} />
        <Label>在线</Label>
        <Count>{online}</Count>
      </StatusRow>
      <StatusRow>
        <Dot $color={colors.neutral[400]} />
        <Label>离线</Label>
        <Count>{offline}</Count>
      </StatusRow>
      <StatusRow>
        <Dot $color={colors.primary[500]} />
        <Label>总计</Label>
        <Count>{total}</Count>
      </StatusRow>
    </div>
  );
};
