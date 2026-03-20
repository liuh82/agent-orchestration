import { memo } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const SpecNode = memo(function SpecNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="spec"
      icon={<SearchOutlined />}
      description="需求 → 约束集"
    />
  );
});
