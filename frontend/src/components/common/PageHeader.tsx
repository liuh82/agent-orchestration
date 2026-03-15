import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import type { ReactNode } from 'react';

const HeaderWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${spacing.gap.lg};

  h1 {
    font-size: ${typography.fontSize['2xl']};
    font-weight: ${typography.fontWeight.semibold};
    color: ${colors.text.primary};
    margin: 0;
  }
`;

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export const PageHeader = ({ title, actions }: PageHeaderProps) => (
  <HeaderWrapper>
    <h1>{title}</h1>
    {actions && <div>{actions}</div>}
  </HeaderWrapper>
);
