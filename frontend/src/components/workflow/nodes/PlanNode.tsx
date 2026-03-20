import { memo } from 'react';
import { FileTextOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const PlanNode = memo(function PlanNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="plan"
      icon={<FileTextOutlined />}
      description="约束 → 执行计划"
    />
  );
});
