import { memo } from 'react';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const ReviewNode = memo(function ReviewNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="review"
      icon={<SafetyCertificateOutlined />}
      description="双模型交叉审查"
    />
  );
});
