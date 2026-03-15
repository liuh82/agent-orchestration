import { useState } from 'react';
import { Tabs, Form, Input, Button, Avatar, Tag, Switch, Skeleton, message } from 'antd';
import { UserOutlined, LockOutlined, BellOutlined, SaveOutlined, ApiOutlined } from '@ant-design/icons';
import { useMutation } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { authApi } from '@/api/auth';
import { BridgeManager } from './BridgeManager';
import { useAuthStore } from '@/stores/auth';
import { PageHeader } from '@/components/common/PageHeader';

/* ── styled components ── */

const TabCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  max-width: 600px;
`;

const ProfileHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[4]};
  margin-bottom: ${spacing[6]};
  padding-bottom: ${spacing[5]};
  border-bottom: 1px solid ${colors.border.DEFAULT};
`;

const ProfileInfo = styled.div`
  flex: 1;
`;

const ProfileName = styled.div`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
`;

const ProfileEmail = styled.div`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
  margin-top: ${spacing[1]};
`;

const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: ${spacing[6]};
  padding-top: ${spacing[5]};
  border-top: 1px solid ${colors.border.DEFAULT};
`;

const NotificationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${spacing[4]} 0;
  border-bottom: 1px solid ${colors.border.DEFAULT};

  &:last-child {
    border-bottom: none;
  }
`;

const NotificationLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[1]};
`;

const NotificationTitle = styled.span`
  font-size: ${typography.fontSize.base};
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.primary};
`;

const NotificationDesc = styled.span`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
`;

const StyledSkeleton = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]};
  padding: ${spacing[6]};
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  max-width: 600px;
`;

const RoleTagMap: Record<string, { color: string; label: string }> = {
  admin: { color: colors.primary[500], label: '管理员' },
  user: { color: colors.success[500], label: '普通用户' },
};

/* ── profile tab ── */

const ProfileTab = () => {
  const [form] = Form.useForm();
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  const updateMutation = useMutation(
    (data: { name?: string; avatar?: string }) => authApi.updateMe(data),
    {
      onSuccess: () => {
        void message.success('个人信息已更新');
        void fetchMe();
      },
      onError: () => {
        void message.error('更新失败，请重试');
      },
    },
  );

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      updateMutation.mutate({ name: values.name });
    } catch {
      // form validation failed, antd handles error display
    }
  };

  return (
    <TabCard>
      <ProfileHeader>
        <Avatar size={56} icon={<UserOutlined />} src={user?.avatar} />
        <ProfileInfo>
          <ProfileName>{user?.name}</ProfileName>
          <ProfileEmail>{user?.email}</ProfileEmail>
        </ProfileInfo>
      </ProfileHeader>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ name: user?.name }}
        autoComplete="off"
      >
        <Form.Item
          label="用户名"
          name="name"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder="输入用户名" />
        </Form.Item>

        <Form.Item label="邮箱">
          <Input value={user?.email} disabled />
        </Form.Item>

        <Form.Item label="角色">
          <Tag color={RoleTagMap[user?.role ?? 'user']?.color}>
            {RoleTagMap[user?.role ?? 'user']?.label}
          </Tag>
        </Form.Item>

        <FormActions>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={updateMutation.isLoading}
            onClick={handleSave}
          >
            保存修改
          </Button>
        </FormActions>
      </Form>
    </TabCard>
  );
};

/* ── password tab ── */

