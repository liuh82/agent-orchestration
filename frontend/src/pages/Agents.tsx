import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useAgentsStore } from '../stores/agents';
import { Agent } from '../types';

const { Option } = Select;

export const AgentsPage = () => {
  const { agents, loading, fetchAgents, createAgent, updateAgent, deleteAgent, startAgent, stopAgent } = useAgentsStore();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const showModal = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent);
      form.setFieldsValue({
        name: agent.name,
        type: agent.type,
        model: agent.model,
        timeout: agent.timeout,
        skills: agent.skills,
        capabilities: agent.capabilities,
      });
    } else {
      setEditingAgent(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingAgent) {
        await updateAgent(editingAgent.id, values);
        message.success('Agent 更新成功');
      } else {
        await createAgent(values);
        message.success('Agent 创建成功');
      }
      setModalVisible(false);
    } catch (error) {
      console.error('Failed to save agent:', error);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个 Agent 吗？',
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteAgent(id);
        message.success('Agent 删除成功');
      },
    });
  };

  const handleStart = async (id: string) => {
    await startAgent(id);
    message.success('Agent 已启动');
  };

  const handleStop = async (id: string) => {
    await stopAgent(id);
    message.success('Agent 已停止');
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => type.toUpperCase(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap = {
          online: { color: 'green', text: '在线' },
          offline: { color: 'gray', text: '离线' },
          busy: { color: 'blue', text: '忙碌' },
        };
        const { color, text } = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: '超时设置',
      dataIndex: 'timeout',
      key: 'timeout',
      render: (timeout: number) => `${timeout}s`,
    },
    {
      title: '技能',
      dataIndex: 'skills',
      key: 'skills',
      render: (skills: string[]) => (
        <div>
          {skills.slice(0, 2).map(skill => (
            <Tag key={skill} style={{ marginBottom: 4 }}>{skill}</Tag>
          ))}
          {skills.length > 2 && <span style={{ marginLeft: 4 }}>+{skills.length - 2}</span>}
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Agent) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
            编辑
          </Button>
          {record.status === 'online' && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record.id)}
            >
              启动
            </Button>
          )}
          {record.status === 'busy' && (
            <Button
              type="link"
              icon={<PauseCircleOutlined />}
              onClick={() => handleStop(record.id)}
            >
              停止
            </Button>
          )}
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Agent 管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
        >
          创建 Agent
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={agents}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingAgent ? '编辑 Agent' : '创建 Agent'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="Agent 名称"
            name="name"
            rules={[{ required: true, message: '请输入 Agent 名称' }]}
          >
            <Input placeholder="输入 Agent 名称" />
          </Form.Item>

          <Form.Item
            label="类型"
            name="type"
            rules={[{ required: true }]}
          >
            <Select placeholder="选择 Agent 类型">
              <Option value="claude-code">Claude Code</Option>
              <Option value="custom">Custom</Option>
              <Option value="lobster">Lobster</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="模型"
            name="model"
            rules={[{ required: true }]}
          >
            <Select placeholder="选择模型">
              <Option value="claude-3-opus">Claude 3 Opus</Option>
              <Option value="claude-3-sonnet">Claude 3 Sonnet</Option>
              <Option value="claude-3-haiku">Claude 3 Haiku</Option>
              <Option value="gpt-4">GPT-4</Option>
              <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="超时时间（秒）"
            name="timeout"
            rules={[{ required: true, type: 'number', min: 1 }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="技能"
            name="skills"
          >
            <Select
              mode="tags"
              placeholder="输入技能标签"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="能力"
            name="capabilities"
          >
            <Select
              mode="tags"
              placeholder="输入能力标签"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};