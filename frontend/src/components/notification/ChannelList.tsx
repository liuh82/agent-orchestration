import { Button, Skeleton, Switch, Tag, Tooltip, Popconfirm, message } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  BellOutlined,
  DingtalkOutlined,
  WechatOutlined,
  SlackOutlined,
  MailOutlined,
  ApiOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { shadow } from '@/styles/tokens/shadow';
import { animation } from '@/styles/tokens/animation';
import { notificationApi } from '@/api/notifications';
import { TestSendButton } from './TestSendButton';
import { CHANNEL_TYPE_LABEL_MAP, CHANNEL_TYPE_TAG_COLOR_MAP, TRIGGER_OPTIONS, type NotificationChannel } from './types';

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
  transition:
    border-color ${animation.duration.normal} ${animation.easing.default},
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

const ChannelIconWrapper = styled.div`
  width: 36px;
  height: 36px;
  border-radius: ${radius.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${colors.surface.raised};
  color: ${colors.text.secondary};
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
  background: ${colors.surface.raised};
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

const TriggerLabel = styled.div`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.muted};
  margin-bottom: ${spacing[1]};
`;

const CardFooter = styled.div`
  display: flex;
  gap: ${spacing[2]};
  justify-content: flex-end;
  align-items: center;
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

const getChannelIcon = (channelType: string): React.ReactNode => {
  switch (channelType) {
    case 'feishu':
      return <BellOutlined />;
    case 'dingtalk':
      return <DingtalkOutlined />;
    case 'wecom':
    case 'wechat_work':
      return <WechatOutlined />;
    case 'slack':
      return <SlackOutlined />;
    case 'email':
      return <MailOutlined />;
    case 'in_app':
      return <NotificationOutlined />;
    default:
      return <ApiOutlined />;
  }
};

const truncateUrl = (url: string, maxLen = 40): string =>
  url.length > maxLen ? `${url.slice(0, maxLen)}...` : url;

const getTriggerLabel = (value: string): string =>
  TRIGGER_OPTIONS.find((o) => o.value === value)?.label ?? value;

const getConfigPreview = (config: Record<string, unknown>): string => {
  if (config.webhook_url) return truncateUrl(String(config.webhook_url));
  if (config.group_webhook_url) return truncateUrl(String(config.group_webhook_url));
  if (config.group_webhook) return truncateUrl(String(config.group_webhook));
  if (config.url) return truncateUrl(String(config.url));
  if (config.app_id) return `App: ${String(config.app_id)}`;
  if (config.corp_id) return `Corp: ${String(config.corp_id)}`;
  if (config.smtp_host) {
    const port = config.smtp_port ? `:${config.smtp_port}` : '';
    return `${String(config.smtp_host)}${port} → ${String(config.from_email ?? '')}`;
  }
  if (Object.keys(config).length === 0) return '无需额外配置';
  return JSON.stringify(config);
};

interface ChannelListProps {
  channels: NotificationChannel[];
  queryKey: string[];
  onEdit: (channel: NotificationChannel) => void;
  loading?: boolean;
  isAdmin?: boolean;
}

export const ChannelList = ({ channels, queryKey, onEdit, loading, isAdmin }: ChannelListProps) => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    (id: string) => isAdmin ? notificationApi.deleteGlobal(id) : notificationApi.delete(id),
    {
      onSuccess: () => {
        void message.success('通道已删除');
        queryClient.invalidateQueries(queryKey);
      },
      onError: () => {
        void message.error('删除失败');
      },
    },
  );

  const toggleMutation = useMutation(
    ({ id, is_active }: { id: string; is_active: boolean }) =>
      isAdmin ? notificationApi.updateGlobal(id, { is_active }) : notificationApi.update(id, { is_active }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKey);
      },
      onError: () => {
        void message.error('切换状态失败');
      },
    },
  );

  if (loading) {
    return (
      <SkeletonGrid>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} active paragraph={{ rows: 5 }} title={false} />
        ))}
      </SkeletonGrid>
    );
  }

  if (channels.length === 0) return null;

  return (
    <ChannelGrid>
      {channels.map((channel) => (
        <ChannelCardWrapper key={channel.id}>
          <CardHeader>
            <CardTitleArea>
              <ChannelIconWrapper>
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
            <Switch
              size="small"
              checked={channel.is_active}
              onChange={(checked) =>
                toggleMutation.mutate({ id: channel.id, is_active: checked })
              }
            />
          </CardHeader>

          <CardBody>
            <ConfigPreview>{getConfigPreview(channel.config)}</ConfigPreview>

            {channel.triggers && channel.triggers.length > 0 && (
              <div>
                <TriggerLabel>触发条件</TriggerLabel>
                <TriggerList>
                  {channel.triggers.map((trigger: string) => (
                    <Tag key={trigger} style={{ margin: 0 }}>
                      {getTriggerLabel(trigger)}
                    </Tag>
                  ))}
                </TriggerList>
              </div>
            )}
          </CardBody>

          <CardFooter>
            <Tooltip title="编辑通道配置">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(channel)}
              >
                编辑
              </Button>
            </Tooltip>

            <TestSendButton channelId={channel.id} channelName={channel.name} isAdmin={isAdmin} />

            <Popconfirm
              title="确认删除"
              description={`确定要删除通道「${channel.name}」吗？此操作不可撤销。`}
              onConfirm={() => deleteMutation.mutate(channel.id)}
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
      ))}
    </ChannelGrid>
  );
};
