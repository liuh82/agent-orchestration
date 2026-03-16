import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { SendOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { OutputNodeData } from '@/types/workflow';

export const OutputNode = memo(function OutputNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as OutputNodeData;
  const description = d.format || undefined;

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<SendOutlined />}
      description={description}
    />
  );
});
