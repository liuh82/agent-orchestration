import { useState } from 'react';
import { Button, Input, Typography, message } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { tasksApi } from '@/api/tasks';

const { TextArea } = Input;
const { Text } = Typography;

const ContextBlock = styled.div`
  background: #fafafa;
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
  padding: ${spacing[4]};
  margin-bottom: ${spacing[4]};
`;

const ContextLabel = styled.div`
  font-size: 12px;
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.muted};
  margin-bottom: ${spacing[2]};
`;

const CodeBlock = styled.pre`
  background: ${colors.neutral[800]};
  color: #e2e8f0;
  border-radius: ${radius.md};
  padding: ${spacing[3]};
  font-family: ${typography.fontFamily.mono};
  font-size: 13px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
`;

const ActionsBar = styled.div`
  display: flex;
  gap: ${spacing[3]};
  margin-bottom: ${spacing[4]};
`;

const CommentArea = styled.div`
  padding: ${spacing[4]};
  background: ${colors.surface.raised};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
`;

interface HumanInterventionProps {
  task: {
    id: string;
    title: string;
    human_context?: string;
    human_code_snippet?: string;
  };
}

export const HumanIntervention = ({ task }: HumanInterventionProps) => {
  const [mode, setMode] = useState<'view' | 'comment'>('view');
  const [comment, setComment] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await tasksApi.approve(task.id);
      void message.success('已审批通过');
    } catch {
      void message.error('审批失败');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (mode === 'view') {
      setMode('comment');
      return;
    }
    if (!comment.trim()) {
      void message.warning('请输入驳回原因');
      return;
    }
    setRejecting(true);
    try {
      await tasksApi.reject(task.id, { comment });
      void message.success('已驳回');
      setMode('view');
      setComment('');
    } catch {
      void message.error('驳回失败');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div>
      {task.human_context && (
        <ContextBlock>
          <ContextLabel>干预原因</ContextLabel>
          <Text style={{ fontSize: 14, color: colors.text.primary, lineHeight: 1.6 }}>
            {task.human_context}
          </Text>
        </ContextBlock>
      )}

      {task.human_code_snippet && (
        <ContextBlock>
          <ContextLabel>相关代码片段</ContextLabel>
          <CodeBlock>{task.human_code_snippet}</CodeBlock>
        </ContextBlock>
      )}

      <ActionsBar>
        <Button
          type="primary"
          icon={<CheckOutlined />}
          style={{ background: colors.success[600], borderColor: colors.success[600] }}
          loading={approving}
          onClick={handleApprove}
        >
          审批通过
        </Button>
        <Button
          danger
          icon={<CloseOutlined />}
          loading={rejecting}
          onClick={handleReject}
        >
          {mode === 'view' ? '驳回' : '提交驳回'}
        </Button>
        <Button
          type="text"
          icon={<EditOutlined />}
          style={{ color: colors.info[500] }}
          onClick={() => setMode(mode === 'view' ? 'comment' : 'view')}
        >
          {mode === 'view' ? '修改意见' : '收起'}
        </Button>
      </ActionsBar>

      {mode === 'comment' && (
        <CommentArea>
          <Text style={{ fontSize: 13, color: colors.text.secondary, marginBottom: spacing[2] }}>
            驳回原因 / 修改意见
          </Text>
          <TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="请输入驳回原因或修改指令..."
            style={{ fontSize: 14, background: '#ffffff', color: '#1f2937' }}
          />
          <div style={{ marginTop: spacing[3], display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" loading={rejecting} onClick={handleReject}>
              提交
            </Button>
          </div>
        </CommentArea>
      )}
    </div>
  );
};
