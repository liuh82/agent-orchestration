import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { FolderOpenOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const InputNode = memo(function InputNode({
  data,
  selected,
  type,
}: NodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<FolderOpenOutlined />}
    />
  );
});
