import { useState, useMemo, useCallback } from 'react';
import { useQuery } from 'react-query';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Card,
  Spin,
  Divider,
  Empty,
  Typography,
} from 'antd';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { typography } from '@/styles/tokens/typography';
import { workflowsApi } from '@/api/workflows';
import type { WorkflowDefinition, WorkflowNode, AgentNodeData } from '@/types/workflow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateProjectModalProps {
  open: boolean;
  onCancel: () => void;
  onCreated: (data: {
    name: string;
    description?: string;
    workflow_id?: string;
    config_overrides?: Record<string, Record<string, unknown>>;
  }) => void;
}

/** Per-node override state collected from the form */
interface NodeOverrides {
  [nodeId: string]: Record<string, unknown>;
}

/** Config-overridable fields from an agent node */
interface ConfigField {
  key: string;
  value: unknown;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Human-readable labels for well-known agent node config keys */
const AGENT_FIELD_LABELS: Record<string, string> = {
  prompt: 'Prompt',
  model: 'Model',
  temperature: 'Temperature',
  maxTokens: 'Max Tokens',
  timeout: 'Timeout',
  agentId: 'Agent ID',
  agentType: 'Agent Type',
};

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const StyledSectionTitle = styled(Typography.Text)`
  display: block;
  font-size: ${typography.fontSize.md};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  margin-bottom: ${spacing[2]};
`;

const OverridesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[3]};
  margin-top: ${spacing[3]};
`;

const NodeCard = styled(Card)`
  background: ${colors.surface.raised};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};

  .ant-card-head {
    min-height: auto;
    padding: 0 ${spacing[4]};
    border-bottom: 1px solid ${colors.border.DEFAULT};

    .ant-card-head-title {
      font-size: ${typography.fontSize.base};
      font-weight: ${typography.fontWeight.medium};
      color: ${colors.text.primary};
      padding: ${spacing[3]} 0;
    }
  }

  .ant-card-body {
    padding: ${spacing[4]};
  }
`;

const ConfigFieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[1]};

  &:not(:last-child) {
    margin-bottom: ${spacing[2]};
  }
`;

const ConfigFieldLabel = styled(Typography.Text)`
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.secondary};
`;

