import { useState } from 'react';
import { Button, Input, Modal, Form, Select, message, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { workflowsApi } from '@/api/workflows';

const { TextArea } = Input;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${spacing[3]} ${spacing[4]};
  background: ${colors.surface.DEFAULT};
  border-bottom: 1px solid ${colors.border.DEFAULT};
  gap: ${spacing[3]};
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
`;

const WorkflowName = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: ${colors.text.primary};
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

interface EditorToolbarProps {
  onSave?: () => void;
  isSaving?: boolean;
}

export const EditorToolbar = ({ onSave, isSaving }: EditorToolbarProps) => {
  const navigate = useNavigate();
  const { workflowId, workflowName, undo, redo } = useWorkflowStore();
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [executeForm] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [executing, setExecuting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const handleExecute = async () => {
    if (!workflowId) {
      void message.warning('请先保存工作流');
      return;
    }
    try {
      const values = await executeForm.validateFields();
      setExecuting(true);
      const res = await workflowsApi.execute(workflowId, { name: values.name });
      const executionId = res?.data?.id || res?.id;
      void message.success('流程已开始执行');
      setExecuteModalOpen(false);
      executeForm.resetFields();
      if (executionId) {
        navigate(`/workflows/monitor/${executionId}`);
      }
    } catch {
      void message.error('执行失败');
    } finally {
      setExecuting(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!workflowId) {
      void message.warning('请先保存工作流');
      return;
    }
    try {
      const values = await templateForm.validateFields();
      setSavingTemplate(true);
      await workflowsApi.saveAsTemplate({
        workflow_id: workflowId,
        name: values.name,
        description: values.description,
        category: values.category,
      });
      void message.success('模板保存成功');
      setTemplateModalOpen(false);
      templateForm.resetFields();
    } catch {
      void message.error('保存模板失败');
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <>
      <Toolbar>
        <Left>
          <Tooltip title="返回列表">
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/workflows')} />
          </Tooltip>
          <WorkflowName>{workflowName || '未命名工作流'}</WorkflowName>
        </Left>
        <Right>
          <Tooltip title="撤销 (Ctrl+Z)">
            <Button type="text" size="small" icon={<UndoOutlined />} onClick={undo} />
          </Tooltip>
          <Tooltip title="重做 (Ctrl+Shift+Z)">
            <Button type="text" size="small" icon={<RedoOutlined />} onClick={redo} />
          </Tooltip>
          <Button size="small" onClick={onSave} loading={isSaving} icon={<SaveOutlined />}>
            保存
          </Button>
          <Button size="small" type="primary" ghost icon={<SaveOutlined />} onClick={() => setTemplateModalOpen(true)}>
            保存为模板
          </Button>
          <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => setExecuteModalOpen(true)}>
            生成流程
          </Button>
        </Right>
      </Toolbar>

      {/* Execute Modal */}
      <Modal
        title="生成流程"
        open={executeModalOpen}
        onOk={handleExecute}
        onCancel={() => setExecuteModalOpen(false)}
        confirmLoading={executing}
        okText="开始执行"
        cancelText="取消"
      >
        <Form form={executeForm} layout="vertical">
          <Form.Item label="执行实例名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：v1.0.0 发布流程" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Save as Template Modal */}
      <Modal
        title="保存为模板"
        open={templateModalOpen}
        onOk={handleSaveTemplate}
        onCancel={() => setTemplateModalOpen(false)}
        confirmLoading={savingTemplate}
        okText="保存"
        cancelText="取消"
      >
        <Form form={templateForm} layout="vertical" initialValues={{ category: 'custom' }}>
          <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="例如：标准部署流程" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={3} placeholder="模板描述..." />
          </Form.Item>
          <Form.Item label="类别" name="category">
            <Select options={[
              { label: '开发', value: 'development' },
              { label: '部署', value: 'deployment' },
              { label: '自定义', value: 'custom' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
