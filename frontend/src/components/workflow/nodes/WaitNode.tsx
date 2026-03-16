import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { HourglassOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { WaitNodeData } from '@/types/workflow';

export const WaitNode = memo(function WaitNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as WaitNodeData;
  const description =
    d.waitType === 'duration' && d.duration != null
      ? `${d.duration}s`
      : 'webhook';

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<HourglassOutlined />}
      description={description}
    />
  );
});
