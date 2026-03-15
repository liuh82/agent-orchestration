import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useAuthStore } from '@/stores/auth';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { typography } from '@/styles/tokens/typography';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${colors.neutral[950]};
`;

const Card = styled.div`
  width: 400px;
  padding: ${spacing[8]};
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
`;

const Logo = styled.h1`
  text-align: center;
  font-size: ${typography.fontSize['3xl']};
  font-weight: ${typography.fontWeight.bold};
  background: ${colors.gradient.brand};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 ${spacing[8]} 0;
`;

const Footer = styled.div`
  text-align: center;
  margin-top: ${spacing[4]};
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
`;

interface LoginFormValues {
  email: string;
  password: string;
}

export const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success('登录成功');
      navigate(from, { replace: true });
    } catch (err: any) {
      message.error(err?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <Card>
        <Logo>Nexus</Logo>
        <Form<LoginFormValues> layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="请输入邮箱" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              登录
            </Button>
          </Form.Item>
        </Form>
        <Footer>
          没有账号？<Link to="/register">立即注册</Link>
        </Footer>
      </Card>
    </Wrapper>
  );
};

export default LoginPage;
