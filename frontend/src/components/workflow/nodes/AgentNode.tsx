import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { RobotOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { AgentNodeData } from '@/types/workflow';

export const AgentNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as AgentNodeData;
  const desc = [d.agentName, d.model].filter(Boolean).join(' · ') || undefined;
  return <BaseNode data={d} color="#3b82f6" icon={<RobotOutlined />} description={desc} selected={selected} />;
});
AgentNode.displayName = 'AgentNode';
