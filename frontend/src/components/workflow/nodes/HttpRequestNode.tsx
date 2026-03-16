import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { GlobalOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { HttpRequestNodeData } from '@/types/workflow';

export const HttpRequestNode = memo(function HttpRequestNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as HttpRequestNodeData;
  const description = `${d.method} ${d.url || '...'}`;

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<GlobalOutlined />}
      description={description}
    />
  );
});
