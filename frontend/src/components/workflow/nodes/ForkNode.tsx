import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BranchesOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const ForkNode = memo(function ForkNode({
  data,
  selected,
  type,
}: NodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<BranchesOutlined />}
    />
  );
});
