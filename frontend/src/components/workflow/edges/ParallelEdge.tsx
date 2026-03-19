import { memo } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { CustomEdgeData } from '@/types/workflow';

export const ParallelEdge = memo(function ParallelEdge({
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
  selected,
}: EdgeProps) {
  const isSelected = selected ?? false;
  const edgeData = data as CustomEdgeData | undefined;
  const color = edgeData?.color ?? '#3b82f6';
  const labelText = edgeData?.label ?? (edgeLabel as string | undefined);

  // Extract branch index from sourceHandle stored in data
  let branchLabel = labelText;
  if (!branchLabel && edgeData?.sourceHandle) {
    const match = edgeData.sourceHandle.match(/branch[_\s]?(\d+)/i);
    if (match) branchLabel = `Branch ${match[1]}`;
  }

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
      {/* Selection glow */}
      {isSelected && (
        <BaseEdge
          id={`${id}-selection`}
          path={edgePath}
          style={{ stroke: '#6366f1', strokeWidth: 5, opacity: 0.35, filter: 'blur(2px)' }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: isSelected ? 3.5 : 2.5,
          animation: 'parallelPulse 2s ease-in-out infinite',
        }}
        markerEnd={markerEnd}
      />
      {branchLabel && (
        <g>
          <rect
            x={labelX - 28}
            y={labelY - 10}
            width={56}
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
            {branchLabel}
          </text>
        </g>
      )}
      <style>{`
        @keyframes parallelPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
});
