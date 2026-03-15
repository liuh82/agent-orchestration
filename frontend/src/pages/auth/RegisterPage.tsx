import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
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
  background: #f5f5f5;
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

interface RegisterFormValues {
  email: string;
  password: string;
  name: string;
}

export const RegisterPage = () => {
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const onFinish = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      await register(values.email, values.password, values.name);
      message.success('注册成功');
      navigate('/', { replace: true });
    } catch (err: any) {
      message.error(err?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <Card>
        <Logo>Nexus</Logo>
        <Form<RegisterFormValues> layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
          <Form.Item
            name="name"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" size="large" />
          </Form.Item>
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
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码（至少 8 位）" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              注册
            </Button>
          </Form.Item>
        </Form>
        <Footer>
          已有账号？<Link to="/login">立即登录</Link>
        </Footer>
      </Card>
    </Wrapper>
  );
};

export default RegisterPage;
