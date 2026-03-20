import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Collapse,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Slider,
  Switch,
  message,
} from 'antd';
import {
  BellOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { workflowsApi } from '@/api/workflows';
import type {
  WorkflowNodeType,
  NodeData,
  AgentNodeData,
  InputNodeData,
  IfNodeData,
  SwitchNodeData,
  LoopNodeData,
  WaitNodeData,
  CronTriggerNodeData,
  WebhookTriggerNodeData,
  HttpRequestNodeData,
  CodeNodeData,
  TransformNodeData,
  SubWorkflowNodeData,
  SubWorkflowOutputMapping,
  OutputNodeData,
  ContextOutputNodeData,
  ContextOutputTarget,
  ResultOutputNodeData,
  NotificationNodeData,
  HumanNodeData,
  ConditionOperator,
  ConditionRule,
  SwitchCase,
  TransformMapping,
  SubWorkflowParamMapping,
} from '@/types/workflow';
import { NODE_META as nodeMetaRegistry } from '@/types/workflow';

/* ================================================================
 *  Styled Components (Light Theme)
 * ================================================================ */

const Panel = styled.div`
  width: 320px;
  min-width: 320px;
  background: #ffffff;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

const PanelHeader = styled.div`
  padding: ${spacing[4]} ${spacing[4]} ${spacing[3]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const PanelHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
`;

const NodeIconBadge = styled.div<{ $color: string }>`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: ${(p) => p.$color}18;
  color: ${(p) => p.$color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
`;

const NodeTypeLabel = styled.span`
  font-size: ${typography.fontSize.base};
  font-weight: ${typography.fontWeight.semibold};
  color: #0f172a;
`;

const PanelBody = styled.div`
  padding: ${spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]};
  flex: 1;
`;

const SectionTitle = styled.div`
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.medium};
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: ${spacing[1]};
`;

const AdvancedJsonArea = styled(Input.TextArea)`
  font-family: ${typography.fontFamily.mono} !important;
  font-size: ${typography.fontSize.sm} !important;
  line-height: 1.6 !important;
  background: #f8fafc !important;
  color: #0f172a !important;
  border-color: #e2e8f0 !important;

  &:focus {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2) !important;
  }
`;

const DynamicRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${spacing[2]};
  margin-bottom: ${spacing[2]};
`;

const DynamicRowField = styled.div`
  flex: 1;
`;

const DeleteRowButton = styled(Button)`
  flex-shrink: 0;
  margin-top: 2px;
`;

const AddRowButton = styled(Button)`
  width: 100%;
  margin-top: ${spacing[1]};
`;

/* ================================================================
 *  Ant Design Light Overrides
 * ================================================================ */

const LIGHT_SELECT_STYLE: React.CSSProperties = {
  background: '#f8fafc',
  borderColor: '#e2e8f0',
  color: '#0f172a',
};

/* ================================================================
 *  Operator Options
 * ================================================================ */

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'eq', label: '等于 (=)' },
  { value: 'neq', label: '不等于 (!=)' },
  { value: 'gt', label: '大于 (>)' },
  { value: 'lt', label: '小于 (<)' },
  { value: 'gte', label: '大于等于 (>=)' },
  { value: 'lte', label: '小于等于 (<=)' },
  { value: 'contains', label: '包含' },
  { value: 'regex', label: '正则匹配' },
  { value: 'empty', label: '为空' },
  { value: 'not_empty', label: '不为空' },
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const WEBHOOK_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

const CODE_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
];

const OUTPUT_FORMATS = [
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'markdown', label: 'Markdown' },
];

/* ================================================================
 *  Helper: get typed node data
 * ================================================================ */

function getTypedData<T extends NodeData>(data: NodeData): T {
  return data as T;
}

/* ================================================================
 *  Advanced JSON Editor
 * ================================================================ */

interface AdvancedJsonEditorProps {
  data: NodeData;
  onChange: (newData: Partial<NodeData>) => void;
}

const AdvancedJsonEditor: React.FC<AdvancedJsonEditorProps> = ({ data, onChange }) => {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(data, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(data, null, 2));
    setError(null);
  }, [data]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setJsonText(value);

      try {
        const parsed = JSON.parse(value);
        setError(null);
        onChange(parsed);
      } catch {
        setError('JSON 格式无效');
      }
    },
    [onChange],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] as string }}>
      <AdvancedJsonArea
        value={jsonText}
        onChange={handleChange}
        rows={20}
        status={error ? 'error' : undefined}
      />
      {error && (
        <span style={{ color: colors.error[500], fontSize: typography.fontSize.sm }}>
          {error}
        </span>
      )}
    </div>
  );
};

/* ================================================================
 *  Agent Form
 * ================================================================ */

interface AgentFormProps {
  data: AgentNodeData;
  agents?: Array<{ id: string; name: string }>;
  onUpdate: (partial: Partial<AgentNodeData>) => void;
}

