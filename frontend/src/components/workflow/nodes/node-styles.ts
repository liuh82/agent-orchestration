import styled from 'styled-components';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';

/* ── Canvas Light Theme Color Tokens ── */

export const NODE_BG = '#ffffff';
export const NODE_BORDER = '#e2e8f0';
export const NODE_BORDER_SELECTED = '#3b82f6';
export const NODE_TEXT = '#0f172a';
export const NODE_TEXT_SECONDARY = '#64748b';
export const NODE_TEXT_MUTED = '#94a3b8';

/* ── Shared Styled Components ── */

export const NodeWrapper = styled.div<{
  $color: string;
  $selected?: boolean;
  $disabled?: boolean;
  $isTrigger?: boolean;
}>`
  min-width: 180px;
  min-height: 60px;
  background: ${NODE_BG};
  border: 1px solid ${({ $selected }) =>
    $selected ? NODE_BORDER_SELECTED : NODE_BORDER};
  border-radius: 10px;
  border-left: 4px solid ${({ $color, $selected }) => $selected ? NODE_BORDER_SELECTED : $color};
  box-shadow: ${({ $selected }) =>
    $selected
      ? `0 0 0 2px ${NODE_BORDER_SELECTED}40, 0 2px 8px rgba(0,0,0,0.1)`
      : '0 1px 4px rgba(0,0,0,0.08)'};
  padding: ${spacing[2]} ${spacing[3]};
  display: flex;
  flex-direction: column;
  gap: ${spacing[1]};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  border-style: ${({ $disabled }) => ($disabled ? 'dashed' : 'solid')};
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }
`;

export const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.semibold};
  color: ${NODE_TEXT};
`;

export const NodeIconWrapper = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${radius.md};
  background: ${({ $color }) => `${$color}20`};
  color: ${({ $color }) => $color};
  font-size: 14px;
  flex-shrink: 0;
`;

export const NodeLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
`;

export const NodeDesc = styled.div`
  font-size: 11px;
  color: ${NODE_TEXT_SECONDARY};
  font-family: ${typography.fontFamily.mono};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
`;

export const HandleContainer = styled.div`
  display: flex;
  justify-content: center;
  position: relative;
  height: 1px;
  width: 100%;
  margin-top: 4px;
`;

export const HandleLabelTag = styled.span<{
  $color: string;
  $left: number;
}>`
  position: absolute;
  bottom: -16px;
  left: ${({ $left }) => $left}%;
  transform: translateX(-50%);
  font-size: 10px;
  color: ${({ $color }) => $color};
  background: ${NODE_BG};
  padding: 0 4px;
  white-space: nowrap;
  pointer-events: none;
`;

/* ── Handle Style Helpers ── */

export const sourceHandleStyle = (color: string) => ({
  background: color,
  width: 10,
  height: 10,
  border: '2px solid #e2e8f0' as const,
  top: -5,
});

export const targetHandleStyle = {
  background: '#94a3b8',
  width: 10,
  height: 10,
  border: '2px solid #e2e8f0' as const,
  bottom: -5,
};
