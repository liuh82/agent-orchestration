import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  NodeWrapper,
  NodeHeader,
  NodeIconWrapper,
  NodeLabel,
  NodeDesc,
  HandleContainer,
  HandleLabelTag,
  sourceHandleStyle,
  targetHandleStyle,
} from './node-styles';
import {
  NODE_META,
  type WorkflowNodeType,
  type HandleDefinition,
} from '@/types/workflow';

/* ── Extra output handle (for dynamic cases like Switch) ── */

export interface ExtraOutput extends HandleDefinition {
  color?: string;
}

/* ── BaseNode Props ── */

interface BaseNodeProps {
  data: Record<string, unknown>;
  selected?: boolean;
  type: string;
  disabled?: boolean;
  icon: React.ReactNode;
  description?: string;
  extraOutputs?: ExtraOutput[];
}

/* ── BaseNode Component ── */

export const BaseNode = memo(function BaseNode({
  data,
  selected,
  type,
  disabled,
  icon,
  description,
  extraOutputs,
}: BaseNodeProps) {
  const meta = NODE_META[type as WorkflowNodeType];
  const color = meta?.color ?? '#64748b';
  const isTrigger = meta?.category === 'trigger';
  const hasInput = (meta?.handles.inputs.length ?? 0) > 0;

  // Merge static outputs from NODE_META with dynamic extraOutputs
  const staticOutputs = meta?.handles.outputs ?? [];
  const allOutputs = [...staticOutputs, ...(extraOutputs ?? [])];

  // Calculate handle positions for multiple outputs (evenly spread)
  const getOutputLeft = (index: number, total: number): number => {
    if (total === 0) return 50;
    if (total === 1) return 50;
    return ((index + 1) * 100) / (total + 1);
  };

  const label = (data as Record<string, unknown>).label || meta?.label || type;

  return (
    <NodeWrapper
      $color={color}
      $selected={selected}
      $disabled={disabled}
      $isTrigger={isTrigger}
    >
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          id={meta!.handles.inputs[0].id}
          style={targetHandleStyle}
        />
      )}

      <NodeHeader>
        <NodeIconWrapper $color={color}>{icon}</NodeIconWrapper>
        <NodeLabel>{label as string}</NodeLabel>
      </NodeHeader>

      {description && <NodeDesc>{description}</NodeDesc>}

      <HandleContainer $count={allOutputs.length}>
        {allOutputs.map((output, i) => (
          <div key={output.id} style={{ position: 'relative' }}>
            <Handle
              type="source"
              position={Position.Bottom}
              id={output.id}
              style={{
                ...sourceHandleStyle((output as ExtraOutput).color || color),
                left: `${getOutputLeft(i, allOutputs.length)}%`,
                position: 'absolute',
              }}
            />
            {allOutputs.length > 1 && output.label && (
              <HandleLabelTag
                $color={(output as ExtraOutput).color || color}
                $left={getOutputLeft(i, allOutputs.length)}
              >
                {output.label}
              </HandleLabelTag>
            )}
          </div>
        ))}
      </HandleContainer>
    </NodeWrapper>
  );
});
