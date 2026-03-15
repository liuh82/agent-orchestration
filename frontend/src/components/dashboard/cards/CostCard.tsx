import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${spacing[1]} 0;
`;

const Label = styled.span`
  font-size: 13px;
  color: ${colors.text.secondary};
`;

const Value = styled.span`
  font-size: 15px;
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
`;

const formatCost = (n: number) => n >= 1000 ? `¥${(n / 1000).toFixed(1)}K` : `¥${n.toFixed(2)}`;

export const CostCard = ({ data }: { data: any }) => {
  return (
    <div>
      <Row><Label>今日</Label><Value>{formatCost(data?.today ?? 0)}</Value></Row>
      <Row><Label>本周</Label><Value>{formatCost(data?.week ?? 0)}</Value></Row>
      <Row><Label>本月</Label><Value style={{ color: colors.warning[500] }}>{formatCost(data?.month ?? 0)}</Value></Row>
      <Row><Label>总计</Label><Value>{formatCost(data?.total ?? 0)}</Value></Row>
    </div>
  );
};
