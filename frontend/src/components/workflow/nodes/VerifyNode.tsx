import { memo } from 'react';
import { CheckCircleOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const VerifyNode = memo(function VerifyNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="verify"
      icon={<CheckCircleOutlined />}
      description="自动化约束验证"
    />
  );
});
