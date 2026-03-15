import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BranchesOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import type { ConditionNodeData } from '@/types/workflow';

const Wrapper = styled.div<{ $selected?: boolean }>`
  min-width: 180px;
  min-height: 80px;
  background: ${colors.surface.DEFAULT};
  border: 2px solid #f59e0b;
  border-radius: ${radius.lg};
  box-shadow: ${({ $selected }) => $selected ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.06)'};
  padding: ${spacing[3]} ${spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${spacing[1]};
`;

const Label = styled.div`
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.semibold};
  color: #f59e0b;
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
`;

const Desc = styled.div`
  font-size: 12px;
  color: ${colors.text.secondary};
  font-family: ${typography.fontFamily.mono};
`;

export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const d = data as ConditionNodeData;
  return (
    <Wrapper $selected={selected}>
      <Handle type="target" position={Position.Top} style={{ background: '#f59e0b', width: 8, height: 8, border: '2px solid white' }} />
      <Label><BranchesOutlined />{d.label || '条件判断'}</Label>
      {d.expression && <Desc>{d.expression}</Desc>}
      <Handle type="source" position={Position.Bottom} id="true" style={{ background: '#22c55e', width: 8, height: 8, border: '2px solid white', left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ background: '#ef4444', width: 8, height: 8, border: '2px solid white', left: '75%' }} />
    </Wrapper>
  );
});
ConditionNode.displayName = 'ConditionNode';
