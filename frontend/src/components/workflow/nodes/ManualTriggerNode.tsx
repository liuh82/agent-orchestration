import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { PlayCircleOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const ManualTriggerNode = memo(function ManualTriggerNode({
  data,
  selected,
  type,
}: NodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<PlayCircleOutlined />}
    />
  );
});
