import { memo } from 'react';
import { UserOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const HumanNode = memo(function HumanNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="human"
      icon={<UserOutlined />}
      description="人工审核"
    />
  );
});
