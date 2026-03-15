import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';

const BigValue = styled.div`
  font-size: 36px;
  font-weight: ${typography.fontWeight.bold};
  color: ${colors.primary[500]};
  line-height: 1;
`;

const Label = styled.div`
  font-size: 13px;
  color: ${colors.text.secondary};
  margin-top: ${spacing[2]};
`;

const SubRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: ${spacing[3]};
  padding-top: ${spacing[3]};
  border-top: 1px solid ${colors.border.DEFAULT};
`;

export const ActiveProjectsCard = ({ data }: { data: any }) => {
  const active = data?.active ?? 0;
  const total = data?.total ?? 0;

  return (
    <div>
      <BigValue>{active}</BigValue>
      <Label>活跃项目</Label>
      <SubRow>
        <span style={{ fontSize: 13, color: colors.text.secondary }}>总项目</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: colors.text.primary }}>{total}</span>
      </SubRow>
    </div>
  );
};
