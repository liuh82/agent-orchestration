import { Progress } from 'antd';
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

export const TaskStatsCard = ({ data }: { data: any }) => {
  const total = data?.total ?? 0;
  const running = data?.running ?? 0;
  const completed = data?.completed ?? 0;
  const failed = data?.failed ?? 0;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <Row><Label>总任务</Label><Value>{total}</Value></Row>
      <Row><Label>运行中</Label><Value style={{ color: colors.primary[500] }}>{running}</Value></Row>
      <Row><Label>已完成</Label><Value style={{ color: colors.success[500] }}>{completed}</Value></Row>
      <Row><Label>失败</Label><Value style={{ color: colors.error[500] }}>{failed}</Value></Row>
      <div style={{ marginTop: spacing[2] }}>
        <Progress percent={rate} showInfo strokeColor={colors.success[500]} size="small" />
      </div>
    </div>
  );
};
