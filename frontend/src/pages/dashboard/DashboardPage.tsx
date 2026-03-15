import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { PageHeader } from '@/components/common/PageHeader';

const Placeholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: ${colors.text.muted};
  font-size: ${typography.fontSize.lg};
  gap: ${spacing[3]};
`;

export const DashboardPage = () => (
  <div>
    <PageHeader title="Dashboard" />
    <Placeholder>
      <span>Dashboard</span>
      <span style={{ fontSize: '14px', color: colors.text.disabled }}>Coming soon...</span>
    </Placeholder>
  </div>
);

export default DashboardPage;
