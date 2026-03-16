import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ApiOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { WebhookTriggerNodeData } from '@/types/workflow';

export const WebhookTriggerNode = memo(function WebhookTriggerNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as WebhookTriggerNodeData;
  const description = d.path ? `${d.method} ${d.path}` : undefined;

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<ApiOutlined />}
      description={description}
    />
  );
});
