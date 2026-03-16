import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ClockCircleOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { CronTriggerNodeData } from '@/types/workflow';

export const CronTriggerNode = memo(function CronTriggerNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as CronTriggerNodeData;
  const description = d.cronExpression || undefined;

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<ClockCircleOutlined />}
      description={description}
    />
  );
});
