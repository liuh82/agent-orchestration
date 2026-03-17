import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { RobotOutlined, DatabaseOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { BaseNode } from './BaseNode';
import type { AgentNodeData } from '@/types/workflow';

const ERROR_BADGE_MAP: Record<string, { text: string; color: string }> = {
  skip: { text: 'SKIP', color: '#f59e0b' },
  retry: { text: 'RETRY', color: '#3b82f6' },
  fallback: { text: 'FALL', color: '#8b5cf6' },
};

const Badge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: ${({ $color }) => $color};
  line-height: 1.6;
  margin-left: 4px;
  vertical-align: middle;
`;

const CacheIcon = styled.span`
  color: #06b6d4;
  font-size: 12px;
  margin-left: 4px;
  vertical-align: middle;
  display: inline-flex;
  align-items: center;
`;

export const AgentNode = memo(function AgentNode({
  data,
  selected,
  type,
}: NodeProps) {
  const d = data as unknown as AgentNodeData;
  const modelText = d.model || d.agentType || undefined;

  const errorBadge = d.onError && d.onError !== 'stop' ? ERROR_BADGE_MAP[d.onError] : null;
  const showCache = d.enableCache === true;

  // Build description with optional badges
  const description = (() => {
    if (!modelText && !errorBadge && !showCache) return undefined;

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {modelText}
        {errorBadge && <Badge $color={errorBadge.color}>{errorBadge.text}</Badge>}
        {showCache && <CacheIcon><DatabaseOutlined /></CacheIcon>}
      </span>
    ) as unknown as string;
  })();

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<RobotOutlined />}
      description={description}
    />
  );
});
