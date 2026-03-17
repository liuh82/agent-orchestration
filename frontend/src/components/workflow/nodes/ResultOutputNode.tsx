import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { CheckCircleOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const ResultOutputNode = memo(function ResultOutputNode({
  data,
  selected,
  type,
}: NodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<CheckCircleOutlined />}
    />
  );
});
