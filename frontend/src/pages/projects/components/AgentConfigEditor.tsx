import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Select, Button, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { projectApi } from '@/api/projects';

const configTypes = [
  { value: 'CLAUDE.md', label: 'CLAUDE.md' },
  { value: 'SOUL.md', label: 'SOUL.md' },
  { value: 'AGENTS.md', label: 'AGENTS.md' },
  { value: 'opencode.json', label: 'opencode.json' },
];

const Container = styled.div`
  display: flex;
  gap: ${spacing[5]};
  min-height: 400px;
`;

const TypeList = styled.div`
  width: 180px;
  flex-shrink: 0;
`;

const EditorArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const CodeEditor = styled.textarea`
  flex: 1;
  min-height: 350px;
  font-family: ${typography.fontFamily.mono};
  font-size: 14px;
  line-height: 1.6;
  background: #fafafa;
  color: #1f2937;
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
  padding: ${spacing[4]};
  resize: vertical;

  &:focus {
    border-color: ${colors.border.focus};
    outline: none;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
  }
`;

interface AgentConfigEditorProps {
  projectId: string;
}

export const AgentConfigEditor = ({ projectId }: AgentConfigEditorProps) => {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>(configTypes[0].value);
  const [content, setContent] = useState('');

  const { data } = useQuery(
    ['project-agent-configs', projectId],
    () => projectApi.getAgentConfigs(projectId),
  );
  const configs = data?.data ?? [];

  const saveMutation = useMutation(
    (data: { agent_type: string; config_type: string; content: string }) =>
      projectApi.saveAgentConfig(projectId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project-agent-configs', projectId]);
        void message.success('配置已保存');
      },
      onError: () => { void message.error('保存失败'); },
    },
  );

  const handleSave = () => {
    saveMutation.mutate({
      agent_type: 'default',
      config_type: selectedType,
      content,
    });
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    const cfg = configs.find((c: any) => c.config_type === type);
    setContent(cfg?.content || '');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[4] }}>
        <h3 style={{ margin: 0, color: colors.text.primary, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>
          Agent 配置
        </h3>
      </div>

      <div style={{ background: colors.surface.DEFAULT, border: `1px solid ${colors.border.DEFAULT}`, borderRadius: radius.xl, padding: spacing[5] }}>
        <Container>
          <TypeList>
            <div style={{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing[2] }}>配置类型</div>
            <Select
              value={selectedType}
              onChange={handleTypeChange}
              options={configTypes}
              style={{ width: '100%' }}
              size="large"
            />
          </TypeList>

          <EditorArea>
            <CodeEditor
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`输入 ${selectedType} 配置内容...`}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing[3] }}>
              <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isLoading} onClick={handleSave}>
                保存
              </Button>
            </div>
          </EditorArea>
        </Container>
      </div>
    </div>
  );
};
