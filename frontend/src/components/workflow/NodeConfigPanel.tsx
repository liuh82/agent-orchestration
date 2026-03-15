import { Button, Form, Input, InputNumber, Select, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import type { WorkflowNodeType, WorkflowNodeData } from '@/types/workflow';

const Panel = styled.div`
  width: 300px;
  background: ${colors.surface.DEFAULT};
  border-left: 1px solid ${colors.border.DEFAULT};
  padding: ${spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]};
  overflow-y: auto;
`;

const PanelTitle = styled.div`
  font-size: ${typography.fontSize.base};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const { TextArea } = Input;

interface NodeConfigPanelProps {
  agents?: Array<{ id: string; name: string }>;
}

const NODE_CONFIG_FIELDS: Record<WorkflowNodeType, Array<{ name: string; label: string; type: string; required?: boolean }>> = {
  agent: [
    { name: 'agentId', label: '选择 Agent', type: 'select', required: true },
    { name: 'prompt', label: 'Prompt', type: 'textarea' },
    { name: 'timeout', label: '超时 (秒)', type: 'number' },
  ],
  condition: [
    { name: 'expression', label: '条件表达式', type: 'textarea', required: true },
    { name: 'trueLabel', label: 'True 分支标签', type: 'text' },
    { name: 'falseLabel', label: 'False 分支标签', type: 'text' },
  ],
  human: [
    { name: 'description', label: '审批说明', type: 'textarea' },
  ],
  parallel: [
    { name: 'branches', label: '分支数量', type: 'number' },
  ],
  transform: [
    { name: 'transformType', label: '转换类型', type: 'text' },
    { name: 'description', label: '转换描述', type: 'textarea' },
  ],
  notification: [
    { name: 'channelId', label: '通知通道 ID', type: 'text' },
    { name: 'message', label: '消息内容', type: 'textarea' },
  ],
  timer: [
    { name: 'cronExpression', label: 'Cron 表达式', type: 'text' },
    { name: 'interval', label: '间隔 (秒)', type: 'number' },
  ],
};

export const NodeConfigPanel = ({ agents }: NodeConfigPanelProps) => {
  const { nodes, selectedNodeId, updateNodeData, removeNode, setSelectedNodeId } = useWorkflowStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode || !selectedNodeId) return null;

  const nodeType = (selectedNode.data as WorkflowNodeData).nodeType as WorkflowNodeType;
  const fields = NODE_CONFIG_FIELDS[nodeType] ?? [];

  const handleValuesChange = (_: any, allValues: Record<string, any>) => {
    const configData: Partial<WorkflowNodeData> = {};
    for (const field of fields) {
      if (allValues[field.name] !== undefined) {
        configData[field.name as keyof WorkflowNodeData] = allValues[field.name];
      }
    }
    if (allValues.label) {
      configData.label = allValues.label;
    }
    updateNodeData(selectedNodeId, configData);
  };

  const handleDelete = () => {
    removeNode(selectedNodeId);
    setSelectedNodeId(null);
    void message.success('节点已删除');
  };

  const initialValues: Record<string, any> = {
    ...selectedNode.data,
    label: selectedNode.data.label,
  };

  return (
    <Panel>
      <PanelTitle>
        节点配置
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={handleDelete}
        />
      </PanelTitle>

      <Form
        layout="vertical"
        size="small"
        initialValues={initialValues}
        onValuesChange={handleValuesChange}
      >
        <Form.Item label="节点名称" name="label" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="输入节点名称" />
        </Form.Item>

        {fields.map((field) => {
          if (field.type === 'textarea') {
            return (
              <Form.Item key={field.name} label={field.label} name={field.name} rules={field.required ? [{ required: true }] : undefined}>
                <TextArea rows={3} placeholder={`输入${field.label}`} />
              </Form.Item>
            );
          }
          if (field.type === 'number') {
            return (
              <Form.Item key={field.name} label={field.label} name={field.name}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            );
          }
          if (field.type === 'select' && field.name === 'agentId' && agents) {
            return (
              <Form.Item key={field.name} label={field.label} name={field.name} rules={field.required ? [{ required: true }] : undefined}>
                <Select placeholder="选择 Agent" options={agents.map((a) => ({ label: a.name, value: a.id }))} />
              </Form.Item>
            );
          }
          return (
            <Form.Item key={field.name} label={field.label} name={field.name} rules={field.required ? [{ required: true }] : undefined}>
              <Input placeholder={`输入${field.label}`} />
            </Form.Item>
          );
        })}
      </Form>
    </Panel>
  );
};
