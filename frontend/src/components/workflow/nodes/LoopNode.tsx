import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { ReloadOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';
import type { LoopNodeData } from '@/types/workflow';

export const LoopNode = memo(function LoopNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as LoopNodeData;
  const description =
    d.loopType === 'count' && d.count != null
      ? `${d.count} times`
      : 'iterate';

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<ReloadOutlined />}
      description={description}
    />
  );
});