const EmptyOverrides = styled.div`
  padding: ${spacing[6]} 0;
  text-align: center;
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract overridable config fields from an agent node's data. */
function extractConfigFields(nodeData: Record<string, unknown>): ConfigField[] {
  return Object.entries(nodeData)
    .filter(([key]) => key !== 'label')
    .map(([key, value]) => ({
      key,
      value,
      label: AGENT_FIELD_LABELS[key] ?? key,
    }));
}

/** Render the appropriate input for a config field value. */
function renderConfigInput(
  field: ConfigField,
  nodeId: string,
  overrides: NodeOverrides,
  onOverrideChange: (nodeId: string, key: string, value: unknown) => void,
) {
  const currentValue = (overrides[nodeId]?.[field.key] ?? field.value) as unknown;

  if (typeof field.value === 'number') {
    return (
      <InputNumber
        value={currentValue as number}
        onChange={(val) => onOverrideChange(nodeId, field.key, val)}
        style={{ width: '100%' }}
        size="small"
      />
    );
  }

  return (
    <Input
      value={currentValue as string}
      onChange={(e) => onOverrideChange(nodeId, field.key, e.target.value)}
      placeholder={`Override ${field.label}`}
      size="small"
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  open,
  onCancel,
  onCreated,
}) => {
  const [form] = Form.useForm();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>();
  const [nodeOverrides, setNodeOverrides] = useState<NodeOverrides>({});

  // ── Workflow list ──
  const { data: workflowsRes, isLoading: workflowsLoading } = useQuery(
    'workflows-list',
    () => workflowsApi.list(),
    { enabled: open },
  );
  const workflows = ((workflowsRes as any)?.items ?? (workflowsRes as any)?.data?.items ?? (workflowsRes as any)?.data ?? []) as Array<{
    id: string;
    name: string;
  }>;

  // ── Workflow detail (fetch on selection) ──
  const { data: wfDetail, isLoading: wfDetailLoading } = useQuery(
    ['workflow-detail', selectedWorkflowId],
    () => workflowsApi.getById(selectedWorkflowId!),
    { enabled: !!selectedWorkflowId && open },
  );

  // ── Parse workflow definition ──
  const agentNodes = useMemo<WorkflowNode[]>(() => {
    if (!wfDetail?.data?.definition) return [];
    try {
      const definition: WorkflowDefinition = JSON.parse(wfDetail.data.definition);
      return (definition.nodes ?? []).filter((n) => n.type === 'agent');
    } catch {
      return [];
    }
  }, [wfDetail]);

  // ── Reset state when modal closes ──
  const handleCancel = useCallback(() => {
    setSelectedWorkflowId(undefined);
    setNodeOverrides({});
    form.resetFields();
    onCancel();
  }, [form, onCancel]);

  // ── Handle workflow selection change ──
  const handleWorkflowChange = useCallback((workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    setNodeOverrides({});
  }, []);

  // ── Update a single override value ──
  const handleOverrideChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      setNodeOverrides((prev) => ({
        ...prev,
        [nodeId]: {
          ...(prev[nodeId] ?? {}),
          [key]: value,
        },
      }));
    },
    [],
  );

  // ── Submit ──
  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const payload: Parameters<typeof onCreated>[0] = {
        name: values.name,
        description: values.description,
      };

      if (selectedWorkflowId) {
        payload.workflow_id = selectedWorkflowId;
      }

      // Only include overrides that actually differ from the original node config
      const cleanOverrides: Record<string, Record<string, unknown>> = {};
      for (const node of agentNodes) {
        const override = nodeOverrides[node.id];
        if (!override) continue;

        const changed: Record<string, unknown> = {};
        const nodeData = node.data as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(override)) {
          if (value !== nodeData[key]) {
            changed[key] = value;
          }
        }
        if (Object.keys(changed).length > 0) {
          cleanOverrides[node.id] = changed;
        }
      }

      if (Object.keys(cleanOverrides).length > 0) {
        payload.config_overrides = cleanOverrides;
      }

      onCreated(payload);
    } catch {
      // form.validateFields will display validation errors automatically
    }
  }, [form, selectedWorkflowId, agentNodes, nodeOverrides, onCreated]);

  // ── Workflow select options ──
  const workflowOptions = useMemo(
    () =>
      workflows.map((wf) => ({
        value: wf.id,
        label: wf.name,
      })),
    [workflows],
  );

  return (
    <Modal
      title="Create Project"
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="Create"
      cancelText="Cancel"
      destroyOnClose
      width={640}
      bodyStyle={{ padding: `${spacing[5]} ${spacing[6]}` }}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{
          name: '',
          description: '',
        }}
      >
        {/* Project name */}
        <Form.Item
          name="name"
          label="Project Name"
          rules={[{ required: true, message: 'Please enter a project name' }]}
        >
          <Input placeholder="Enter project name" maxLength={100} />
        </Form.Item>

        {/* Project description */}
        <Form.Item
          name="description"
          label="Description"
        >
          <Input.TextArea
            rows={3}
            placeholder="Enter project description (optional)"
            showCount
            maxLength={500}
          />
        </Form.Item>

        {/* Workflow association */}
        <Form.Item label="Workflow">
          <Select
            value={selectedWorkflowId}
            onChange={handleWorkflowChange}
            options={workflowOptions}
            placeholder="Select a workflow (optional)"
            loading={workflowsLoading}
            allowClear
            showSearch
            optionFilterProp="label"
            notFoundContent={
              workflowsLoading ? (
                <Spin size="small" />
              ) : (
                <span style={{ color: colors.text.muted }}>No workflows available</span>
              )
            }
          />
        </Form.Item>
      </Form>

      {/* Node config overrides section */}
      {selectedWorkflowId && (
        <>
          <Divider style={{ margin: `${spacing[4]} 0 ${spacing[3]}` }} />

          <StyledSectionTitle>
            Node Config Overrides
          </StyledSectionTitle>

          {wfDetailLoading && (
            <div style={{ textAlign: 'center', padding: spacing[8] }}>
              <Spin tip="Loading workflow..." />
            </div>
          )}

          {!wfDetailLoading && agentNodes.length === 0 && (
            <EmptyOverrides>
              <Empty
                description="No agent nodes found in this workflow"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </EmptyOverrides>
          )}

          {!wfDetailLoading && agentNodes.length > 0 && (
            <OverridesContainer>
              {agentNodes.map((node) => {
                const nodeData = node.data as AgentNodeData;
                const configFields = extractConfigFields(
                  node.data as unknown as Record<string, unknown>,
                );

                return (
                  <NodeCard
                    key={node.id}
                    size="small"
                    title={nodeData.label || `Node: ${node.id}`}
                  >
                    {configFields.length === 0 ? (
                      <Typography.Text type="secondary" style={{ fontSize: typography.fontSize.sm }}>
                        No configurable fields
                      </Typography.Text>
                    ) : (
                      configFields.map((field) => (
                        <ConfigFieldRow key={field.key}>
                          <ConfigFieldLabel>{field.label}</ConfigFieldLabel>
                          {renderConfigInput(
                            field,
                            node.id,
                            nodeOverrides,
                            handleOverrideChange,
                          )}
                        </ConfigFieldRow>
                      ))
                    )}
                  </NodeCard>
                );
              })}
            </OverridesContainer>
          )}
        </>
      )}
    </Modal>
  );
};
