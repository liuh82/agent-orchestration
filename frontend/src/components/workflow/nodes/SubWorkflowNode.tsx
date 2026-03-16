import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ForkOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { SubWorkflowNodeData } from '@/types/workflow';

export const SubWorkflowNode = memo(function SubWorkflowNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as SubWorkflowNodeData;
  const description = d.workflowName || d.workflowId || undefined;

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<ForkOutlined />}
      description={description}
    />
  );
});
