import {
  RobotOutlined,
  BranchesOutlined,
  UserOutlined,
  ApartmentOutlined,
  SwapOutlined,
  BellOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { NODE_TYPE_OPTIONS, type WorkflowNodeType } from '@/types/workflow';

const Panel = styled.div`
  width: 200px;
  background: ${colors.surface.DEFAULT};
  border-right: 1px solid ${colors.border.DEFAULT};
  padding: ${spacing[4]} ${spacing[3]};
  display: flex;
  flex-direction: column;
  gap: ${spacing[2]};
  overflow-y: auto;
`;

const PanelTitle = styled.div`
  font-size: 12px;
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: ${spacing[2]};
`;

const NODE_ICONS: Record<string, React.ReactNode> = {
  agent: <RobotOutlined />,
  condition: <BranchesOutlined />,
  human: <UserOutlined />,
  parallel: <ApartmentOutlined />,
  transform: <SwapOutlined />,
  notification: <BellOutlined />,
  timer: <ClockCircleOutlined />,
};

const NodeItem = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  padding: ${spacing[2]} ${spacing[3]};
  border-radius: ${radius.md};
  font-size: 13px;
  color: ${colors.text.primary};
  cursor: grab;
  border: 1px solid ${colors.border.DEFAULT};
  background: ${colors.surface.DEFAULT};
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ $color }) => $color};
    background: ${({ $color }) => $color}08;
  }

  &:active {
    cursor: grabbing;
  }

  .anticon {
    font-size: 15px;
    color: ${({ $color }) => $color};
  }
`;

interface NodePanelProps {
  onDragStart?: (event: React.DragEvent, nodeType: WorkflowNodeType) => void;
}

export const NodePanel = ({ onDragStart }: NodePanelProps) => (
  <Panel>
    <PanelTitle>节点面板</PanelTitle>
    {NODE_TYPE_OPTIONS.map((opt) => (
      <NodeItem
        key={opt.value}
        $color={opt.color}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/reactflow', opt.value);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart?.(e, opt.value);
        }}
      >
        {NODE_ICONS[opt.value]}
        {opt.label}
      </NodeItem>
    ))}
  </Panel>
);
