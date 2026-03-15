import { useState, useEffect } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Tag,
  Tooltip,
  Popconfirm,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  BellOutlined,
  DingtalkOutlined,
  WechatOutlined,
  SlackOutlined,
  MailOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { shadow } from '@/styles/tokens/shadow';
import { animation } from '@/styles/tokens/animation';
import { notificationApi } from '@/api/notifications';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';

/* ── types ── */

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: string;
  config: Record<string, unknown>;
  triggers: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ChannelFormData {
  channel_type: string;
  name: string;
  webhook_url?: string;
  secret?: string;
  email?: string;
  triggers?: string[];
}

/* ── constants ── */

const CHANNEL_TYPE_OPTIONS = [
  { label: '飞书', value: 'feishu' },
  { label: '钉钉', value: 'dingtalk' },
  { label: '企业微信', value: 'wechat_work' },
  { label: 'Slack', value: 'slack' },
  { label: 'Discord', value: 'discord' },
  { label: '邮件', value: 'email' },
];

const getChannelIcon = (channelType: string): React.ReactNode => {
  switch (channelType) {
    case 'feishu':
      return <BellOutlined />;
    case 'dingtalk':
      return <DingtalkOutlined />;
    case 'wechat_work':
      return <WechatOutlined />;
    case 'slack':
      return <SlackOutlined />;
    case 'email':
      return <MailOutlined />;
    default:
      return <ApiOutlined />;
  }
};

const CHANNEL_TYPE_LABEL_MAP: Record<string, string> = {
  feishu: '飞书',
  dingtalk: '钉钉',
  wechat_work: '企业微信',
  slack: 'Slack',
  discord: 'Discord',
  email: '邮件',
};

const CHANNEL_TYPE_TAG_COLOR_MAP: Record<string, string> = {
  feishu: '#3370ff',
  dingtalk: '#0089ff',
  wechat_work: '#07c160',
  slack: '#e01e5a',
  discord: '#5865f2',
  email: colors.primary[500],
};

const TRIGGER_OPTIONS = [
  { label: '任务完成', value: 'task_completed' },
  { label: '任务失败', value: 'task_failed' },
  { label: 'Agent 离线', value: 'agent_offline' },
  { label: '系统告警', value: 'system_alert' },
];

/* ── styled components ── */

const ChannelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${spacing[6]};

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const ChannelCardWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
  transition: border-color ${animation.duration.normal} ${animation.easing.default},
    box-shadow ${animation.duration.normal} ${animation.easing.default};

  &:hover {
    border-color: ${colors.border.hover};
    box-shadow: ${shadow.sm};
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${spacing[4]};
`;

const CardTitleArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
`;

const ChannelIconWrapper = styled.div<{ $color: string }>`
  width: 36px;
  height: 36px;
  border-radius: ${radius.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $color }) => $color};
  color: ${colors.text.primary};
  font-size: ${typography.fontSize.xl};
  flex-shrink: 0;
`;

const ChannelName = styled.div`
  font-size: ${typography.fontSize.lg};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[3]};
  margin-bottom: ${spacing[5]};
`;

const ConfigPreview = styled.div`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
  background: ${colors.neutral[900]};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.md};
  padding: ${spacing[2]} ${spacing[3]};
  font-family: ${typography.fontFamily.mono};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TriggerList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[1]};
`;

const CardFooter = styled.div`
  display: flex;
  gap: ${spacing[2]};
  justify-content: flex-end;
  padding-top: ${spacing[4]};
  border-top: 1px solid ${colors.border.DEFAULT};
`;

const SkeletonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${spacing[6]};

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const SkeletonCard = styled(Skeleton)`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

const ModalFormWrapper = styled.div`
  .ant-form-item {
    margin-bottom: ${spacing[5]};
  }
`;

/* ── helpers ── */

const getStatusColor = (isActive: boolean) =>
  isActive ? colors.success[500] : colors.neutral[500];

const truncateUrl = (url: string, maxLen = 40): string =>
  url.length > maxLen ? `${url.slice(0, maxLen)}...` : url;

/* ── channel card sub-component ── */

const ChannelCard = ({ channel }: { channel: NotificationChannel }) => {
  const queryClient = useQueryClient();

  const testMutation = useMutation(
    () => notificationApi.test(channel.id),
    {
      onSuccess: () => {
        void message.success(`通道「${channel.name}」测试消息发送成功`);
      },
      onError: () => {
        void message.error('测试消息发送失败，请检查配置');
      },
    },
  );

  const deleteMutation = useMutation(
    () => notificationApi.delete(channel.id),
    {
      onSuccess: () => {
        void message.success('通道已删除');
        queryClient.invalidateQueries(['admin-notifications']);
      },
      onError: () => {
        void message.error('删除失败');
      },
    },
  );

  const iconColor = 'rgba(255,255,255,0.08)';

  return (
    <ChannelCardWrapper>
      <CardHeader>
        <CardTitleArea>
          <ChannelIconWrapper $color={iconColor}>
            {getChannelIcon(channel.channel_type)}
          </ChannelIconWrapper>
          <div>
            <ChannelName>{channel.name}</ChannelName>
            <div style={{ marginTop: spacing[1] }}>
              <Tag
                color={CHANNEL_TYPE_TAG_COLOR_MAP[channel.channel_type] ?? colors.neutral[500]}
                style={{ marginRight: 0, fontSize: typography.fontSize.xs }}
              >
                {CHANNEL_TYPE_LABEL_MAP[channel.channel_type] ?? channel.channel_type}
              </Tag>
            </div>
          </div>
        </CardTitleArea>
        <Tag
          color={getStatusColor(channel.is_active)}
          style={{ fontSize: typography.fontSize.xs }}
        >
          {channel.is_active ? '已启用' : '已禁用'}
        </Tag>
      </CardHeader>

      <CardBody>
        {channel.config?.webhook_url != null && (
          <ConfigPreview>
            {truncateUrl(String(channel.config.webhook_url))}
          </ConfigPreview>
        )}

        {channel.config?.email != null && (
          <ConfigPreview>
            {String(channel.config.email)}
          </ConfigPreview>
        )}

        {channel.triggers && channel.triggers.length > 0 && (
          <div>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.text.secondary,
                marginBottom: spacing[1],
              }}
            >
              触发条件
            </div>
            <TriggerList>
              {channel.triggers.map((trigger: string) => (
                <Tag key={trigger} style={{ margin: 0 }}>
                  {TRIGGER_OPTIONS.find((o) => o.value === trigger)?.label ?? trigger}
                </Tag>
              ))}
            </TriggerList>
          </div>
        )}
      </CardBody>

      <CardFooter>
        <Tooltip title="编辑">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              const event = new CustomEvent('admin-edit-channel', {
                detail: channel,
              });
              window.dispatchEvent(event);
            }}
          >
            编辑
          </Button>
        </Tooltip>

        <Button
          type="text"
          size="small"
          icon={<SendOutlined />}
          loading={testMutation.isLoading}
          onClick={() => testMutation.mutate()}
        >
          测试
        </Button>

        <Popconfirm
          title="确认删除"
          description={`确定要删除全局通道「${channel.name}」吗？`}
          onConfirm={() => deleteMutation.mutate()}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </CardFooter>
    </ChannelCardWrapper>
  );
};

/* ── create / edit modal ── */

const ChannelModal = ({
  open,
  editingChannel,
  onClose,
}: {
  open: boolean;
  editingChannel: NotificationChannel | null;
  onClose: () => void;
}) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const isEditing = !!editingChannel;
  const channelType = Form.useWatch('channel_type', form);

  const createMutation = useMutation(
    (data: ChannelFormData) =>
      notificationApi.create({
        channel_type: data.channel_type,
        name: data.name,
        config: {
          webhook_url: data.webhook_url,
          secret: data.secret,
          email: data.email,
        },
        triggers: data.triggers,
      }),
    {
      onSuccess: () => {
        void message.success('全局通道创建成功');
        queryClient.invalidateQueries(['admin-notifications']);
        handleClose();
      },
      onError: () => {
        void message.error('创建失败，请重试');
      },
    },
  );

  const updateMutation = useMutation(
    (data: ChannelFormData) =>
      notificationApi.update(editingChannel!.id, {
        channel_type: data.channel_type,
        name: data.name,
        config: {
          webhook_url: data.webhook_url,
          secret: data.secret,
          email: data.email,
        },
        triggers: data.triggers,
      }),
    {
      onSuccess: () => {
        void message.success('全局通道已更新');
        queryClient.invalidateQueries(['admin-notifications']);
        handleClose();
      },
      onError: () => {
        void message.error('更新失败，请重试');
      },
    },
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (isEditing) {
        updateMutation.mutate(values);
      } else {
        createMutation.mutate(values);
      }
    } catch {
      // form validation failed
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const showWebhook = channelType !== 'email';
  const showSecret = channelType === 'feishu' || channelType === 'dingtalk';
  const showEmail = channelType === 'email';

  return (
    <Modal
      title={isEditing ? '编辑全局通知通道' : '创建全局通知通道'}
      open={open}
      onOk={handleSubmit}
      onCancel={handleClose}
      okText={isEditing ? '保存' : '创建'}
      cancelText="取消"
      confirmLoading={createMutation.isLoading || updateMutation.isLoading}
      destroyOnClose
    >
      <ModalFormWrapper>
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          initialValues={
            editingChannel
              ? {
                  channel_type: editingChannel.channel_type,
                  name: editingChannel.name,
                  webhook_url: (editingChannel.config?.webhook_url as string) ?? '',
                  secret: (editingChannel.config?.secret as string) ?? '',
                  email: (editingChannel.config?.email as string) ?? '',
                  triggers: editingChannel.triggers ?? [],
                }
              : { channel_type: 'feishu', triggers: ['task_completed'] }
          }
        >
          <Form.Item
            label="通道类型"
            name="channel_type"
            rules={[{ required: true, message: '请选择通道类型' }]}
          >
            <Select options={CHANNEL_TYPE_OPTIONS} disabled={isEditing} />
          </Form.Item>

          <Form.Item
            label="通道名称"
            name="name"
            rules={[{ required: true, message: '请输入通道名称' }]}
          >
            <Input placeholder="例如：全局飞书告警群" />
          </Form.Item>

          {showWebhook && (
            <Form.Item
              label="Webhook URL"
              name="webhook_url"
              rules={[{ required: true, message: '请输入 Webhook URL' }]}
            >
              <Input placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
            </Form.Item>
          )}

          {showSecret && (
            <Form.Item label="签名密钥 (Secret)" name="secret">
              <Input.Password placeholder="可选，用于签名验证" />
            </Form.Item>
          )}

          {showEmail && (
            <Form.Item
              label="邮箱地址"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input placeholder="alert@company.com" />
            </Form.Item>
          )}

          <Form.Item label="触发条件" name="triggers">
            <Select
              mode="multiple"
              options={TRIGGER_OPTIONS}
              placeholder="选择触发通知的事件"
            />
          </Form.Item>
        </Form>
      </ModalFormWrapper>
    </Modal>
  );
};

/* ── main component ── */

export const AdminNotificationPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<any, Error>(
    ['admin-notifications'],
    () => notificationApi.listGlobal(),
  );

  const channels: NotificationChannel[] = response?.data?.items ?? response?.data ?? [];

  const handleOpenCreate = () => {
    setEditingChannel(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingChannel(null);
  };

  // Subscribe to custom edit events from child ChannelCard components
  useEffect(() => {
    const editEventListener = (e: Event) => {
      const detail = (e as CustomEvent<NotificationChannel>).detail;
      if (detail) {
        setEditingChannel(detail);
        setModalOpen(true);
      }
    };

    window.addEventListener('admin-edit-channel', editEventListener);
    return () => {
      window.removeEventListener('admin-edit-channel', editEventListener);
    };
  }, []);

  /* ── error state ── */
  if (isError) {
    return (
      <div>
        <PageHeader title="全局通知通道" />
        <ErrorBlock
          message={error?.message || '加载全局通知通道失败'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ── loading state ── */
  if (isLoading) {
    return (
      <div>
        <PageHeader title="全局通知通道" />
        <SkeletonGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} active paragraph={{ rows: 5 }} title={false} />
          ))}
        </SkeletonGrid>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="全局通知通道"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            创建全局通道
          </Button>
        }
      />

      {channels.length === 0 ? (
        <EmptyState
          description="还没有全局通知通道，点击创建开始配置"
          action={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              创建全局通道
            </Button>
          }
        />
      ) : (
        <ChannelGrid>
          {channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </ChannelGrid>
      )}

      <ChannelModal
        open={modalOpen}
        editingChannel={editingChannel}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default AdminNotificationPage;
