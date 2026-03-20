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
  const inputs = meta?.handles?.inputs ?? [];
  const hasInput = inputs.length > 0;

  // Merge static outputs from NODE_META with dynamic extraOutputs
  const staticOutputs = meta?.handles?.outputs ?? [];
  const allOutputs = [...staticOutputs, ...(extraOutputs ?? [])];

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
          id={inputs[0]?.id ?? 'source'}
          style={targetHandleStyle}
        />
      )}

      <NodeHeader>
        <NodeIconWrapper $color={color}>{icon}</NodeIconWrapper>
        <NodeLabel>{label as string}</NodeLabel>
      </NodeHeader>

      {description && <NodeDesc>{description}</NodeDesc>}

      <HandleContainer>
        {allOutputs.length === 1 ? (
          /* Single output: center */
          <Handle
            type="source"
            position={Position.Bottom}
            id={allOutputs[0].id}
            style={sourceHandleStyle((allOutputs[0] as ExtraOutput).color || color)}
          />
        ) : (
          /* Multiple outputs: spread evenly via flexbox */
          allOutputs.map((output) => (
            <div
              key={output.id}
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                position: 'relative' as const,
              }}
            >
              <Handle
                type="source"
                position={Position.Bottom}
                id={output.id}
                style={sourceHandleStyle((output as ExtraOutput).color || color)}
              />
              {output.label && (
                <HandleLabelTag
                  $color={(output as ExtraOutput).color || color}
                  $left={100}
                >
                  {output.label}
                </HandleLabelTag>
              )}
            </div>
          ))
        )}
      </HandleContainer>
    </NodeWrapper>
  );
});