const AgentForm: React.FC<AgentFormProps> = ({ data, agents, onUpdate }) => {
  const [manualMode, setManualMode] = useState(!data.agentId);

  const handleAgentSelect = useCallback(
    (agentId: string) => {
      const agent = agents?.find((a) => a.id === agentId);
      if (agent) {
        setManualMode(false);
        onUpdate({ agentId, agentSelectMode: 'select', label: data.label });
      }
    },
    [agents, data.label, onUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>Agent 配置</SectionTitle>

      <div style={{ display: 'flex', gap: spacing[2] as string }}>
        <Button
          size="small"
          type={!manualMode ? 'primary' : 'default'}
          onClick={() => { setManualMode(false); onUpdate({ agentSelectMode: 'select' }); }}
          style={manualMode ? { background: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' } : undefined}
        >
          选择 Agent
        </Button>
        <Button
          size="small"
          type={manualMode ? 'primary' : 'default'}
          onClick={() => { setManualMode(true); onUpdate({ agentSelectMode: 'manual' }); }}
          style={!manualMode ? { background: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' } : undefined}
        >
          手动配置
        </Button>
      </div>

      {!manualMode && agents && (
        <Select
          value={data.agentId}
          onChange={handleAgentSelect}
          placeholder="选择 Agent"
          size="small"
          options={agents.map((a) => ({ label: a.name, value: a.id }))}
          style={LIGHT_SELECT_STYLE}
          popupMatchSelectWidth={false}
        />
      )}

      {/* 后端选择器 — 选择执行 Agent 的后端 */}
      <Form.Item label="执行后端" style={{ marginBottom: spacing[2] as string }}>
        <Select
          value={data.backend ?? 'auto'}
          onChange={(val: string) => onUpdate({ backend: val as AgentNodeData['backend'] })}
          size="small"
          style={LIGHT_SELECT_STYLE}
          options={[
            { label: '自动（由 Bridge 决定）', value: 'auto' },
            { label: 'Claude Code', value: 'claude' },
            { label: 'Codex CLI', value: 'codex' },
            { label: 'OpenCode', value: 'opencode' },
          ]}
        />
      </Form.Item>

      <Form.Item label="Prompt" style={{ marginBottom: spacing[2] as string }}>
        <Input.TextArea
          value={data.prompt}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
          rows={4}
          placeholder="输入 Prompt，支持 {{变量名}} 语法"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      {manualMode && (
        <Form.Item label="Model" style={{ marginBottom: spacing[2] as string }}>
          <Input
            value={data.model}
            onChange={(e) => onUpdate({ model: e.target.value })}
            placeholder="gpt-4, claude-3, etc."
            size="small"
            style={LIGHT_SELECT_STYLE}
          />
        </Form.Item>
      )}

      <Form.Item label={`Temperature: ${data.temperature ?? 0.7}`} style={{ marginBottom: spacing[2] as string }}>
        <Slider
          min={0}
          max={1}
          step={0.1}
          value={data.temperature ?? 0.7}
          onChange={(val) => onUpdate({ temperature: val })}
          tooltip={{ formatter: (v) => v?.toFixed(1) }}
        />
      </Form.Item>

      <Form.Item label="Max Tokens" style={{ marginBottom: spacing[2] as string }}>
        <InputNumber
          value={data.maxTokens}
          onChange={(val) => onUpdate({ maxTokens: val ?? 4096 })}
          min={1}
          max={128000}
          size="small"
          style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
        />
      </Form.Item>

      <Form.Item label="Timeout (秒)" style={{ marginBottom: spacing[2] as string }}>
        <InputNumber
          value={data.timeout}
          onChange={(val) => onUpdate({ timeout: val ?? 300 })}
          min={1}
          max={3600}
          size="small"
          style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
        />
      </Form.Item>

      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'advanced',
            label: '高级设置',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
                <Form.Item label="最大重试次数" style={{ marginBottom: spacing[2] as string }}>
                  <InputNumber
                    value={data.maxRetries ?? 1}
                    onChange={(val) => onUpdate({ maxRetries: val ?? 1 })}
                    min={0}
                    max={5}
                    size="small"
                    style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
                  />
                </Form.Item>

                <Form.Item label="失败策略" style={{ marginBottom: spacing[2] as string }}>
                  <Select
                    value={data.onError ?? 'stop'}
                    onChange={(val) => {
                      const onError = val as AgentNodeData['onError'];
                      onUpdate({
                        onError,
                        // Clear fallbackValue when not fallback
                        ...(onError !== 'fallback' ? { fallbackValue: undefined } : {}),
                      });
                    }}
                    size="small"
                    style={LIGHT_SELECT_STYLE}
                    options={[
                      { value: 'stop', label: '停止工作流' },
                      { value: 'skip', label: '跳过此节点' },
                      { value: 'retry', label: '重试' },
                      { value: 'fallback', label: '使用回退值' },
                    ]}
                  />
                </Form.Item>

                {data.onError === 'fallback' && (
                  <Form.Item label="回退值" style={{ marginBottom: spacing[2] as string }}>
                    <Input.TextArea
                      value={data.fallbackValue ?? ''}
                      onChange={(e) => onUpdate({ fallbackValue: e.target.value })}
                      rows={3}
                      placeholder="Agent 执行失败时使用的回退值"
                      style={LIGHT_SELECT_STYLE}
                    />
                  </Form.Item>
                )}

                {/* 输出别名 */}
                <Form.Item
                  label="输出别名"
                  style={{ marginBottom: spacing[2] as string }}
                  extra="下游节点可用 {{别名}} 引用此节点输出，默认为节点 ID"
                >
                  <Input
                    value={data.outputAlias}
                    onChange={(e) => onUpdate({ outputAlias: e.target.value })}
                    placeholder="myOutput"
                    size="small"
                    style={LIGHT_SELECT_STYLE}
                  />
                </Form.Item>

                {/* 输出格式 */}
                <Form.Item label="输出格式" style={{ marginBottom: spacing[2] as string }}>
                  <Select
                    value={data.outputFormat ?? 'text'}
                    onChange={(val) => onUpdate({ outputFormat: val as AgentNodeData['outputFormat'] })}
                    size="small"
                    style={LIGHT_SELECT_STYLE}
                    options={[
                      { value: 'text', label: '纯文本' },
                      { value: 'json', label: 'JSON' },
                      { value: 'markdown', label: 'Markdown' },
                    ]}
                  />
                </Form.Item>

                {/* 工作目录 */}
                <Form.Item
                  label="工作目录"
                  style={{ marginBottom: spacing[2] as string }}
                  extra="Agent 执行时的工作目录，留空则使用项目目录"
                >
                  <Input
                    value={data.workDir}
                    onChange={(e) => onUpdate({ workDir: e.target.value })}
                    placeholder="/path/to/project"
                    size="small"
                    style={LIGHT_SELECT_STYLE}
                  />
                </Form.Item>

                {/* 环境变量 */}
                <Form.Item
                  label="环境变量 (JSON)"
                  style={{ marginBottom: spacing[2] as string }}
                  extra='额外环境变量，如 {"NODE_ENV": "production"}'
                >
                  <Input.TextArea
                    value={data.envVars ?? ''}
                    onChange={(e) => onUpdate({ envVars: e.target.value })}
                    rows={2}
                    placeholder='{"NODE_ENV": "production"}'
                    style={{
                      ...LIGHT_SELECT_STYLE,
                      fontFamily: typography.fontFamily.mono,
                      fontSize: typography.fontSize.sm,
                    }}
                  />
                </Form.Item>

                {/* Git 集成 */}
                <Form.Item
                  label="启用 Git 集成"
                  style={{ marginBottom: spacing[2] as string }}
                  extra="创建分支并提交 Agent 产生的代码变更"
                >
                  <Switch
                    checked={data.gitEnabled ?? false}
                    onChange={(checked) => onUpdate({ gitEnabled: checked })}
                    size="small"
                  />
                </Form.Item>

                <Form.Item
                  style={{ marginBottom: spacing[2] as string }}
                  extra='指定只输出哪些字段，如 ["result", "summary"]'
                >
                  <Input.TextArea
                    value={data.outputFilter ? JSON.stringify(data.outputFilter) : ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) {
                        onUpdate({ outputFilter: undefined });
                        return;
                      }
                      try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) {
                          onUpdate({ outputFilter: parsed });
                        }
                      } catch {
                        // Allow user to keep editing
                      }
                    }}
                    rows={2}
                    placeholder='["result", "summary"]'
                    style={{
                      ...LIGHT_SELECT_STYLE,
                      fontFamily: typography.fontFamily.mono,
                      fontSize: typography.fontSize.sm,
                    }}
                  />
                </Form.Item>

                <Form.Item label="启用缓存" style={{ marginBottom: spacing[2] as string }}>
                  <Switch
                    checked={data.enableCache ?? false}
                    onChange={(checked) => {
                      onUpdate({
                        enableCache: checked,
                        ...(checked ? {} : { cacheTTL: undefined }),
                      });
                    }}
                    size="small"
                  />
                </Form.Item>

                {data.enableCache && (
                  <Form.Item label="缓存 TTL (秒)" style={{ marginBottom: 0 }}>
                    <InputNumber
                      value={data.cacheTTL ?? 3600}
                      onChange={(val) => onUpdate({ cacheTTL: val ?? 3600 })}
                      min={60}
                      max={86400}
                      size="small"
                      style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
                    />
                  </Form.Item>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

/* ================================================================
 *  IF Form
 * ================================================================ */

interface IfFormProps {
  data: IfNodeData;
  onUpdate: (partial: Partial<IfNodeData>) => void;
}

const IfForm: React.FC<IfFormProps> = ({ data, onUpdate }) => {
  const conditions: ConditionRule[] = data.conditions ?? [];

  const addCondition = useCallback(() => {
    onUpdate({ conditions: [...conditions, { field: '', operator: 'eq', value: '' }] });
  }, [conditions, onUpdate]);

  const removeCondition = useCallback(
    (index: number) => {
      const next = conditions.filter((_, i) => i !== index);
      onUpdate({ conditions: next });
    },
    [conditions, onUpdate],
  );

  const updateCondition = useCallback(
    (index: number, updated: ConditionRule) => {
      const next = conditions.map((c, i) => (i === index ? updated : c));
      onUpdate({ conditions: next });
    },
    [conditions, onUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>条件配置</SectionTitle>

      <Form.Item label="逻辑" style={{ marginBottom: spacing[2] as string }}>
        <Radio.Group
          value={data.logic}
          onChange={(e) => onUpdate({ logic: e.target.value })}
          size="small"
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="and">AND</Radio.Button>
          <Radio.Button value="or">OR</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {conditions.map((cond, index) => {
        const hideValue = cond.operator === 'empty' || cond.operator === 'not_empty';
        return (
          <DynamicRow key={index}>
            <DynamicRowField>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] as string }}>
                <Input
                  value={cond.field}
                  onChange={(e) =>
                    updateCondition(index, { ...cond, field: e.target.value })
                  }
                  placeholder="字段"
                  size="small"
                  style={LIGHT_SELECT_STYLE}
                />
                <Select
                  value={cond.operator}
                  onChange={(val) =>
                    updateCondition(index, { ...cond, operator: val })
                  }
                  size="small"
                  options={CONDITION_OPERATORS}
                  style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
                />
                {!hideValue && (
                  <Input
                    value={cond.value}
                    onChange={(e) =>
                      updateCondition(index, { ...cond, value: e.target.value })
                    }
                    placeholder="值"
                    size="small"
                    style={LIGHT_SELECT_STYLE}
                  />
                )}
              </div>
            </DynamicRowField>
            <DeleteRowButton
              type="text"
              danger
              size="small"
              icon={<MinusCircleOutlined />}
              onClick={() => removeCondition(index)}
            />
          </DynamicRow>
        );
      })}
      <AddRowButton
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={addCondition}
      >
        添加条件
      </AddRowButton>
    </div>
  );
};

/* ================================================================
 *  Switch Form
 * ================================================================ */

interface SwitchFormProps {
  data: SwitchNodeData;
  onUpdate: (partial: Partial<SwitchNodeData>) => void;
}

const SwitchForm: React.FC<SwitchFormProps> = ({ data, onUpdate }) => {
  const cases: SwitchCase[] = data.cases ?? [];

  const addCase = useCallback(() => {
    onUpdate({ cases: [...cases, { label: '', operator: 'eq', value: '' }] });
  }, [cases, onUpdate]);

  const removeCase = useCallback(
    (index: number) => {
      onUpdate({ cases: cases.filter((_, i) => i !== index) });
    },
    [cases, onUpdate],
  );

  const updateCase = useCallback(
    (index: number, updated: SwitchCase) => {
      onUpdate({
        cases: cases.map((c, i) => (i === index ? updated : c)),
      });
    },
    [cases, onUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>Switch 配置</SectionTitle>

      <Form.Item label="匹配字段" style={{ marginBottom: spacing[2] as string }}>
        <Input
          value={data.field}
          onChange={(e) => onUpdate({ field: e.target.value })}
          placeholder="输入字段路径"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <SectionTitle>分支 Case</SectionTitle>

      {cases.map((c, index) => (
        <DynamicRow key={index}>
          <DynamicRowField>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] as string }}>
              <Input
                value={c.label}
                onChange={(e) => updateCase(index, { ...c, label: e.target.value })}
                placeholder="分支标签"
                size="small"
                style={LIGHT_SELECT_STYLE}
              />
              <div style={{ display: 'flex', gap: spacing[1] as string }}>
                <Select
                  value={c.operator}
                  onChange={(val) => updateCase(index, { ...c, operator: val })}
                  size="small"
                  options={CONDITION_OPERATORS}
                  style={{ width: '50%', ...LIGHT_SELECT_STYLE }}
                />
                <Input
                  value={c.value}
                  onChange={(e) => updateCase(index, { ...c, value: e.target.value })}
                  placeholder="值"
                  size="small"
                  style={{ width: '50%', ...LIGHT_SELECT_STYLE }}
                />
              </div>
            </div>
          </DynamicRowField>
          <DeleteRowButton
            type="text"
            danger
            size="small"
            icon={<MinusCircleOutlined />}
            onClick={() => removeCase(index)}
          />
        </DynamicRow>
      ))}
      <AddRowButton
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={addCase}
      >
        添加 Case
      </AddRowButton>
    </div>
  );
};

/* ================================================================
 *  Loop Form
 * ================================================================ */

interface LoopFormProps {
  data: LoopNodeData;
  onUpdate: (partial: Partial<LoopNodeData>) => void;
}

const LoopForm: React.FC<LoopFormProps> = ({ data, onUpdate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>循环配置</SectionTitle>

      <Form.Item label="循环类型" style={{ marginBottom: spacing[2] as string }}>
        <Radio.Group
          value={data.loopType}
          onChange={(e) => onUpdate({ loopType: e.target.value })}
          size="small"
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="count">固定次数</Radio.Button>
          <Radio.Button value="iterate">遍历列表</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {data.loopType === 'count' && (
        <Form.Item label="循环次数" style={{ marginBottom: spacing[2] as string }}>
          <InputNumber
            value={data.count}
            onChange={(val) => onUpdate({ count: val ?? 10 })}
            min={1}
            max={10000}
            size="small"
            style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
          />
        </Form.Item>
      )}

      {data.loopType === 'iterate' && (
        <Form.Item label="列表路径" style={{ marginBottom: spacing[2] as string }}>
          <Input
            value={data.listPath}
            onChange={(e) => onUpdate({ listPath: e.target.value })}
            placeholder="例如: data.items"
            size="small"
            style={LIGHT_SELECT_STYLE}
          />
        </Form.Item>
      )}

      <Form.Item label="最大迭代次数" style={{ marginBottom: spacing[2] as string }}>
        <InputNumber
          value={data.maxIterations}
          onChange={(val) => onUpdate({ maxIterations: val ?? 100 })}
          min={1}
          max={100000}
          size="small"
          style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
        />
      </Form.Item>

      <Form.Item label="中断条件 (可选)" style={{ marginBottom: 0 }}>
        <Input
          value={data.breakCondition ?? ''}
          onChange={(e) => onUpdate({ breakCondition: e.target.value || undefined })}
          placeholder="例如: result.done === true"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  Wait Form
 * ================================================================ */

interface WaitFormProps {
  data: WaitNodeData;
  onUpdate: (partial: Partial<WaitNodeData>) => void;
}

const WaitForm: React.FC<WaitFormProps> = ({ data, onUpdate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>等待配置</SectionTitle>

      <Form.Item label="等待类型" style={{ marginBottom: spacing[2] as string }}>
        <Radio.Group
          value={data.waitType}
          onChange={(e) => onUpdate({ waitType: e.target.value })}
          size="small"
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="duration">固定时长</Radio.Button>
          <Radio.Button value="webhook">Webhook 回调</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {data.waitType === 'duration' && (
        <Form.Item label="等待时长 (秒)" style={{ marginBottom: 0 }}>
          <InputNumber
            value={data.duration}
            onChange={(val) => onUpdate({ duration: val ?? 60 })}
            min={1}
            max={86400}
            size="small"
            style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
          />
        </Form.Item>
      )}

      {data.waitType === 'webhook' && (
        <div
          style={{
            padding: spacing[3],
            background: '#f8fafc',
            borderRadius: 6,
            color: '#64748b',
            fontSize: typography.fontSize.sm,
          }}
        >
          工作流将在执行到此节点时暂停，等待外部 Webhook 回调后继续执行。
        </div>
      )}
    </div>
  );
};

/* ================================================================
 *  Cron Trigger Form
 * ================================================================ */

interface CronTriggerFormProps {
  data: CronTriggerNodeData;
  onUpdate: (partial: Partial<CronTriggerNodeData>) => void;
}

const CronTriggerForm: React.FC<CronTriggerFormProps> = ({ data, onUpdate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>定时配置</SectionTitle>

      <Form.Item label="Cron 表达式" style={{ marginBottom: spacing[2] as string }}>
        <Input
          value={data.cronExpression}
          onChange={(e) => onUpdate({ cronExpression: e.target.value })}
          placeholder="0 * * * *"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="时区" style={{ marginBottom: 0 }}>
        <Input
          value={data.timezone ?? 'UTC'}
          onChange={(e) => onUpdate({ timezone: e.target.value })}
          placeholder="UTC"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  Webhook Trigger Form
 * ================================================================ */

interface WebhookTriggerFormProps {
  data: WebhookTriggerNodeData;
  onUpdate: (partial: Partial<WebhookTriggerNodeData>) => void;
}

const WebhookTriggerForm: React.FC<WebhookTriggerFormProps> = ({ data, onUpdate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>Webhook 配置</SectionTitle>

      <Form.Item label="Method" style={{ marginBottom: spacing[2] as string }}>
        <Select
          value={data.method}
          onChange={(val) => onUpdate({ method: val as WebhookTriggerNodeData['method'] })}
          size="small"
          options={WEBHOOK_METHODS.map((m) => ({ label: m, value: m }))}
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="Path" style={{ marginBottom: 0 }}>
        <Input
          value={data.path}
          onChange={(e) => onUpdate({ path: e.target.value })}
          placeholder="/webhook/my-workflow"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  HTTP Request Form
 * ================================================================ */

interface HttpRequestFormProps {
  data: HttpRequestNodeData;
  onUpdate: (partial: Partial<HttpRequestNodeData>) => void;
}

const HttpRequestForm: React.FC<HttpRequestFormProps> = ({ data, onUpdate }) => {
  const [headersText, setHeadersText] = useState(
    () => JSON.stringify(data.headers ?? {}, null, 2),
  );

  const handleHeadersChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setHeadersText(text);
      try {
        const parsed = JSON.parse(text);
        onUpdate({ headers: parsed });
      } catch {
        // Allow user to keep editing; will validate on blur
      }
    },
    [onUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>HTTP 请求配置</SectionTitle>

      <div style={{ display: 'flex', gap: spacing[2] as string }}>
        <Form.Item label="Method" style={{ marginBottom: 0, width: '40%' }}>
          <Select
            value={data.method}
            onChange={(val) =>
              onUpdate({ method: val as HttpRequestNodeData['method'] })
            }
            size="small"
            options={HTTP_METHODS.map((m) => ({ label: m, value: m }))}
            style={LIGHT_SELECT_STYLE}
          />
        </Form.Item>
        <Form.Item label="URL" style={{ marginBottom: 0, width: '60%' }}>
          <Input
            value={data.url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://api.example.com"
            size="small"
            style={LIGHT_SELECT_STYLE}
          />
        </Form.Item>
      </div>

      <Form.Item label="Headers (JSON)" style={{ marginBottom: spacing[2] as string }}>
        <Input.TextArea
          value={headersText}
          onChange={handleHeadersChange}
          rows={3}
          style={{ ...LIGHT_SELECT_STYLE, fontFamily: typography.fontFamily.mono, fontSize: typography.fontSize.sm }}
        />
      </Form.Item>

      <Form.Item label="Body" style={{ marginBottom: spacing[2] as string }}>
        <Input.TextArea
          value={data.body ?? ''}
          onChange={(e) => onUpdate({ body: e.target.value })}
          rows={4}
          placeholder="请求体 (JSON / text)"
          style={{ ...LIGHT_SELECT_STYLE, fontFamily: typography.fontFamily.mono, fontSize: typography.fontSize.sm }}
        />
      </Form.Item>

      <Form.Item label="Timeout (秒)" style={{ marginBottom: 0 }}>
        <InputNumber
          value={data.timeout}
          onChange={(val) => onUpdate({ timeout: val ?? 30 })}
          min={1}
          max={3600}
          size="small"
          style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
        />
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  Code Form
 * ================================================================ */

interface CodeFormProps {
  data: CodeNodeData;
  onUpdate: (partial: Partial<CodeNodeData>) => void;
}

const CodeForm: React.FC<CodeFormProps> = ({ data, onUpdate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>代码配置</SectionTitle>

      <Form.Item label="Language" style={{ marginBottom: spacing[2] as string }}>
        <Select
          value={data.language}
          onChange={(val) =>
            onUpdate({ language: val as CodeNodeData['language'] })
          }
          size="small"
          options={CODE_LANGUAGES}
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="Code" style={{ marginBottom: spacing[2] as string }}>
        <Input.TextArea
          value={data.code}
          onChange={(e) => onUpdate({ code: e.target.value })}
          rows={10}
          placeholder="在此输入代码..."
          style={{
            ...LIGHT_SELECT_STYLE,
            fontFamily: typography.fontFamily.mono,
            fontSize: typography.fontSize.sm,
          }}
        />
      </Form.Item>

      <Form.Item label="Timeout (秒)" style={{ marginBottom: 0 }}>
        <InputNumber
          value={data.timeout}
          onChange={(val) => onUpdate({ timeout: val ?? 60 })}
          min={1}
          max={3600}
          size="small"
          style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
        />
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  Transform Form
 * ================================================================ */

interface TransformFormProps {
  data: TransformNodeData;
  onUpdate: (partial: Partial<TransformNodeData>) => void;
}

const TransformForm: React.FC<TransformFormProps> = ({ data, onUpdate }) => {
  const mappings: TransformMapping[] = data.mappings ?? [];

  const addMapping = useCallback(() => {
    onUpdate({ mappings: [...mappings, { targetVar: '', sourceExpression: '' }] });
  }, [mappings, onUpdate]);

  const removeMapping = useCallback(
    (index: number) => {
      onUpdate({ mappings: mappings.filter((_, i) => i !== index) });
    },
    [mappings, onUpdate],
  );

  const updateMapping = useCallback(
    (index: number, updated: TransformMapping) => {
      onUpdate({
        mappings: mappings.map((m, i) => (i === index ? updated : m)),
      });
    },
    [mappings, onUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>数据转换配置</SectionTitle>

      {mappings.map((m, index) => (
        <DynamicRow key={index}>
          <DynamicRowField>
            <div style={{ display: 'flex', gap: spacing[1] as string }}>
              <Input
                value={m.targetVar}
                onChange={(e) =>
                  updateMapping(index, { ...m, targetVar: e.target.value })
                }
                placeholder="目标变量"
                size="small"
                style={{ width: '50%', ...LIGHT_SELECT_STYLE }}
              />
              <Input
                value={m.sourceExpression}
                onChange={(e) =>
                  updateMapping(index, { ...m, sourceExpression: e.target.value })
                }
                placeholder="来源表达式"
                size="small"
                style={{ width: '50%', ...LIGHT_SELECT_STYLE }}
              />
            </div>
          </DynamicRowField>
          <DeleteRowButton
            type="text"
            danger
            size="small"
            icon={<MinusCircleOutlined />}
            onClick={() => removeMapping(index)}
          />
        </DynamicRow>
      ))}
      <AddRowButton
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={addMapping}
      >
        添加映射
      </AddRowButton>
    </div>
  );
};


/* ================================================================
 *  Notification Form
 * ================================================================ */

interface NotificationFormProps {
  data: NotificationNodeData;
  onUpdate: (partial: Partial<NotificationFormProps['data']>) => void;
}

const NotificationForm: React.FC<NotificationFormProps> = ({ data, onUpdate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>通知配置</SectionTitle>

      <Form.Item label="通知渠道 ID" style={{ marginBottom: 0 }}>
        <Input
          value={data.channel_id ?? ''}
          onChange={(e) => onUpdate({ channel_id: e.target.value })}
          placeholder="选择或输入渠道 ID"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="标题模板" style={{ marginBottom: 0 }}>
        <Input
          value={data.title_template ?? ''}
          onChange={(e) => onUpdate({ title_template: e.target.value })}
          placeholder="支持 {{var}} 模板变量"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="正文模板" style={{ marginBottom: 0 }}>
        <Input.TextArea
          value={data.body_template ?? ''}
          onChange={(e) => onUpdate({ body_template: e.target.value })}
          placeholder="支持 {{var}} 模板变量"
          rows={3}
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="通知级别" style={{ marginBottom: 0 }}>
        <Select
          value={data.level ?? 'info'}
          onChange={(val: 'info' | 'success' | 'warning' | 'error') => onUpdate({ level: val })}
          size="small"
          style={LIGHT_SELECT_STYLE}
          options={[
            { value: 'info', label: 'ℹ️ 信息' },
            { value: 'success', label: '✅ 成功' },
            { value: 'warning', label: '⚠️ 警告' },
            { value: 'error', label: '❌ 错误' },
          ]}
        />
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  Human Review Form
 * ================================================================ */

interface HumanFormProps {
  data: HumanNodeData;
  onUpdate: (partial: Partial<HumanFormProps['data']>) => void;
}

const HumanForm: React.FC<HumanFormProps> = ({ data, onUpdate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>人工审核配置</SectionTitle>

      <Form.Item label="审核标题" style={{ marginBottom: 0 }}>
        <Input
          value={data.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="请输入审核标题"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="描述说明" style={{ marginBottom: 0 }}>
        <Input.TextArea
          value={data.description ?? ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="给审核人的上下文说明"
          rows={3}
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="指派用户 ID" style={{ marginBottom: 0 }}>
        <Input
          value={data.assignee_id ?? ''}
          onChange={(e) => onUpdate({ assignee_id: e.target.value })}
          placeholder="可选，留空则不指定"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="超时时间（小时）" style={{ marginBottom: 0 }}>
        <InputNumber
          min={1}
          max={720}
          value={data.timeout_hours ?? 72}
          onChange={(val) => onUpdate({ timeout_hours: val ?? 72 })}
          size="small"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item label="要求评论" style={{ marginBottom: 0 }}>
        <Select
          value={data.require_comment ? 'yes' : 'no'}
          onChange={(val) => onUpdate({ require_comment: val === 'yes' })}
          size="small"
          style={LIGHT_SELECT_STYLE}
          options={[
            { value: 'no', label: '否' },
            { value: 'yes', label: '是 — 审核时必须填写评论' },
          ]}
        />
      </Form.Item>
    </div>
  );
};
/* ================================================================
 *  Sub Workflow Form
 * ================================================================ */

interface SubWorkflowFormProps {
  data: SubWorkflowNodeData;
  onUpdate: (partial: Partial<SubWorkflowNodeData>) => void;
}

const SubWorkflowForm: React.FC<SubWorkflowFormProps> = ({ data, onUpdate }) => {
  const params: SubWorkflowParamMapping[] = data.parameterMapping ?? [];
  const outputs: SubWorkflowOutputMapping[] = data.outputMappings ?? [];
  const [workflowList, setWorkflowList] = useState<Array<{ id: string; name: string }>>([]);
  const [listLoading, setListLoading] = useState(false);
  const [manualInput, setManualInput] = useState(false);

  // Fetch workflow list on mount
  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    workflowsApi
      .list()
      .then((res: any) => {
        if (cancelled) return;
        const items = res?.data?.items ?? res?.items ?? [];
        setWorkflowList(items.map((w: any) => ({ id: w.id, name: w.name })));
        if (items.length === 0) setManualInput(true);
      })
      .catch(() => {
        if (!cancelled) setManualInput(true);
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleWorkflowSelect = useCallback(
    (workflowId: string) => {
      const selected = workflowList.find((w) => w.id === workflowId);
      onUpdate({
        workflowId,
        workflowName: selected?.name,
      });
    },
    [workflowList, onUpdate],
  );

  // -- Param mappings --
  const addParam = useCallback(() => {
    onUpdate({ parameterMapping: [...params, { sourcePath: '', targetVar: '' }] });
  }, [params, onUpdate]);

  const removeParam = useCallback(
    (index: number) => {
      onUpdate({ parameterMapping: params.filter((_, i) => i !== index) });
    },
    [params, onUpdate],
  );

  const updateParam = useCallback(
    (index: number, updated: SubWorkflowParamMapping) => {
      onUpdate({ parameterMapping: params.map((p, i) => (i === index ? updated : p)) });
    },
    [params, onUpdate],
  );

  // -- Output mappings --
  const addOutput = useCallback(() => {
    onUpdate({ outputMappings: [...outputs, { sourceField: '', targetVar: '' }] });
  }, [outputs, onUpdate]);

  const removeOutput = useCallback(
    (index: number) => {
      onUpdate({ outputMappings: outputs.filter((_, i) => i !== index) });
    },
    [outputs, onUpdate],
  );

  const updateOutput = useCallback(
    (index: number, updated: SubWorkflowOutputMapping) => {
      onUpdate({ outputMappings: outputs.map((o, i) => (i === index ? updated : o)) });
    },
    [outputs, onUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>子工作流配置</SectionTitle>

      {/* Workflow selector */}
      {manualInput ? (
        <Form.Item label="Workflow ID" style={{ marginBottom: spacing[2] as string }}>
          <Input
            value={data.workflowId}
            onChange={(e) => onUpdate({ workflowId: e.target.value })}
            placeholder="输入工作流 ID"
            size="small"
            style={LIGHT_SELECT_STYLE}
          />
        </Form.Item>
      ) : (
        <Form.Item label="选择子工作流" style={{ marginBottom: spacing[2] as string }}>
          <div style={{ display: 'flex', gap: spacing[1] as string }}>
            <Select
              value={data.workflowId || undefined}
              onChange={handleWorkflowSelect}
              placeholder="选择工作流"
              size="small"
              loading={listLoading}
              showSearch
              optionFilterProp="label"
              options={workflowList.map((w) => ({ label: w.name, value: w.id }))}
              style={{ flex: 1, ...LIGHT_SELECT_STYLE }}
              popupMatchSelectWidth={false}
            />
            <Button size="small" onClick={() => setManualInput(true)} title="手动输入">
              编辑
            </Button>
          </div>
        </Form.Item>
      )}

      {!manualInput && data.workflowName && (
        <Form.Item label="工作流名称" style={{ marginBottom: spacing[2] as string }}>
          <Input value={data.workflowName} disabled size="small" style={LIGHT_SELECT_STYLE} />
        </Form.Item>
      )}

      <Form.Item label="执行模式" style={{ marginBottom: spacing[2] as string }}>
        <Radio.Group
          value={data.executionMode ?? 'sync'}
          onChange={(e) => onUpdate({ executionMode: e.target.value })}
          size="small"
        >
          <Radio.Button value="sync">同步等待</Radio.Button>
          <Radio.Button value="async">异步触发</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item label="失败策略" style={{ marginBottom: spacing[2] as string }}>
        <Select
          value={data.onError ?? 'stop'}
          onChange={(val) => onUpdate({ onError: val as SubWorkflowNodeData['onError'] })}
          size="small"
          style={LIGHT_SELECT_STYLE}
          options={[
            { value: 'stop', label: '停止工作流' },
            { value: 'skip', label: '跳过此节点' },
            { value: 'retry', label: '重试' },
          ]}
        />
      </Form.Item>

      <Form.Item label="最大嵌套深度" style={{ marginBottom: spacing[2] as string }}>
        <InputNumber
          value={data.maxDepth}
          onChange={(val) => onUpdate({ maxDepth: val ?? 5 })}
          min={1}
          max={20}
          size="small"
          style={{ width: '100%', ...LIGHT_SELECT_STYLE }}
        />
      </Form.Item>

      {/* Parameter mappings */}
      <SectionTitle>输入参数映射</SectionTitle>

      {params.map((p, index) => (
        <DynamicRow key={`param-${index}`}>
          <DynamicRowField>
            <div style={{ display: 'flex', gap: spacing[1] as string }}>
              <Input
                value={p.sourcePath}
                onChange={(e) => updateParam(index, { ...p, sourcePath: e.target.value })}
                placeholder="上游字段名"
                size="small"
                style={{ width: '50%', ...LIGHT_SELECT_STYLE }}
              />
              <Input
                value={p.targetVar}
                onChange={(e) => updateParam(index, { ...p, targetVar: e.target.value })}
                placeholder="子工作流参数"
                size="small"
                style={{ width: '50%', ...LIGHT_SELECT_STYLE }}
              />
            </div>
          </DynamicRowField>
          <DeleteRowButton
            type="text"
            danger
            size="small"
            icon={<MinusCircleOutlined />}
            onClick={() => removeParam(index)}
          />
        </DynamicRow>
      ))}
      <AddRowButton type="dashed" size="small" icon={<PlusOutlined />} onClick={addParam}>
        添加输入映射
      </AddRowButton>

      {/* Output mappings */}
      <SectionTitle>输出映射</SectionTitle>

      {outputs.map((o, index) => (
        <DynamicRow key={`out-${index}`}>
          <DynamicRowField>
            <div style={{ display: 'flex', gap: spacing[1] as string }}>
              <Input
                value={o.sourceField}
                onChange={(e) => updateOutput(index, { ...o, sourceField: e.target.value })}
                placeholder="子工作流输出字段"
                size="small"
                style={{ width: '50%', ...LIGHT_SELECT_STYLE }}
              />
              <Input
                value={o.targetVar}
                onChange={(e) => updateOutput(index, { ...o, targetVar: e.target.value })}
                placeholder="当前工作流变量"
                size="small"
                style={{ width: '50%', ...LIGHT_SELECT_STYLE }}
              />
            </div>
          </DynamicRowField>
          <DeleteRowButton
            type="text"
            danger
            size="small"
            icon={<MinusCircleOutlined />}
            onClick={() => removeOutput(index)}
          />
        </DynamicRow>
      ))}
      <AddRowButton type="dashed" size="small" icon={<PlusOutlined />} onClick={addOutput}>
        添加输出映射
      </AddRowButton>
    </div>
  );
};

/* ================================================================
 *  Output Form
 * ================================================================ */

interface OutputFormProps {
  data: OutputNodeData;
  onUpdate: (partial: Partial<OutputNodeData>) => void;
}

const OutputForm: React.FC<OutputFormProps> = ({ data, onUpdate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>输出配置</SectionTitle>

      <Form.Item label="格式" style={{ marginBottom: spacing[2] as string }}>
        <Select
          value={data.format}
          onChange={(val) =>
            onUpdate({ format: val as OutputNodeData['format'] })
          }
          size="small"
          options={OUTPUT_FORMATS}
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="Output Path (可选)" style={{ marginBottom: 0 }}>
        <Input
          value={data.outputPath ?? ''}
          onChange={(e) => onUpdate({ outputPath: e.target.value || undefined })}
          placeholder="例如: /outputs/result.json"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  Input Form
 * ================================================================ */

const INPUT_SOURCE_OPTIONS = [
  { value: 'project', label: '项目' },
  { value: 'task', label: '任务' },
  { value: 'manual', label: '手动输入' },
  { value: 'upstream', label: '上游数据' },
];

const SOURCE_FIELD_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  project: [
    { value: 'title', label: '项目名称' },
    { value: 'description', label: '项目描述' },
    { value: 'documents', label: '项目文档' },
  ],
  task: [
    { value: 'title', label: '任务标题' },
    { value: 'description', label: '任务描述' },
    { value: 'requirements', label: '需求规格' },
    { value: 'input_files', label: '输入文件' },
  ],
  manual: [],
  upstream: [],
};

interface InputFormProps {
  data: InputNodeData;
  onUpdate: (partial: Partial<InputNodeData>) => void;
}

const InputForm: React.FC<InputFormProps> = ({ data, onUpdate }) => {
  const source = data.source;
  const availableFields = SOURCE_FIELD_OPTIONS[source] ?? [];

  const handleSourceChange = useCallback(
    (newSource: InputNodeData['source']) => {
      const newFields = SOURCE_FIELD_OPTIONS[newSource]?.map((f) => f.value) ?? [];
      onUpdate({
        source: newSource,
        fields: newFields,
      });
    },
    [onUpdate],
  );

  const handleFieldsChange = useCallback(
    (checkedValues: string[]) => {
      onUpdate({ fields: checkedValues });
    },
    [onUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>输入配置</SectionTitle>

      <Form.Item label="数据来源" style={{ marginBottom: spacing[2] as string }}>
        <Radio.Group
          value={source}
          onChange={(e) => handleSourceChange(e.target.value)}
          size="small"
        >
          {INPUT_SOURCE_OPTIONS.map((opt) => (
            <Radio.Button key={opt.value} value={opt.value}>
              {opt.label}
            </Radio.Button>
          ))}
        </Radio.Group>
      </Form.Item>

      {availableFields.length > 0 && (
        <Form.Item label="提取字段" style={{ marginBottom: spacing[2] as string }}>
          <Checkbox.Group
            value={data.fields}
            onChange={handleFieldsChange}
            options={availableFields}
          />
        </Form.Item>
      )}

      {(source === 'project' || source === 'task') && (
        <Form.Item label="包含附件文件" style={{ marginBottom: spacing[2] as string }}>
          <Switch
            checked={data.includeFiles}
            onChange={(checked) => onUpdate({ includeFiles: checked })}
            size="small"
          />
        </Form.Item>
      )}

      <Form.Item
        label="组装模板（可选）"
        style={{ marginBottom: spacing[2] as string }}
        extra="用 {{ field }} 引用提取的字段"
      >
        <Input.TextArea
          value={data.template ?? ''}
          onChange={(e) => onUpdate({ template: e.target.value || undefined })}
          rows={3}
          placeholder="例如: 请根据 {{ title }} 和 {{ description }} 完成任务"
          style={{
            ...LIGHT_SELECT_STYLE,
            fontFamily: typography.fontFamily.mono,
            fontSize: typography.fontSize.sm,
          }}
        />
      </Form.Item>

      <Form.Item label="输出变量名" style={{ marginBottom: 0 }}>
        <Input
          value={data.outputAlias}
          onChange={(e) => onUpdate({ outputAlias: e.target.value })}
          placeholder="input"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  Context Output Form
 * ================================================================ */

const CONTEXT_OUTPUT_FIELD_OPTIONS = [
  { value: 'summary', label: '摘要 (summary)' },
  { value: 'notes', label: '备注 (notes)' },
  { value: 'context', label: '上下文 (context)' },
  { value: 'tags', label: '标签 (tags)' },
  { value: 'custom', label: '自定义 (custom)' },
];

interface ContextOutputFormProps {
  data: ContextOutputNodeData;
  onUpdate: (partial: Partial<ContextOutputNodeData>) => void;
}

const ContextOutputForm: React.FC<ContextOutputFormProps> = ({ data, onUpdate }) => {
  const targets: ContextOutputTarget[] = data.targets ?? [];

  const addTarget = useCallback(() => {
    onUpdate({
      targets: [...targets, { field: 'summary', source: '' }],
    });
  }, [targets, onUpdate]);

  const removeTarget = useCallback(
    (index: number) => {
      onUpdate({ targets: targets.filter((_, i) => i !== index) });
    },
    [targets, onUpdate],
  );

  const updateTarget = useCallback(
    (index: number, updated: ContextOutputTarget) => {
      onUpdate({
        targets: targets.map((t, i) => (i === index ? updated : t)),
      });
    },
    [targets, onUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>上下文输出配置</SectionTitle>

      {targets.map((t, index) => (
        <DynamicRow key={index}>
          <DynamicRowField>
            <div style={{ display: 'flex', gap: spacing[1] as string, marginBottom: spacing[1] as string }}>
              <Select
                value={t.field}
                onChange={(val) =>
                  updateTarget(index, { ...t, field: val as ContextOutputTarget['field'] })
                }
                size="small"
                options={CONTEXT_OUTPUT_FIELD_OPTIONS}
                style={{ width: '45%', ...LIGHT_SELECT_STYLE }}
              />
              <Input
                value={t.source}
                onChange={(e) => updateTarget(index, { ...t, source: e.target.value })}
                placeholder="数据来源（如 input.title）"
                size="small"
                style={{ width: '55%', ...LIGHT_SELECT_STYLE }}
              />
            </div>
            <Input
              value={t.template ?? ''}
              onChange={(e) => updateTarget(index, { ...t, template: e.target.value || undefined })}
              placeholder="格式模板（可选，用 {{ value }} 引用）"
              size="small"
              style={{ ...LIGHT_SELECT_STYLE, fontFamily: typography.fontFamily.mono, fontSize: typography.fontSize.sm }}
            />
          </DynamicRowField>
          <DeleteRowButton
            type="text"
            danger
            size="small"
            icon={<MinusCircleOutlined />}
            onClick={() => removeTarget(index)}
          />
        </DynamicRow>
      ))}
      <AddRowButton
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={addTarget}
      >
        添加输出目标
      </AddRowButton>

      <Form.Item label="追加模式" style={{ marginBottom: 0 }}>
        <Switch
          checked={data.appendMode}
          onChange={(checked) => onUpdate({ appendMode: checked })}
          size="small"
        />
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  Result Output Form
 * ================================================================ */

const RESULT_FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'plain_text', label: '纯文本' },
  { value: 'structured', label: '结构化 (JSON)' },
];

const ON_COMPLETE_OPTIONS = [
  { value: 'mark_done', label: '标记完成' },
  { value: 'mark_done_and_notify', label: '标记完成 + 通知' },
  { value: 'none', label: '不做操作' },
];

interface ResultOutputFormProps {
  data: ResultOutputNodeData;
  onUpdate: (partial: Partial<ResultOutputNodeData>) => void;
}

const ResultOutputForm: React.FC<ResultOutputFormProps> = ({ data, onUpdate }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>结果输出配置</SectionTitle>

      <Form.Item label="输出格式" style={{ marginBottom: spacing[2] as string }}>
        <Select
          value={data.outputFormat}
          onChange={(val) =>
            onUpdate({ outputFormat: val as ResultOutputNodeData['outputFormat'] })
          }
          size="small"
          options={RESULT_FORMAT_OPTIONS}
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="结果字段名" style={{ marginBottom: spacing[2] as string }}>
        <Input
          value={data.resultField}
          onChange={(e) => onUpdate({ resultField: e.target.value })}
          placeholder="result"
          size="small"
          style={LIGHT_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="完成后动作" style={{ marginBottom: 0 }}>
        <Radio.Group
          value={data.onComplete}
          onChange={(e) => onUpdate({ onComplete: e.target.value })}
          size="small"
        >
          {ON_COMPLETE_OPTIONS.map((opt) => (
            <Radio key={opt.value} value={opt.value}>
              {opt.label}
            </Radio>
          ))}
        </Radio.Group>
      </Form.Item>
    </div>
  );
};

/* ================================================================
 *  Node Icon Map
 * ================================================================ */

import {
  PlayCircleOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  FolderOpenOutlined,
  RobotOutlined,
  BranchesOutlined,
  ApartmentOutlined,
  ReloadOutlined,
  HourglassOutlined,
  ForkOutlined,
  GlobalOutlined,
  SendOutlined,
  SwapOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

import type { ReactNode } from 'react';

const NODE_ICON_MAP: Record<WorkflowNodeType, ReactNode> = {
  manual_trigger: <PlayCircleOutlined />,
  cron_trigger: <ClockCircleOutlined />,
  webhook_trigger: <ApiOutlined />,
  input: <FolderOpenOutlined />,
  agent: <RobotOutlined />,
  if: <BranchesOutlined />,
  switch: <ApartmentOutlined />,
  loop: <ReloadOutlined />,
  wait: <HourglassOutlined />,
  sub_workflow: <ForkOutlined />,
  http_request: <GlobalOutlined />,
  code: <CodeOutlined />,
  transform: <SwapOutlined />,
  output: <SendOutlined />,
  context_output: <FileTextOutlined />,
  result_output: <CheckCircleOutlined />,
  fork: <BranchesOutlined />,
  notification: <BellOutlined />,
  human: <UserOutlined />,
  join: <ApartmentOutlined />,
};

/* ================================================================
 *  Main NodeConfigPanel Component
 * ================================================================ */

interface NodeConfigPanelProps {
  agents?: Array<{ id: string; name: string }>;
}

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ agents }) => {
  const { nodes, selectedNodeIds, updateNodeData, removeNode, setSelectedNodeIds } =
    useWorkflowStore();
  const [advancedMode, setAdvancedMode] = useState(false);

  // Only show panel when exactly one node is selected
  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null;
    return nodes.find((n) => n.id === selectedNodeIds[0]) ?? null;
  }, [nodes, selectedNodeIds]);

  const nodeData = useMemo(
    () => (selectedNode ? (selectedNode.data as NodeData) : null),
    [selectedNode],
  );

  const nodeType = useMemo(
    () =>
      selectedNode?.type as WorkflowNodeType | undefined,
    [selectedNode],
  );

  const meta = useMemo(
    () => (nodeType ? nodeMetaRegistry[nodeType] : null),
    [nodeType],
  );

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedNode) {
        updateNodeData(selectedNode.id, { label: e.target.value });
      }
    },
    [selectedNode, updateNodeData],
  );

  const handleDelete = useCallback(() => {
    if (selectedNode) {
      removeNode(selectedNode.id);
      setSelectedNodeIds([]);
      void message.success('节点已删除');
    }
  }, [selectedNode, removeNode, setSelectedNodeIds]);

  const handleAdvancedChange = useCallback(
    (newData: Partial<NodeData>) => {
      if (selectedNode) {
        updateNodeData(selectedNode.id, newData);
      }
    },
    [selectedNode, updateNodeData],
  );

  // Reset advanced mode when node type changes
  useEffect(() => {
    setAdvancedMode(false);
  }, [selectedNode?.id]);

  if (!selectedNode || !nodeData || !nodeType || !meta) {
    return null;
  }

  const renderTypeSpecificForm = () => {
    switch (nodeType) {
      case 'agent':
        return (
          <AgentForm
            data={getTypedData<AgentNodeData>(nodeData)}
            agents={agents}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'if':
        return (
          <IfForm
            data={getTypedData<IfNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'switch':
        return (
          <SwitchForm
            data={getTypedData<SwitchNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'loop':
        return (
          <LoopForm
            data={getTypedData<LoopNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'wait':
        return (
          <WaitForm
            data={getTypedData<WaitNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'cron_trigger':
        return (
          <CronTriggerForm
            data={getTypedData<CronTriggerNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'webhook_trigger':
        return (
          <WebhookTriggerForm
            data={getTypedData<WebhookTriggerNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'input':
        return (
          <InputForm
            data={getTypedData<InputNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'http_request':
        return (
          <HttpRequestForm
            data={getTypedData<HttpRequestNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'code':
        return (
          <CodeForm
            data={getTypedData<CodeNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'transform':
        return (
          <TransformForm
            data={getTypedData<TransformNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'sub_workflow':
        return (
          <SubWorkflowForm
            data={getTypedData<SubWorkflowNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'output':
        return (
          <OutputForm
            data={getTypedData<OutputNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'context_output':
        return (
          <ContextOutputForm
            data={getTypedData<ContextOutputNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'result_output':
        return (
          <ResultOutputForm
            data={getTypedData<ResultOutputNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'notification':
        return (
          <NotificationForm
            data={getTypedData<NotificationNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'human':
        return (
          <HumanForm
            data={getTypedData<HumanNodeData>(nodeData)}
            onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
          />
        );
      case 'manual_trigger':
        return (
          <div
            style={{
              color: '#64748b',
              fontSize: typography.fontSize.sm,
              padding: spacing[2],
            }}
          >
            手动触发节点无需额外配置
          </div>
        );
      case 'fork':
        return (
          <Form layout="vertical" size="small">
            <Form.Item label="分发模式">
              <Select
                value={(nodeData as any).mode ?? 'broadcast'}
                onChange={(val) => updateNodeData(selectedNode.id, { mode: val } as any)}
                options={[
                  { value: 'broadcast', label: '广播（所有分支收到相同数据）' },
                  { value: 'distribute', label: '分发（每个分支收到不同数据）' },
                ]}
              />
            </Form.Item>
            <Form.Item label="分支数量">
              <InputNumber
                min={2}
                max={10}
                value={(nodeData as any).branchCount ?? 2}
                onChange={(val) => updateNodeData(selectedNode.id, { branchCount: val ?? 2 } as any)}
              />
            </Form.Item>
          </Form>
        );
      case 'join':
        return (
          <Form layout="vertical" size="small">
            <Form.Item label="等待模式">
              <Select
                value={(nodeData as any).mode ?? 'all'}
                onChange={(val) => updateNodeData(selectedNode.id, { mode: val } as any)}
                options={[
                  { value: 'all', label: '等待全部' },
                  { value: 'any', label: '任意一个完成' },
                ]}
              />
            </Form.Item>
            <Form.Item label="合并策略">
              <Select
                value={(nodeData as any).mergeStrategy ?? 'append'}
                onChange={(val) => updateNodeData(selectedNode.id, { mergeStrategy: val } as any)}
                options={[
                  { value: 'append', label: '追加（保留分支结构）' },
                  { value: 'merge', label: '合并（深度合并所有输出）' },
                ]}
              />
            </Form.Item>
            <Form.Item label="超时时间（秒）">
              <InputNumber
                min={10}
                max={86400}
                value={(nodeData as any).timeout ?? 3600}
                onChange={(val) => updateNodeData(selectedNode.id, { timeout: val ?? 3600 } as any)}
              />
            </Form.Item>
          </Form>
        );
      default:
        return null;
    }
  };

  return (
    <Panel>
      {/* Header: Icon + Type Label + Delete */}
      <PanelHeader>
        <PanelHeaderLeft>
          <NodeIconBadge $color={meta.color}>{NODE_ICON_MAP[nodeType]}</NodeIconBadge>
          <NodeTypeLabel>{meta.label}</NodeTypeLabel>
        </PanelHeaderLeft>
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={handleDelete}
        />
      </PanelHeader>

      {/* Body */}
      <PanelBody>
        {/* Label Input */}
        <Form.Item label="节点名称" style={{ marginBottom: spacing[2] as string }}>
          <Input
            value={nodeData.label}
            onChange={handleLabelChange}
            placeholder="输入节点名称"
            size="small"
            style={LIGHT_SELECT_STYLE}
          />
        </Form.Item>

        <Divider style={{ borderColor: '#e2e8f0', margin: `${spacing[1]} 0` }} />

        {/* Advanced Mode Toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing[2] as string }}>
          <Button
            type={advancedMode ? 'primary' : 'text'}
            size="small"
            icon={<EditOutlined />}
            onClick={() => setAdvancedMode((prev) => !prev)}
            ghost={advancedMode}
          >
            {advancedMode ? '表单模式' : 'JSON 模式'}
          </Button>
        </div>

        {advancedMode ? (
          <AdvancedJsonEditor data={nodeData} onChange={handleAdvancedChange} />
        ) : (
          renderTypeSpecificForm()
        )}
      </PanelBody>
    </Panel>
  );
};
