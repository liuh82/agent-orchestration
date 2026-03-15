import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { UserOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { HumanNodeData } from '@/types/workflow';

export const HumanNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as HumanNodeData;
  const desc = d.description || '等待人工审批';
  return <BaseNode data={d} color="#f97316" icon={<UserOutlined />} description={desc} selected={selected} />;
});
HumanNode.displayName = 'HumanNode';
