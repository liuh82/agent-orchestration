import styled, { keyframes } from 'styled-components';
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

/* ── Keyframe Animations ── */

export const pulseAnimation = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  50% { box-shadow: 0 0 0 6px rgba(59,130,246,0.25); }
`;

export const shakeAnimation = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-2px); }
  40% { transform: translateX(2px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(1px); }
`;

/* ── Shared Styled Components (n8n style) ── */

export const NodeWrapper = styled.div<{
  $color: string;
  $selected?: boolean;
  $disabled?: boolean;
  $isTrigger?: boolean;
}>`
  min-width: 200px;
  background: ${NODE_BG};
  border-radius: 10px;
  border: 1px solid ${({ $selected }) =>
    $selected ? NODE_BORDER_SELECTED : NODE_BORDER};
  border-left: 4px solid ${({ $color, $selected }) => $selected ? NODE_BORDER_SELECTED : $color};
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  border-style: ${({ $disabled }) => ($disabled ? 'dashed' : 'solid')};
  transition: border-color 0.15s, box-shadow 0.15s;

  ${({ $selected }) =>
    $selected &&
    `
    border-color: ${NODE_BORDER_SELECTED};
    box-shadow: 0 0 0 3px rgba(59,130,246,0.2), 0 2px 8px rgba(0,0,0,0.08);
  `}

  &:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    ${({ $selected }) =>
      !$selected &&
      `box-shadow: 0 4px 12px rgba(0,0,0,0.12);`}
  }
`;

/* ── Node Header (n8n style colored top bar) ── */

export const NodeHeader = styled.div<{ $color?: string }>`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  height: 28px;
  padding: 0 ${spacing[3]};
  background: ${({ $color }) => `${$color || '#64748b'}20`};
  border-bottom: 1px solid ${NODE_BORDER};
  flex-shrink: 0;
`;

export const NodeIconWrapper = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: ${radius.sm};
  color: ${({ $color }) => $color};
  font-size: 12px;
  flex-shrink: 0;
`;

export const NodeLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.semibold};
  color: ${NODE_TEXT};
`;

export const NodeDesc = styled.div`
  font-size: 11px;
  color: ${NODE_TEXT_SECONDARY};
  font-family: ${typography.fontFamily.mono};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
  padding: ${spacing[1]} ${spacing[3]} ${spacing[2]} ${spacing[3]};
`;

/* ── Node Status Badge ── */

export const NodeBadge = styled.div<{ $status?: 'success' | 'failed' }>`
  position: absolute;
  top: -6px;
  left: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${({ $status }) => ($status === 'success' ? '#22c55e' : '#ef4444')};
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  z-index: 10;
  ${({ $status }) =>
    $status === 'failed' &&
    `animation: ${shakeAnimation} 0.4s ease-in-out;`}
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
