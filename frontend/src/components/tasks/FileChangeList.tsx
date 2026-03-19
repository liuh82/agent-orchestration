/**
 * FileChangeList — 文件修改列表组件。
 *
 * 显示方式:
 *   created ✨  绿色
 *   edited  ✏️  黄色
 *   deleted 🗑️  红色
 */
import React from 'react';
import { Tag } from 'antd';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { typography } from '@/styles/tokens/typography';

export interface FileChange {
  path: string;
  action: 'created' | 'edited' | 'deleted';
}

const ACTION_CONFIG: Record<
  FileChange['action'],
  { color: string; bg: string; icon: string; label: string }
> = {
  created: { color: colors.success[700], bg: colors.success[50], icon: '✨', label: '新建' },
  edited:  { color: colors.warning[700], bg: colors.warning[50], icon: '✏️',  label: '修改' },
  deleted: { color: colors.error[700],   bg: colors.error[50],   icon: '🗑️',  label: '删除' },
};

interface FileChangeListProps {
  files: FileChange[];
}

export const FileChangeList: React.FC<FileChangeListProps> = ({ files }) => {
  if (files.length === 0) return null;

  return (
    <Wrapper>
      <ListHeader>
        文件变更 ({files.length})
      </ListHeader>
      <List>
        {files.map((f, i) => {
          const cfg = ACTION_CONFIG[f.action];
          return (
            <FileItem key={`${f.path}-${i}`} $bg={cfg.bg}>
              <ActionIcon>{cfg.icon}</ActionIcon>
              <FilePath>{f.path}</FilePath>
              <Tag
                color={cfg.bg}
                style={{ color: cfg.color, border: 'none', fontSize: typography.fontSize.xs, marginLeft: 'auto', flexShrink: 0 }}
              >
                {cfg.label}
              </Tag>
            </FileItem>
          );
        })}
      </List>
    </Wrapper>
  );
};

// ---- 样式 ----

const Wrapper = styled.div`
  margin-top: ${spacing[4]};
`;

const ListHeader = styled.div`
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin-bottom: ${spacing[2]};
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[1]};
`;

const FileItem = styled.div<{ $bg: string }>`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  padding: ${spacing[2]} ${spacing[3]};
  background: ${({ $bg }) => $bg};
  border-radius: ${radius.md};
`;

const ActionIcon = styled.span`
  font-size: 14px;
  flex-shrink: 0;
`;

const FilePath = styled.span`
  font-family: ${typography.fontFamily.mono};
  font-size: ${typography.fontSize.xs};
  color: ${colors.text.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;
