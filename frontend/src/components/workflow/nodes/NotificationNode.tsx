import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BellOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { NotificationNodeData } from '@/types/workflow';

export const NotificationNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as NotificationNodeData;
  const desc = d.channelName || d.message || '发送通知';
  return <BaseNode data={d} color="#10b981" icon={<BellOutlined />} description={desc} selected={selected} />;
});
NotificationNode.displayName = 'NotificationNode';
