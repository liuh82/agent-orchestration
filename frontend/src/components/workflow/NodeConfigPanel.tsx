import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Slider,
  message,
} from 'antd';
import {
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import type {
  WorkflowNodeType,
  NodeData,
  AgentNodeData,
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
  OutputNodeData,
  ConditionOperator,
  ConditionRule,
  SwitchCase,
  TransformMapping,
  SubWorkflowParamMapping,
} from '@/types/workflow';
import { NODE_META as nodeMetaRegistry } from '@/types/workflow';

/* ================================================================
 *  Styled Components (Dark Theme)
 * ================================================================ */

const Panel = styled.div`
  width: 360px;
  min-width: 360px;
  background: #0f172a;
  border-left: 1px solid #334155;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

const PanelHeader = styled.div`
  padding: ${spacing[4]} ${spacing[4]} ${spacing[3]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #334155;
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
  color: #e2e8f0;
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
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: ${spacing[1]};
`;

const AdvancedJsonArea = styled(Input.TextArea)`
  font-family: ${typography.fontFamily.mono} !important;
  font-size: ${typography.fontSize.sm} !important;
  line-height: 1.6 !important;
  background: #1e293b !important;
  color: #e2e8f0 !important;
  border-color: #334155 !important;

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
 *  Ant Design Dark Overrides
 * ================================================================ */

const DARK_SELECT_STYLE: React.CSSProperties = {
  background: '#1e293b',
  borderColor: '#334155',
  color: '#e2e8f0',
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
        onUpdate({ agentId, label: data.label });
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
          onClick={() => setManualMode(false)}
          style={manualMode ? { background: '#1e293b', borderColor: '#334155', color: '#94a3b8' } : undefined}
        >
          选择 Agent
        </Button>
        <Button
          size="small"
          type={manualMode ? 'primary' : 'default'}
          onClick={() => setManualMode(true)}
          style={!manualMode ? { background: '#1e293b', borderColor: '#334155', color: '#94a3b8' } : undefined}
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
          style={DARK_SELECT_STYLE}
          popupMatchSelectWidth={false}
        />
      )}

      <Form.Item label="Prompt" style={{ marginBottom: spacing[2] as string }}>
        <Input.TextArea
          value={data.prompt}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
          rows={4}
          placeholder="输入 Prompt，支持 {{变量名}} 语法"
          style={DARK_SELECT_STYLE}
        />
      </Form.Item>

      {manualMode && (
        <Form.Item label="Model" style={{ marginBottom: spacing[2] as string }}>
          <Input
            value={data.model}
            onChange={(e) => onUpdate({ model: e.target.value })}
            placeholder="gpt-4, claude-3, etc."
            size="small"
            style={DARK_SELECT_STYLE}
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
          style={{ width: '100%', ...DARK_SELECT_STYLE }}
        />
      </Form.Item>

      <Form.Item label="Timeout (秒)" style={{ marginBottom: 0 }}>
        <InputNumber
          value={data.timeout}
          onChange={(val) => onUpdate({ timeout: val ?? 300 })}
          min={1}
          max={3600}
          size="small"
          style={{ width: '100%', ...DARK_SELECT_STYLE }}
        />
      </Form.Item>
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
                  style={DARK_SELECT_STYLE}
                />
                <Select
                  value={cond.operator}
                  onChange={(val) =>
                    updateCondition(index, { ...cond, operator: val })
                  }
                  size="small"
                  options={CONDITION_OPERATORS}
                  style={{ width: '100%', ...DARK_SELECT_STYLE }}
                />
                {!hideValue && (
                  <Input
                    value={cond.value}
                    onChange={(e) =>
                      updateCondition(index, { ...cond, value: e.target.value })
                    }
                    placeholder="值"
                    size="small"
                    style={DARK_SELECT_STYLE}
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
          style={DARK_SELECT_STYLE}
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
                style={DARK_SELECT_STYLE}
              />
              <div style={{ display: 'flex', gap: spacing[1] as string }}>
                <Select
                  value={c.operator}
                  onChange={(val) => updateCase(index, { ...c, operator: val })}
                  size="small"
                  options={CONDITION_OPERATORS}
                  style={{ width: '50%', ...DARK_SELECT_STYLE }}
                />
                <Input
                  value={c.value}
                  onChange={(e) => updateCase(index, { ...c, value: e.target.value })}
                  placeholder="值"
                  size="small"
                  style={{ width: '50%', ...DARK_SELECT_STYLE }}
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
            style={{ width: '100%', ...DARK_SELECT_STYLE }}
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
            style={DARK_SELECT_STYLE}
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
          style={{ width: '100%', ...DARK_SELECT_STYLE }}
        />
      </Form.Item>

      <Form.Item label="中断条件 (可选)" style={{ marginBottom: 0 }}>
        <Input
          value={data.breakCondition ?? ''}
          onChange={(e) => onUpdate({ breakCondition: e.target.value || undefined })}
          placeholder="例如: result.done === true"
          size="small"
          style={DARK_SELECT_STYLE}
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
            style={{ width: '100%', ...DARK_SELECT_STYLE }}
          />
        </Form.Item>
      )}

      {data.waitType === 'webhook' && (
        <div
          style={{
            padding: spacing[3],
            background: '#1e293b',
            borderRadius: 6,
            color: '#94a3b8',
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
          style={DARK_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="时区" style={{ marginBottom: 0 }}>
        <Input
          value={data.timezone ?? 'UTC'}
          onChange={(e) => onUpdate({ timezone: e.target.value })}
          placeholder="UTC"
          size="small"
          style={DARK_SELECT_STYLE}
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
          style={DARK_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="Path" style={{ marginBottom: 0 }}>
        <Input
          value={data.path}
          onChange={(e) => onUpdate({ path: e.target.value })}
          placeholder="/webhook/my-workflow"
          size="small"
          style={DARK_SELECT_STYLE}
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
            style={DARK_SELECT_STYLE}
          />
        </Form.Item>
        <Form.Item label="URL" style={{ marginBottom: 0, width: '60%' }}>
          <Input
            value={data.url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://api.example.com"
            size="small"
            style={DARK_SELECT_STYLE}
          />
        </Form.Item>
      </div>

      <Form.Item label="Headers (JSON)" style={{ marginBottom: spacing[2] as string }}>
        <Input.TextArea
          value={headersText}
          onChange={handleHeadersChange}
          rows={3}
          style={{ ...DARK_SELECT_STYLE, fontFamily: typography.fontFamily.mono, fontSize: typography.fontSize.sm }}
        />
      </Form.Item>

      <Form.Item label="Body" style={{ marginBottom: spacing[2] as string }}>
        <Input.TextArea
          value={data.body ?? ''}
          onChange={(e) => onUpdate({ body: e.target.value })}
          rows={4}
          placeholder="请求体 (JSON / text)"
          style={{ ...DARK_SELECT_STYLE, fontFamily: typography.fontFamily.mono, fontSize: typography.fontSize.sm }}
        />
      </Form.Item>

      <Form.Item label="Timeout (秒)" style={{ marginBottom: 0 }}>
        <InputNumber
          value={data.timeout}
          onChange={(val) => onUpdate({ timeout: val ?? 30 })}
          min={1}
          max={3600}
          size="small"
          style={{ width: '100%', ...DARK_SELECT_STYLE }}
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
          style={DARK_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="Code" style={{ marginBottom: spacing[2] as string }}>
        <Input.TextArea
          value={data.code}
          onChange={(e) => onUpdate({ code: e.target.value })}
          rows={10}
          placeholder="在此输入代码..."
          style={{
            ...DARK_SELECT_STYLE,
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
          style={{ width: '100%', ...DARK_SELECT_STYLE }}
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
                style={{ width: '50%', ...DARK_SELECT_STYLE }}
              />
              <Input
                value={m.sourceExpression}
                onChange={(e) =>
                  updateMapping(index, { ...m, sourceExpression: e.target.value })
                }
                placeholder="来源表达式"
                size="small"
                style={{ width: '50%', ...DARK_SELECT_STYLE }}
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
 *  Sub Workflow Form
 * ================================================================ */

interface SubWorkflowFormProps {
  data: SubWorkflowNodeData;
  onUpdate: (partial: Partial<SubWorkflowNodeData>) => void;
}

const SubWorkflowForm: React.FC<SubWorkflowFormProps> = ({ data, onUpdate }) => {
  const params: SubWorkflowParamMapping[] = data.parameterMapping ?? [];

  const addParam = useCallback(() => {
    onUpdate({
      parameterMapping: [...params, { sourcePath: '', targetVar: '' }],
    });
  }, [params, onUpdate]);

  const removeParam = useCallback(
    (index: number) => {
      onUpdate({
        parameterMapping: params.filter((_, i) => i !== index),
      });
    },
    [params, onUpdate],
  );

  const updateParam = useCallback(
    (index: number, updated: SubWorkflowParamMapping) => {
      onUpdate({
        parameterMapping: params.map((p, i) => (i === index ? updated : p)),
      });
    },
    [params, onUpdate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] as string }}>
      <SectionTitle>子工作流配置</SectionTitle>

      <Form.Item label="Workflow ID" style={{ marginBottom: spacing[2] as string }}>
        <Input
          value={data.workflowId}
          onChange={(e) => onUpdate({ workflowId: e.target.value })}
          placeholder="输入工作流 ID"
          size="small"
          style={DARK_SELECT_STYLE}
        />
      </Form.Item>

      {data.workflowName && (
        <Form.Item label="Workflow 名称" style={{ marginBottom: spacing[2] as string }}>
          <Input
            value={data.workflowName}
            disabled
            size="small"
            style={DARK_SELECT_STYLE}
          />
        </Form.Item>
      )}

      <Form.Item label="最大嵌套深度" style={{ marginBottom: spacing[2] as string }}>
        <InputNumber
          value={data.maxDepth}
          onChange={(val) => onUpdate({ maxDepth: val ?? 5 })}
          min={1}
          max={20}
          size="small"
          style={{ width: '100%', ...DARK_SELECT_STYLE }}
        />
      </Form.Item>

      <SectionTitle>参数映射</SectionTitle>

      {params.map((p, index) => (
        <DynamicRow key={index}>
          <DynamicRowField>
            <div style={{ display: 'flex', gap: spacing[1] as string }}>
              <Input
                value={p.sourcePath}
                onChange={(e) =>
                  updateParam(index, { ...p, sourcePath: e.target.value })
                }
                placeholder="来源路径"
                size="small"
                style={{ width: '50%', ...DARK_SELECT_STYLE }}
              />
              <Input
                value={p.targetVar}
                onChange={(e) =>
                  updateParam(index, { ...p, targetVar: e.target.value })
                }
                placeholder="目标变量"
                size="small"
                style={{ width: '50%', ...DARK_SELECT_STYLE }}
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
      <AddRowButton
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={addParam}
      >
        添加参数映射
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
          style={DARK_SELECT_STYLE}
        />
      </Form.Item>

      <Form.Item label="Output Path (可选)" style={{ marginBottom: 0 }}>
        <Input
          value={data.outputPath ?? ''}
          onChange={(e) => onUpdate({ outputPath: e.target.value || undefined })}
          placeholder="例如: /outputs/result.json"
          size="small"
          style={DARK_SELECT_STYLE}
        />
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
  RobotOutlined,
  BranchesOutlined,
  ApartmentOutlined,
  ReloadOutlined,
  HourglassOutlined,
  ForkOutlined,
  GlobalOutlined,
  SendOutlined,
  SwapOutlined,
} from '@ant-design/icons';

import type { ReactNode } from 'react';

const NODE_ICON_MAP: Record<WorkflowNodeType, ReactNode> = {
  manual_trigger: <PlayCircleOutlined />,
  cron_trigger: <ClockCircleOutlined />,
  webhook_trigger: <ApiOutlined />,
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
      case 'manual_trigger':
        return (
          <div
            style={{
              color: '#94a3b8',
              fontSize: typography.fontSize.sm,
              padding: spacing[2],
            }}
          >
            手动触发节点无需额外配置
          </div>
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
            style={DARK_SELECT_STYLE}
          />
        </Form.Item>

        <Divider style={{ borderColor: '#334155', margin: `${spacing[1]} 0` }} />

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
