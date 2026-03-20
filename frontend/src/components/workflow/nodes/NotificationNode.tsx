import { memo } from 'react';
import { BellOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const NotificationNode = memo(function NotificationNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="notification"
      icon={<BellOutlined />}
      description="多渠道通知"
    />
  );
});
