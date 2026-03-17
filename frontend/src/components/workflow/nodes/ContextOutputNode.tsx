import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { FileTextOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const ContextOutputNode = memo(function ContextOutputNode({
  data,
  selected,
  type,
}: NodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<FileTextOutlined />}
    />
  );
});
