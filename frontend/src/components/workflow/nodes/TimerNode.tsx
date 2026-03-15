import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ClockCircleOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { TimerNodeData } from '@/types/workflow';

export const TimerNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as TimerNodeData;
  const desc = d.cronExpression || d.interval ? `cron: ${d.cronExpression || d.interval}` : '定时触发';
  return <BaseNode data={d} color="#ec4899" icon={<ClockCircleOutlined />} description={desc} selected={selected} />;
});
TimerNode.displayName = 'TimerNode';
