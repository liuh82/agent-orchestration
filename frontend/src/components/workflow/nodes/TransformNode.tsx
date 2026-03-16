import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { SwapOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { TransformNodeData } from '@/types/workflow';

export const TransformNode = memo(function TransformNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as TransformNodeData;
  const description = `${d.mappings.length} mappings`;

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<SwapOutlined />}
      description={description}
    />
  );
});
