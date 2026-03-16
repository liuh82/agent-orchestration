import React from 'react';
import { Collapse } from 'antd';
import {
  PlayCircleOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  RobotOutlined,
  BranchesOutlined,
  ApartmentOutlined,
  ReloadOutlined,
  HourglassOutlined,
  ForkOutlined,
  GlobalOutlined,
  CodeOutlined,
  SwapOutlined,
  SendOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { NODE_META, NODE_CATEGORIES, type WorkflowNodeType } from '@/types/workflow';

/* ── Icon Mapping ── */

const ICON_MAP: Record<string, React.ReactNode> = {
  PlayCircleOutlined: <PlayCircleOutlined />,
  ClockCircleOutlined: <ClockCircleOutlined />,
  ApiOutlined: <ApiOutlined />,
  RobotOutlined: <RobotOutlined />,
  BranchesOutlined: <BranchesOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  ReloadOutlined: <ReloadOutlined />,
  HourglassOutlined: <HourglassOutlined />,
  ForkOutlined: <ForkOutlined />,
  GlobalOutlined: <GlobalOutlined />,
  CodeOutlined: <CodeOutlined />,
  SwapOutlined: <SwapOutlined />,
  SendOutlined: <SendOutlined />,
};

/* ── Dark Theme Colors ── */

const DARK = {
  bg: '#ffffff',
  surface: '#f8fafc',
  surfaceHover: '#0f172a',
  border: '#0f172a',
  borderHover: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#94a3b8',
  textDisabled: '#94a3b8',
};

/* ── Styled Components ── */

const PanelContainer = styled.div`
  width: 240px;
  min-width: 240px;
  background: ${DARK.bg};
  border-right: 1px solid ${DARK.border};
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${DARK.borderHover};
    border-radius: ${radius.full};
  }
`;

const PanelHeader = styled.div`
  padding: ${spacing[4]} ${spacing[4]} ${spacing[3]};
  font-size: ${typography.fontSize.base};
  font-weight: ${typography.fontWeight.semibold};
  color: ${DARK.text};
  letter-spacing: ${typography.letterSpacing.wide};
  border-bottom: 1px solid ${DARK.border};
`;

const StyledCollapse = styled(Collapse)`
  background: ${DARK.bg};
  border: none;

  .ant-collapse-item {
    border-bottom: 1px solid ${DARK.border};
    background: transparent;

    &:last-child {
      border-bottom: none;
    }
  }

  .ant-collapse-header {
    align-items: center !important;
    padding: ${spacing[3]} ${spacing[3]} !important;
    color: ${DARK.text} !important;
    font-size: ${typography.fontSize.sm} !important;
    font-weight: ${typography.fontWeight.medium} !important;
    transition: background 0.15s ease !important;

    &:hover {
      background: ${DARK.surface} !important;
    }
  }

  .ant-collapse-expand-icon {
    color: ${DARK.textMuted} !important;

    .anticon {
      font-size: 12px !important;
    }
  }

  .ant-collapse-content {
    background: transparent !important;
    border: none !important;
  }

  .ant-collapse-content-box {
    padding: ${spacing[1]} ${spacing[3]} ${spacing[3]} !important;
    display: flex;
    flex-direction: column;
    gap: ${spacing[1]};
  }
`;

const CategoryLabel = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[2]};

  &::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: ${radius.full};
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  }
`;

const NodeItem = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  padding: ${spacing[2]} ${spacing[3]};
  border-radius: ${radius.md};
  font-size: ${typography.fontSize.sm};
  color: ${DARK.text};
  cursor: grab;
  border: 1px solid transparent;
  background: ${DARK.surface};
  transition: all 0.15s ease;
  position: relative;

  /* Left color bar */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 3px;
    border-radius: 0 ${radius.sm} ${radius.sm} 0;
    background: ${({ $color }) => $color};
    opacity: 0.6;
    transition: opacity 0.15s ease;
  }

  &:hover {
    border-color: ${({ $color }) => $color};
    background: ${DARK.surfaceHover};

    &::before {
      opacity: 1;
    }
  }

  &:active {
    cursor: grabbing;
  }

  .anticon {
    font-size: 15px;
    color: ${({ $color }) => $color};
    flex-shrink: 0;
  }
`;

/* ── Props ── */

interface NodePanelProps {
  onDragStart?: (event: React.DragEvent, nodeType: WorkflowNodeType) => void;
}

/* ── Component ── */

export const NodePanel: React.FC<NodePanelProps> = ({ onDragStart }) => {
  const collapseItems = NODE_CATEGORIES.map((cat) => ({
    key: cat.key,
    label: <CategoryLabel $color={cat.color}>{cat.label}</CategoryLabel>,
    children: (
      <>
        {cat.nodeTypes.map((nodeType) => {
          const meta = NODE_META[nodeType];
          return (
            <NodeItem
              key={nodeType}
              $color={meta.color}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', nodeType);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart?.(e, nodeType);
              }}
            >
              {ICON_MAP[meta.icon] ?? null}
              {meta.label}
            </NodeItem>
          );
        })}
      </>
    ),
  }));

  return (
    <PanelContainer>
      <PanelHeader>节点面板</PanelHeader>
      <StyledCollapse
        bordered={false}
        defaultActiveKey={NODE_CATEGORIES.map((c) => c.key)}
        ghost
        items={collapseItems}
      />
    </PanelContainer>
  );
};
