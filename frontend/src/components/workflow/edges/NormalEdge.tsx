import { memo, useState, useMemo } from 'react';
import { BaseEdge, getSmoothStepPath, useStore, type EdgeProps } from '@xyflow/react';
import type { CustomEdgeData } from '@/types/workflow';

/** Resolve a display label for a node given its ID */
function useNodeLabel(nodeId: string): string {
  const node = useStore((s) => s.nodeLookup?.get(nodeId));
  return useMemo(() => {
    if (!node) return nodeId;
    const data = node.data as Record<string, unknown> | undefined;
    return (data?.label as string) ?? node.type ?? nodeId;
  }, [node]);
}

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
  selected,
  data,
  style,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const sourceLabel = useNodeLabel(source);
  const targetLabel = useNodeLabel(target);
  const color = (data as CustomEdgeData | undefined)?.color ?? '#94a3b8';
  const activeColor = hovered ? '#64748b' : color;
  const isSelected = selected ?? false;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const tooltipText = `${sourceLabel} → ${targetLabel}`;
  const tooltipWidth = Math.max(tooltipText.length * 7, 40);

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Wider invisible path for easier hover targeting */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={12}
        stroke="transparent"
      />
      {/* Selection glow */}
      {isSelected && (
        <BaseEdge
          id={`${id}-selection`}
          path={edgePath}
          style={{
            stroke: '#6366f1',
            strokeWidth: 5,
            opacity: 0.35,
            filter: 'blur(2px)',
          }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: isSelected ? '#6366f1' : activeColor,
          strokeWidth: isSelected ? 2.5 : 1.5,
          transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
          cursor: 'pointer',
        }}
        markerEnd={markerEnd}
      />
      {/* Hover tooltip: source label → target label */}
      {hovered && (
        <g>
          <rect
            x={labelX - tooltipWidth / 2}
            y={labelY - 22}
            width={tooltipWidth}
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
            {tooltipText}
          </text>
        </g>
      )}
    </g>
  );
});
