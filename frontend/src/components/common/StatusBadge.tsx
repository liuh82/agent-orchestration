import styled from 'styled-components';
import { radius } from '@/styles/tokens/radius';
import { typography } from '@/styles/tokens/typography';

const statusColors = {
  running:   { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', dot: '#6366f1' },
  completed: { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', dot: '#22c55e' },
  failed:    { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', dot: '#ef4444' },
  pending:   { bg: 'rgba(163,163,163,0.12)', text: '#a3a3a3', dot: '#737373' },
  cancelled: { bg: 'rgba(163,163,163,0.08)', text: '#737373', dot: '#525252' },
  online:    { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', dot: '#22c55e' },
  offline:   { bg: 'rgba(163,163,163,0.12)', text: '#a3a3a3', dot: '#737373' },
  error:     { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', dot: '#ef4444' },
  busy:      { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', dot: '#6366f1' },
  active:    { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', dot: '#22c55e' },
  archived:  { bg: 'rgba(163,163,163,0.08)', text: '#737373', dot: '#525252' },
  draft:     { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', dot: '#f59e0b' },
} as const;

type Status = keyof typeof statusColors;

const StyledBadge = styled.span<{ $status: Status }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: ${radius.sm};
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.medium};
  background: ${({ $status }) => statusColors[$status].bg};
  color: ${({ $status }) => statusColors[$status].text};
  text-transform: capitalize;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $status }) => statusColors[$status].dot};
    flex-shrink: 0;

    ${({ $status }) => ($status === 'running' || $status === 'busy') && `
      animation: pulse 2s ease-in-out infinite;
    `}
  }
`;

interface StatusBadgeProps {
  status: Status;
  label?: string;
}

export const StatusBadge = ({ status, label }: StatusBadgeProps) => (
  <StyledBadge $status={status}>{label ?? status}</StyledBadge>
);
