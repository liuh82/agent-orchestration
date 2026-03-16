import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { BranchesOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { IfNodeData } from '@/types/workflow';

export const IfNode = memo(function IfNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as IfNodeData;
  const description =
    d.conditions.length > 0
      ? `${d.conditions.length} condition${d.conditions.length > 1 ? 's' : ''} (${d.logic})`
      : 'no conditions';

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<BranchesOutlined />}
      description={description}
    />
  );
});