const PasswordTab = () => {
  const [form] = Form.useForm();

  const changePasswordMutation = useMutation(
    (data: { old_password: string; new_password: string }) =>
      authApi.changePassword(data.old_password, data.new_password),
    {
      onSuccess: () => {
        void message.success('密码修改成功');
        form.resetFields();
      },
      onError: () => {
        void message.error('密码修改失败，请检查原密码是否正确');
      },
    },
  );

  const handleChangePassword = async () => {
    try {
      const values = await form.validateFields();
      changePasswordMutation.mutate({
        old_password: values.old_password,
        new_password: values.new_password,
      });
    } catch {
      // form validation failed
    }
  };

  return (
    <TabCard>
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          label="原密码"
          name="old_password"
          rules={[{ required: true, message: '请输入原密码' }]}
        >
          <Input.Password placeholder="请输入原密码" />
        </Form.Item>

        <Form.Item
          label="新密码"
          name="new_password"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码长度不能少于 8 个字符' },
          ]}
        >
          <Input.Password placeholder="至少 8 个字符" />
        </Form.Item>

        <Form.Item
          label="确认新密码"
          name="confirm_password"
          dependencies={['new_password']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="再次输入新密码" />
        </Form.Item>

        <FormActions>
          <Button
            type="primary"
            icon={<LockOutlined />}
            loading={changePasswordMutation.isLoading}
            onClick={handleChangePassword}
          >
            修改密码
          </Button>
        </FormActions>
      </Form>
    </TabCard>
  );
};

/* ── notification preferences tab (placeholder) ── */

interface PreferenceItem {
  key: string;
  title: string;
  description: string;
  defaultChecked: boolean;
}

const preferenceList: PreferenceItem[] = [
  { key: 'task_completed', title: '任务完成通知', description: '当分配的任务完成时发送通知', defaultChecked: true },
  { key: 'task_failed', title: '任务失败通知', description: '当任务执行失败时发送通知', defaultChecked: true },
  { key: 'agent_offline', title: 'Agent 离线通知', description: '当 Agent 从在线变为离线时发送通知', defaultChecked: false },
  { key: 'daily_summary', title: '每日汇总', description: '每天定时发送 Token 消耗和任务汇总', defaultChecked: false },
  { key: 'system_alert', title: '系统告警', description: '系统异常和重要公告通知', defaultChecked: true },
];

const NotificationPreferencesTab = () => {
  const [preferences, setPreferences] = useState<Record<string, boolean>>(
    () => Object.fromEntries(preferenceList.map((p) => [p.key, p.defaultChecked])),
  );

  const handleToggle = (key: string, checked: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: checked }));
  };

  return (
    <TabCard>
      {preferenceList.map((item) => (
        <NotificationRow key={item.key}>
          <NotificationLabel>
            <NotificationTitle>{item.title}</NotificationTitle>
            <NotificationDesc>{item.description}</NotificationDesc>
          </NotificationLabel>
          <Switch
            checked={preferences[item.key]}
            onChange={(checked) => handleToggle(item.key, checked)}
          />
        </NotificationRow>
      ))}
    </TabCard>
  );
};

/* ── main component ── */

export const SettingsPage = () => {
  const user = useAuthStore((s) => s.user);

  const tabItems = [
    {
      key: 'profile',
      label: (
        <span>
          <UserOutlined style={{ marginRight: spacing[2] }} />
          个人信息
        </span>
      ),
      children: user ? <ProfileTab /> : null,
    },
    {
      key: 'password',
      label: (
        <span>
          <LockOutlined style={{ marginRight: spacing[2] }} />
          修改密码
        </span>
      ),
      children: <PasswordTab />,
    },
    {
      key: 'notifications',
      label: (
        <span>
          <BellOutlined style={{ marginRight: spacing[2] }} />
          通知偏好
        </span>
      ),
      children: <NotificationPreferencesTab />,
    },
    {
      key: 'bridges',
      label: (
        <span>
          <ApiOutlined style={{ marginRight: spacing[2] }} />
          Bridge 管理
        </span>
      ),
      children: <BridgeManager />,
    },
  ];

  /* ── loading skeleton (user not yet loaded) ── */
  if (!user) {
    return (
      <div>
        <PageHeader title="设置" />
        <StyledSkeleton>
          <Skeleton.Input active block style={{ height: 40 }} />
          <Skeleton active paragraph={{ rows: 5 }} title={false} />
        </StyledSkeleton>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="设置" />
      <Tabs
        defaultActiveKey="profile"
        items={tabItems}
        tabBarStyle={{
          marginBottom: spacing[6],
          color: colors.text.secondary,
        }}
      />
    </div>
  );
};

export default SettingsPage;
