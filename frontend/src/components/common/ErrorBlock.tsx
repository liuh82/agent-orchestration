import { Button, Result } from 'antd';
import styled from 'styled-components';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
`;

interface ErrorBlockProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorBlock = ({ message = '加载失败', onRetry }: ErrorBlockProps) => (
  <Wrapper>
    <Result
      status="error"
      title="出错了"
      subTitle={message}
      extra={onRetry && <Button type="primary" onClick={onRetry}>重试</Button>}
    />
  </Wrapper>
);
