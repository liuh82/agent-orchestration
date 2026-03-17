import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ApartmentOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const JoinNode = memo(function JoinNode({
  data,
  selected,
  type,
}: NodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<ApartmentOutlined />}
    />
  );
});
