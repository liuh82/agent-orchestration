import { memo } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { CustomEdgeData } from '@/types/workflow';

const CASE_PALETTE = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981'];

function getConditionalColor(sourceHandle?: string | null): string {
  if (!sourceHandle) return '#94a3b8';
  if (sourceHandle === 'true') return '#10b981';
  if (sourceHandle === 'false' || sourceHandle === 'default') return '#ef4444';
  // case_N pattern
  const match = sourceHandle.match(/^case_(\d+)$/);
  if (match) {
    const idx = parseInt(match[1], 10);
    return CASE_PALETTE[idx % CASE_PALETTE.length];
  }
  return '#94a3b8';
}

function getConditionalLabel(sourceHandle?: string | null, edgeLabel?: string): string | undefined {
  if (edgeLabel) return edgeLabel;
  if (!sourceHandle) return undefined;
  if (sourceHandle === 'true' || sourceHandle === 'false') return sourceHandle;
  if (sourceHandle === 'default') return 'default';
  const match = sourceHandle.match(/^case_(\d+)$/);
  if (match) return `case ${match[1]}`;
  return undefined;
}

export const ConditionalEdge = memo(function ConditionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label: edgeLabel,
  data,
  style,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as CustomEdgeData | undefined;
  const color = edgeData?.color ?? getConditionalColor(edgeData?.sourceHandle);
  const labelText = getConditionalLabel(edgeData?.sourceHandle, edgeData?.label ?? (edgeLabel as string | undefined));

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      {/* Animated background for flow effect */}
      <BaseEdge
        id={`${id}-bg`}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: '8 4',
          strokeDashoffset: 0,
          opacity: 0.3,
        }}
      />
      {/* Main edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: '8 4',
          animation: 'conditionalFlow 1s linear infinite',
        }}
        markerEnd={markerEnd}
      />
      {/* Label */}
      {labelText && (
        <g>
          <rect
            x={labelX - 20}
            y={labelY - 10}
            width={40}
            height={20}
            rx={4}
            fill="#fff"
            stroke={color}
            strokeWidth={1}
          />
          <text
            x={labelX}
            y={labelY + 4}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill={color}
            fontFamily="system-ui, sans-serif"
          >
            {labelText}
          </text>
        </g>
      )}
      <style>{`
        @keyframes conditionalFlow {
          from { stroke-dashoffset: 12; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </>
  );
});
