import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ApartmentOutlined } from '@ant-design/icons';
import { BaseNode, type ExtraOutput } from './BaseNode';
import type { SwitchNodeData } from '@/types/workflow';

export const SwitchNode = memo(function SwitchNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as SwitchNodeData;

  // Build dynamic case_N outputs based on data.cases
  // The 'default' output is already defined in NODE_META, so don't duplicate
  const extraOutputs: ExtraOutput[] =
    d.cases?.map((c, i) => ({
      id: `case_${i}`,
      type: 'source' as const,
      label: c.label,
      color: '#3b82f6',
    })) ?? [];

  const description =
    d.cases.length > 0 ? `${d.cases.length} branches` : 'no branches';

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<ApartmentOutlined />}
      description={description}
      extraOutputs={extraOutputs}
    />
  );
});
