import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { CodeOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { CodeNodeData } from '@/types/workflow';

export const CodeNode = memo(function CodeNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as CodeNodeData;
  const description = d.language || undefined;

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<CodeOutlined />}
      description={description}
    />
  );
});
