import { memo, useState } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { CustomEdgeData } from '@/types/workflow';

export const NormalEdge = memo(function NormalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  data,
  style,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const color = (data as CustomEdgeData | undefined)?.color ?? '#94a3b8';
  const activeColor = hovered ? '#64748b' : color;

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
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Wider invisible path for easier hover targeting */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={12}
        stroke="transparent"
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: activeColor,
          strokeWidth: 1.5,
          transition: 'stroke 0.15s ease',
          cursor: 'pointer',
        }}
        markerEnd={markerEnd}
      />
      {/* Hover tooltip: source → target */}
      {hovered && (
        <g>
          <rect
            x={labelX - 40}
            y={labelY - 22}
            width={80}
            height={18}
            rx={4}
            fill="#0f172a"
            opacity={0.85}
          />
          <text
            x={labelX}
            y={labelY - 9}
            textAnchor="middle"
            fontSize={9}
            fill="#fff"
            fontFamily="system-ui, sans-serif"
          >
            {source} → {target}
          </text>
        </g>
      )}
    </g>
  );
});
