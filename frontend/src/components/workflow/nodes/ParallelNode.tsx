import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ApartmentOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { ParallelNodeData } from '@/types/workflow';

export const ParallelNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as ParallelNodeData;
  const desc = d.branches ? `${d.branches} 个分支` : '并行执行';
  return <BaseNode data={d} color="#8b5cf6" icon={<ApartmentOutlined />} description={desc} selected={selected} />;
});
ParallelNode.displayName = 'ParallelNode';
