import { Empty } from 'antd';
import styled from 'styled-components';
import { spacing } from '@/styles/tokens/spacing';
import type { ReactNode } from 'react';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${spacing[12]} ${spacing[6]};
`;

const ActionWrapper = styled.div`
  margin-top: ${spacing[4]};
`;

interface EmptyStateProps {
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export const EmptyState = ({ description = '暂无数据', icon, action }: EmptyStateProps) => (
  <Wrapper>
    <Empty image={icon} description={description} />
    {action && <ActionWrapper>{action}</ActionWrapper>}
  </Wrapper>
);
