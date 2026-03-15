import { Button, Tooltip, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useMutation } from 'react-query';
import { notificationApi } from '@/api/notifications';

interface TestSendButtonProps {
  channelId: string;
  channelName?: string;
}

export const TestSendButton = ({ channelId, channelName }: TestSendButtonProps) => {
  const testMutation = useMutation(
    () => notificationApi.test(channelId),
    {
      onSuccess: () => {
        void message.success(channelName ? `通道「${channelName}」测试消息发送成功` : '测试消息发送成功');
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || '测试消息发送失败，请检查配置';
        void message.error(msg);
      },
    },
  );

  return (
    <Tooltip title="发送测试消息">
      <Button
        type="text"
        size="small"
        icon={<SendOutlined />}
        loading={testMutation.isLoading}
        onClick={() => testMutation.mutate()}
      >
        测试
      </Button>
    </Tooltip>
  );
};
