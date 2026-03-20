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
  const conditions = d.conditions ?? (d.condition ? [d.condition] : []);
  const logic = d.logic ?? 'and';
  const description =
    conditions.length > 0
      ? `${conditions.length} condition${conditions.length > 1 ? 's' : ''} (${logic})`
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
