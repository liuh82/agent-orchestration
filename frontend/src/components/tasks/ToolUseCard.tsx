/**
 * ToolUseCard — 工具调用可折叠卡片。
 *
 * 颜色方案:
 *   Write  → 绿色（创建）
 *   Edit   → 黄色（修改）
 *   Bash   → 蓝色（命令）
 *   Read   → 灰色（读取）
 *   其他   → 默认
 */
import React from 'react';
import { Collapse } from 'antd';
import {
  FileAddOutlined,
  EditOutlined,
  CodeOutlined,
  FileSearchOutlined,
  ToolOutlined,
  DownOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { typography } from '@/styles/tokens/typography';
import type { TaskStreamEvent } from '@/hooks/useTaskStream';

// 工具 → 颜色/图标映射
const TOOL_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  Write: {
    color: colors.success[700],
    bg: colors.success[50],
    icon: <FileAddOutlined />,
    label: '写入',
  },
  Edit: {
    color: colors.warning[700],
    bg: colors.warning[50],
    icon: <EditOutlined />,
    label: '编辑',
  },
  NotebookEdit: {
    color: colors.warning[700],
    bg: colors.warning[50],
    icon: <EditOutlined />,
    label: '编辑 Notebook',
  },
  Bash: {
    color: colors.info[700],
    bg: colors.info[50],
    icon: <CodeOutlined />,
    label: '执行命令',
  },
  Read: {
    color: colors.neutral[500],
    bg: colors.neutral[50],
    icon: <FileSearchOutlined />,
    label: '读取',
  },
  Glob: {
    color: colors.neutral[500],
    bg: colors.neutral[50],
    icon: <FileSearchOutlined />,
    label: '搜索文件',
  },
  Grep: {
    color: colors.neutral[500],
    bg: colors.neutral[50],
    icon: <FileSearchOutlined />,
    label: '搜索内容',
  },
};

const getDefaultConfig = (name: string) => ({
  color: colors.primary[600],
  bg: colors.primary[50],
  icon: <ToolOutlined />,
  label: name,
});

interface ToolUseCardProps {
  event: TaskStreamEvent;
  /** 是否展示输入详情 */
  showInput?: boolean;
}

export const ToolUseCard: React.FC<ToolUseCardProps> = ({ event, showInput = true }) => {
  const toolName = event.toolName ?? 'Unknown';
  const config = TOOL_CONFIG[toolName] ?? getDefaultConfig(toolName);
  const input = event.toolInput as Record<string, unknown> | undefined;

  // 提取文件路径或命令作为摘要
  let summary = '';
  if (input) {
    if (typeof input.file_path === 'string') {
      summary = input.file_path;
    } else if (typeof input.command === 'string') {
      summary = input.command.length > 120 ? input.command.slice(0, 120) + '...' : input.command;
    } else if (typeof input.content === 'string') {
      summary = input.content.length > 80 ? input.content.slice(0, 80) + '...' : input.content;
    }
  }

  const collapsibleItems = [
    {
      key: 'detail',
      label: null,
      children: showInput && input ? (
        <InputDetail>
          <pre>{JSON.stringify(input, null, 2)}</pre>
        </InputDetail>
      ) : (
        <ContentText>{event.content || '(无输出)'}</ContentText>
      ),
    },
  ];

  return (
    <CardWrapper $bg={config.bg} $borderColor={config.color}>
      <CardHeader>
        <IconBox $color={config.color} $bg={config.bg}>
          {config.icon}
        </IconBox>
        <ToolName $color={config.color}>{config.label}</ToolName>
        {summary && <Summary>{summary}</Summary>}
      </CardHeader>

      <Collapse
        ghost
        bordered={false}
        size="small"
        items={collapsibleItems}
        expandIcon={({ isActive }) => (
          <DownOutlined
            style={{ fontSize: 10, color: colors.text.muted }}
            rotate={isActive ? 180 : 0}
          />
        )}
      />
    </CardWrapper>
  );
};

// ---- 样式 ----

const CardWrapper = styled.div<{ $bg: string; $borderColor: string }>`
  background: ${({ $bg }) => $bg};
  border-left: 3px solid ${({ $borderColor }) => $borderColor};
  border-radius: ${radius.lg};
  padding: ${spacing[3]} ${spacing[4]};
  margin-bottom: ${spacing[2]};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
`;

const IconBox = styled.span<{ $color: string; $bg: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: ${radius.sm};
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  font-size: 12px;
  flex-shrink: 0;
`;

const ToolName = styled.span<{ $color: string }>`
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.semibold};
  color: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const Summary = styled.span`
  font-size: ${typography.fontSize.xs};
  color: ${colors.text.secondary};
  font-family: ${typography.fontFamily.mono};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
`;

const InputDetail = styled.div`
  margin-top: ${spacing[2]};
  pre {
    font-family: ${typography.fontFamily.mono};
    font-size: ${typography.fontSize.xs};
    color: ${colors.text.secondary};
    background: ${colors.surface.DEFAULT};
    border-radius: ${radius.md};
    padding: ${spacing[3]};
    overflow-x: auto;
    max-height: 200px;
    margin: 0;
    line-height: 1.5;
  }
`;

const ContentText = styled.div`
  margin-top: ${spacing[2]};
  font-size: ${typography.fontSize.xs};
  color: ${colors.text.secondary};
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
`;
