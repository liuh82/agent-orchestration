import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import type { WorkflowNodeData } from '@/types/workflow';

const NodeWrapper = styled.div<{ $color: string; $selected?: boolean }>`
  min-width: 180px;
  min-height: 80px;
  background: ${colors.surface.DEFAULT};
  border: 2px solid ${({ $color }) => $color};
  border-radius: ${radius.lg};
  box-shadow: ${({ $selected }) => $selected ? `0 0 0 2px ${colors.primary[500]}, 0 4px 12px rgba(0,0,0,0.1)` : '0 2px 8px rgba(0,0,0,0.06)'};
  padding: ${spacing[3]} ${spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${spacing[1]};
`;

const NodeLabel = styled.div<{ $color: string }>`
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.semibold};
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
`;

const NodeDesc = styled.div`
  font-size: 12px;
  color: ${colors.text.secondary};
  line-height: 1.4;
`;

interface BaseNodeProps {
  data: WorkflowNodeData;
  color: string;
  icon: React.ReactNode;
  description?: string;
  selected?: boolean;
}

export const BaseNode = memo(({ data, color, icon, description, selected }: BaseNodeProps) => (
  <NodeWrapper $color={color} $selected={selected}>
    <Handle type="target" position={Position.Top} style={{ background: color, width: 8, height: 8, border: '2px solid white' }} />
    <NodeLabel $color={color}>
      {icon}
      {data.label || '未命名'}
    </NodeLabel>
    {description && <NodeDesc>{description}</NodeDesc>}
    <Handle type="source" position={Position.Bottom} style={{ background: color, width: 8, height: 8, border: '2px solid white' }} />
  </NodeWrapper>
));

BaseNode.displayName = 'BaseNode';
