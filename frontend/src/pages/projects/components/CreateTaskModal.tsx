import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Radio,
  InputNumber,
  Collapse,
  Spin,
  Empty,
  Space,
  Typography,
} from 'antd';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { shadow } from '@/styles/tokens/shadow';
import { workflowsApi } from '@/api/workflows';
import type {
  TaskPriority,
  ScheduleConfig,
  TaskConfigOverride,
} from '@/types/task';
import type {
  WorkflowDefinition,
  WorkflowNode as WorkflowNodeTyped,
  AgentNodeData,
} from '@/types/workflow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScheduleType = 'immediate' | 'cron' | 'interval';

type ScheduleUnit = 'second' | 'minute' | 'hour' | 'day';

interface ScheduleUnitOption {
  label: string;
  value: ScheduleUnit;
  multiplier: number;
}

interface AgentNodeInfo {
  nodeId: string;
  label: string;
  data: AgentNodeData;
}

interface CreateTaskModalProps {
  open: boolean;
  onCancel: () => void;
  onCreated: (data: {
    name: string;
    description?: string;
    priority?: TaskPriority;
    workflow_id?: string;
    assigned_agent?: string;
    config_overrides?: Array<{
      workflow_node_id: string;
      agent_type_id?: string;
      config_override: Record<string, unknown>;
    }>;
    schedule?: ScheduleConfig;
  }) => void;
  /** Default workflow_id if creating task under a project with associated workflow */
  defaultWorkflowId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS: Array<{ label: string; value: TaskPriority }> = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'critical' },
];

const SCHEDULE_TYPE_OPTIONS: Array<{ label: string; value: ScheduleType }> = [
  { label: '立即执行', value: 'immediate' },
  { label: '定时执行', value: 'cron' },
  { label: '循环执行', value: 'interval' },
];

const SCHEDULE_UNIT_OPTIONS: ScheduleUnitOption[] = [
  { label: '秒 (1x)', value: 'second', multiplier: 1 },
  { label: '分 (60x)', value: 'minute', multiplier: 60 },
  { label: '时 (3600x)', value: 'hour', multiplier: 3600 },
  { label: '天 (86400x)', value: 'day', multiplier: 86400 },
];

/** Keys on AgentNodeData that should be exposed as configurable overrides */
const OVERRIDABLE_AGENT_FIELDS: Array<{
  key: keyof AgentNodeData;
  label: string;
  type: 'string' | 'number' | 'select';
  selectOptions?: Array<{ label: string; value: string }>;
}> = [
  { key: 'prompt', label: 'Prompt', type: 'string' },
  { key: 'model', label: '模型', type: 'string' },
  { key: 'temperature', label: 'Temperature', type: 'number' },
  { key: 'maxTokens', label: '最大 Token', type: 'number' },
  { key: 'timeout', label: '超时 (秒)', type: 'number' },
  { key: 'agentType', label: 'Agent 类型', type: 'string' },
];

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const StyledModal = styled(Modal)`
  .ant-modal-content {
    background: ${colors.surface.DEFAULT};
    border-radius: ${radius.xl};
    box-shadow: ${shadow.xl};
    overflow: hidden;
  }

  .ant-modal-header {
    border-bottom: 1px solid ${colors.border.DEFAULT};
    padding-bottom: ${spacing[4]};
    margin-bottom: 0;
  }

  .ant-modal-body {
    padding-top: ${spacing[5]};
    padding-bottom: ${spacing[6]};
  }

  .ant-modal-footer {
    border-top: 1px solid ${colors.border.DEFAULT};
    padding-top: ${spacing[4]};
  }
`;

const SectionTitle = styled(Typography.Text)`
  display: block;
  font-size: ${typography.fontSize.sm};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${typography.letterSpacing.wide};
  margin-bottom: ${spacing[3]};
  margin-top: ${spacing[5]};
`;

SectionTitle.displayName = 'SectionTitle';

const CronHelperText = styled(Typography.Text)`
  display: block;
  font-size: ${typography.fontSize.xs};
  color: ${colors.text.muted};
  margin-top: ${spacing[1]};
`;

CronHelperText.displayName = 'CronHelperText';

