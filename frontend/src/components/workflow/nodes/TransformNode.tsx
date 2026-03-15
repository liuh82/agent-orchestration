import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { SwapOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { TransformNodeData } from '@/types/workflow';

export const TransformNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as TransformNodeData;
  const desc = d.description || d.transformType || '数据转换';
  return <BaseNode data={d} color="#06b6d4" icon={<SwapOutlined />} description={desc} selected={selected} />;
});
TransformNode.displayName = 'TransformNode';
