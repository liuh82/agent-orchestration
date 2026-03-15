import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';

const Container = styled.div`
  padding: ${spacing[4]};
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
  margin-bottom: ${spacing[2]};
`;

const Label = styled.span`
  font-size: 12px;
  color: ${colors.text.muted};
  min-width: 50px;
`;

const Value = styled.span`
  font-size: 13px;
  color: ${colors.text.primary};
`;

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.secondary};
  margin: ${spacing[4]} 0 ${spacing[2]} 0;
  padding-bottom: ${spacing[2]};
  border-bottom: 1px solid ${colors.border.DEFAULT};
`;

const LogItem = styled.div<{ $level: string }>`
  font-family: ${typography.fontFamily.mono};
  font-size: 12px;
  line-height: 1.6;
  color: ${({ $level }) =>
    $level === 'error' ? colors.error[500] :
    $level === 'warn' ? colors.warning[500] :
    colors.text.secondary
  };
`;

const FileList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[2]};
  margin-top: ${spacing[2]};
`;

const FileTag = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${radius.sm};
  font-size: 12px;
  font-family: ${typography.fontFamily.mono};
  background: ${colors.surface.raised};
  color: ${colors.text.secondary};
  border: 1px solid ${colors.border.DEFAULT};
`;

const NoData = styled.div`
  font-size: 13px;
  color: ${colors.text.muted};
  padding: ${spacing[4]} 0;
`;

const levelLabels: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  warning: 'WARN',
  error: 'ERROR',
};

interface AgentExecutionDetailProps {
  task: {
    id: string;
    status: string;
    agent_name?: string;
    logs?: Array<{ level: string; message: string; timestamp: string }>;
    output_files?: Array<{ name: string; path: string }>;
  };
}

export const AgentExecutionDetail = ({ task }: AgentExecutionDetailProps) => {
  const hasData = (task.logs && task.logs.length > 0) || (task.output_files && task.output_files.length > 0);

  if (!hasData) {
    return (
      <Container>
        <NoData>暂无执行明细</NoData>
      </Container>
    );
  }

  return (
    <Container>
      {task.agent_name && (
        <InfoRow>
          <Label>Agent:</Label>
          <Value>{task.agent_name}</Value>
        </InfoRow>
      )}

      {task.logs && task.logs.length > 0 && (
        <>
          <SectionTitle>实时日志</SectionTitle>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {task.logs.map((log, idx) => (
              <LogItem key={idx} $level={log.level}>
                <span style={{ color: colors.text.muted, marginRight: spacing[2] }}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('zh-CN') : '--:--'}
                </span>
                <span style={{ color: levelLabels[log.level] || log.level.toUpperCase(), marginRight: spacing[2], fontWeight: typography.fontWeight.medium }}>
                  [{levelLabels[log.level] || log.level.toUpperCase()}]
                </span>
                {log.message}
              </LogItem>
            ))}
          </div>
        </>
      )}

      {task.output_files && task.output_files.length > 0 && (
        <>
          <SectionTitle>产出文件</SectionTitle>
          <FileList>
            {task.output_files.map((file, idx) => (
              <FileTag key={idx}>{file.name}</FileTag>
            ))}
          </FileList>
        </>
      )}
    </Container>
  );
};