const OverrideSection = styled.div`
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
  padding: ${spacing[4]};
  background: ${colors.surface.raised};
  margin-top: ${spacing[3]};
`;

const NodeLabel = styled(Typography.Text)`
  font-size: ${typography.fontSize.base};
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.primary};
`;

NodeLabel.displayName = 'NodeLabel';

const NodeTypeBadge = styled.span<{ $color: string }>`
  display: inline-block;
  font-size: ${typography.fontSize.xs};
  font-weight: ${typography.fontWeight.medium};
  color: ${(p) => p.$color};
  background: ${(p) => `${p.$color}15`};
  padding: ${spacing[1]} ${spacing[2]};
  border-radius: ${radius.sm};
  margin-left: ${spacing[2]};
`;

const EmptyOverrideWrapper = styled.div`
  padding: ${spacing[6]} 0;
  text-align: center;
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract agent-type nodes from a parsed WorkflowDefinition */
function extractAgentNodes(definition: WorkflowDefinition): AgentNodeInfo[] {
  return definition.nodes
    .filter((node: WorkflowNodeTyped) => node.type === 'agent')
    .map((node: WorkflowNodeTyped) => ({
      nodeId: node.id,
      label: (node.data as AgentNodeData).label || node.id || '未命名节点',
      data: node.data as AgentNodeData,
    }));
}

/** Build the final ScheduleConfig from form values */
function buildScheduleConfig(
  type: ScheduleType,
  cronExpression: string,
  intervalValue: number,
  intervalUnit: ScheduleUnit,
): ScheduleConfig | undefined {
  if (type === 'immediate') {
    return { type: 'immediate' };
  }

  if (type === 'cron') {
    return {
      type: 'cron',
      cron_expression: cronExpression || undefined,
    };
  }

  // interval
  const unitOption = SCHEDULE_UNIT_OPTIONS.find((o) => o.value === intervalUnit);
  const multiplier = unitOption?.multiplier ?? 1;
  return {
    type: 'interval',
    interval_seconds: intervalValue * multiplier,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onCancel,
  onCreated,
  defaultWorkflowId,
}) => {
  const [form] = Form.useForm();

  // Form-driven state
  const scheduleType: ScheduleType = Form.useWatch('scheduleType', form) ?? 'immediate';
  const selectedWorkflowId: string | undefined = Form.useWatch('workflow_id', form);

  // Config overrides state (keyed by node id)
  const [configOverrides, setConfigOverrides] = useState<
    Record<string, Record<string, unknown>>
  >({});

  // ------ Fetch workflows for select dropdown ------
  const {
    data: workflowListData,
    isLoading: workflowsLoading,
  } = useQuery(
    ['workflows-list'],
    () => workflowsApi.list(),
    { enabled: open, staleTime: 60_000 },
  );

  const workflowOptions = useMemo(() => {
    const items = workflowListData?.data?.items ?? workflowListData?.data ?? workflowListData?.items ?? [];
    return (Array.isArray(items) ? items : []).map(
      (wf: { id: string; name: string }) => ({
        label: wf.name,
        value: wf.id,
      }),
    );
  }, [workflowListData]);

  // ------ Fetch workflow detail when a workflow is selected ------
  const {
    data: workflowDetailData,
    isLoading: workflowDetailLoading,
  } = useQuery(
    ['workflow-detail', selectedWorkflowId],
    () => workflowsApi.getById(selectedWorkflowId!),
    { enabled: !!selectedWorkflowId && open, staleTime: 30_000 },
  );

  // Parse definition and extract agent nodes
  const agentNodes = useMemo<AgentNodeInfo[]>(() => {
    if (!workflowDetailData?.data) return [];
    const raw = workflowDetailData.data.definition ?? workflowDetailData.data;
    if (typeof raw === 'string') {
      try {
        const parsed: WorkflowDefinition = JSON.parse(raw);
        return extractAgentNodes(parsed);
      } catch {
        return [];
      }
    }
    // Definition might already be parsed
    if (typeof raw === 'object' && raw.nodes) {
      return extractAgentNodes(raw as WorkflowDefinition);
    }
    return [];
  }, [workflowDetailData]);

  // ------ Config override handlers ------

  const handleConfigFieldChange = useCallback(
    (nodeId: string, fieldKey: string, value: unknown) => {
      setConfigOverrides((prev) => ({
        ...prev,
        [nodeId]: {
          ...(prev[nodeId] ?? {}),
          [fieldKey]: value,
        },
      }));
    },
    [],
  );

  // ------ Reset on modal open/close ------

  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      if (visible) {
        form.resetFields();
        form.setFieldsValue({
          priority: 'medium',
          scheduleType: 'immediate',
          intervalUnit: 'second',
          intervalValue: 60,
          cronExpression: '0 * * * *',
          workflow_id: defaultWorkflowId ?? undefined,
        });
        setConfigOverrides({});
      }
    },
    [form, defaultWorkflowId],
  );

  // ------ Submit ------

  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      // Build config_overrides array (only include nodes that have overrides)
      const overrides: TaskConfigOverride[] = Object.entries(configOverrides)
        .filter(([, overrideData]) => Object.keys(overrideData).length > 0)
        .map(([nodeId, overrideData]) => {
          const agentNode = agentNodes.find((n) => n.nodeId === nodeId);
          return {
            workflow_node_id: nodeId,
            agent_type_id: agentNode?.data?.agentType ?? undefined,
            config_override: overrideData,
          };
        });

      const schedule = buildScheduleConfig(
        values.scheduleType,
        values.cronExpression,
        values.intervalValue,
        values.intervalUnit,
      );

      onCreated({
        name: values.name,
        description: values.description || undefined,
        priority: values.priority,
        workflow_id: values.workflow_id || undefined,
        assigned_agent: values.assigned_agent || undefined,
        config_overrides: overrides.length > 0 ? overrides : undefined,
        schedule: schedule?.type !== 'immediate' ? schedule : undefined,
      });
    } catch {
      // Form validation failed, antd handles inline errors
    }
  };

  // ------ Render config overrides section ------

  const renderOverridePanels = () => {
    if (workflowDetailLoading) {
      return (
        <OverrideSection>
          <Spin size="small" />
          <Typography.Text
            style={{
              marginLeft: spacing[3],
              color: colors.text.muted,
              fontSize: typography.fontSize.sm,
            }}
          >
            正在加载工作流节点...
          </Typography.Text>
        </OverrideSection>
      );
    }

    if (agentNodes.length === 0) {
      return (
        <OverrideSection>
          <EmptyOverrideWrapper>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Typography.Text style={{ color: colors.text.muted, fontSize: typography.fontSize.sm }}>
                  该工作流中没有 Agent 节点
                </Typography.Text>
              }
            />
          </EmptyOverrideWrapper>
        </OverrideSection>
      );
    }

    const collapseItems = agentNodes.map((node) => ({
      key: node.nodeId,
      label: (
        <Space>
          <NodeLabel>{node.label}</NodeLabel>
          <NodeTypeBadge $color="#3b82f6">Agent</NodeTypeBadge>
        </Space>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
          {OVERRIDABLE_AGENT_FIELDS.map((field) => {
            const currentValue = node.data[field.key];
            const overrideValue = configOverrides[node.nodeId]?.[field.key];

            if (field.type === 'number') {
              return (
                <Form.Item
                  key={field.key}
                  label={field.label}
                  style={{ marginBottom: 0 }}
                  tooltip={`默认值: ${currentValue ?? '未设置'}`}
                >
                  <InputNumber
                    size="small"
                    style={{ width: '100%' }}
                    placeholder={`${currentValue ?? '未设置'}`}
                    value={overrideValue as number | undefined}
                    onChange={(val) =>
                      handleConfigFieldChange(node.nodeId, field.key, val)
                    }
                  />
                </Form.Item>
              );
            }

            return (
              <Form.Item
                key={field.key}
                label={field.label}
                style={{ marginBottom: 0 }}
                tooltip={`默认值: ${currentValue ?? '未设置'}`}
              >
                <Input
                  size="small"
                  placeholder={`${currentValue ?? '未设置'}`}
                  value={overrideValue as string | undefined}
                  onChange={(e) =>
                    handleConfigFieldChange(node.nodeId, field.key, e.target.value)
                  }
                />
              </Form.Item>
            );
          })}
        </div>
      ),
    }));

    return (
      <OverrideSection>
        <Collapse
          size="small"
          items={collapseItems}
          bordered={false}
          style={{ background: 'transparent' }}
        />
      </OverrideSection>
    );
  };

  // ------ Main render ------

  return (
    <StyledModal
      open={open}
      title="创建任务"
      onCancel={onCancel}
      onOk={handleOk}
      okText="创建"
      cancelText="取消"
      destroyOnClose
      width={640}
      afterOpenChange={handleAfterOpenChange}
      styles={{
        body: { maxHeight: '65vh', overflowY: 'auto' },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        size="middle"
        requiredMark="optional"
      >
        {/* ---- Basic Info ---- */}
        <SectionTitle>基本信息</SectionTitle>

        <Form.Item
          name="name"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="输入任务名称" maxLength={200} showCount />
        </Form.Item>

        <Form.Item name="description" label="任务描述">
          <Input.TextArea
            placeholder="输入任务描述（可选）"
            rows={3}
            maxLength={2000}
            showCount
          />
        </Form.Item>

        <Form.Item name="priority" label="优先级">
          <Select
            options={PRIORITY_OPTIONS}
            style={{ width: '100%' }}
            placeholder="选择优先级"
          />
        </Form.Item>

        {/* ---- Workflow & Agent ---- */}
        <SectionTitle>关联配置</SectionTitle>

        <Form.Item name="workflow_id" label="关联工作流">
          <Select
            options={workflowOptions}
            loading={workflowsLoading}
            style={{ width: '100%' }}
            placeholder="选择工作流（可选）"
            allowClear
            showSearch
            optionFilterProp="label"
            notFoundContent={
              workflowsLoading ? (
                <Spin size="small" />
              ) : (
                <Typography.Text style={{ color: colors.text.muted }}>
                  暂无工作流
                </Typography.Text>
              )
            }
          />
        </Form.Item>

        <Form.Item name="assigned_agent" label="指定 Agent">
          <Input placeholder="暂未开放，敬请期待" disabled />
        </Form.Item>

        {/* ---- Schedule ---- */}
        <SectionTitle>执行方式</SectionTitle>

        <Form.Item name="scheduleType" label="执行方式">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={SCHEDULE_TYPE_OPTIONS}
          />
        </Form.Item>

        {scheduleType === 'cron' && (
          <>
            <Form.Item
              name="cronExpression"
              label="Cron 表达式"
              rules={[{ required: true, message: '请输入 Cron 表达式' }]}
            >
              <Input placeholder="0 * * * *" />
            </Form.Item>
            <CronHelperText>
              例: 0 * * * * (每小时) / 0 0 * * * (每天) / */30 * * * * (每30分钟)
            </CronHelperText>
          </>
        )}

        {scheduleType === 'interval' && (
          <Form.Item label="循环间隔" required>
            <Space align="end" style={{ width: '100%' }}>
              <Form.Item
                name="intervalValue"
                noStyle
                rules={[{ required: true, message: '请输入间隔时间' }]}
                initialValue={60}
              >
                <InputNumber
                  min={1}
                  max={9999}
                  step={1}
                  style={{ width: 140 }}
                  placeholder="间隔"
                />
              </Form.Item>

              <Form.Item name="intervalUnit" noStyle initialValue="minute">
                <Select
                  style={{ width: 160 }}
                  options={SCHEDULE_UNIT_OPTIONS.map((opt) => ({
                    label: opt.label,
                    value: opt.value,
                  }))}
                />
              </Form.Item>
            </Space>
          </Form.Item>
        )}

        {/* ---- Node Config Overrides ---- */}
        {selectedWorkflowId && (
          <>
            <SectionTitle>节点配置覆盖</SectionTitle>
            <Typography.Text
              style={{
                display: 'block',
                fontSize: typography.fontSize.xs,
                color: colors.text.muted,
                marginBottom: spacing[3],
              }}
            >
              修改 Agent 节点的配置参数，留空则使用工作流中的默认值
            </Typography.Text>
            {renderOverridePanels()}
          </>
        )}
      </Form>
    </StyledModal>
  );
};
