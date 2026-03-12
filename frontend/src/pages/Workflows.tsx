import { useState } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useQuery } from 'react-query';
import { workflowsApi } from '../api/workflows';

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  engine: string;
  createdAt: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  engine: string;
}

interface WorkflowNode {
  id: string;
  type: string;
  x: number;
  y: number;
}

interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
}

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

// 工作流节点类型
const NODE_TYPES: Record<string, { name: string; color: string }> = {
  start: { name: '开始', color: '#52c41a' },
  task: { name: '任务', color: '#1890ff' },
  condition: { name: '条件判断', color: '#faad14' },
  approval: { name: '审批', color: '#722ed1' },
  end: { name: '结束', color: '#ff4d4f' },
};

export const WorkflowsPage = () => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | null>(null);

  // 使用 react-query 获取数据
  const { refetch: refetchWorkflows } = useQuery(
    'workflows',
    () => workflowsApi.getWorkflows().then(res => res.data),
    { onSuccess: (data: WorkflowDefinition[]) => setWorkflows(data) }
  );

  useQuery(
    'templates',
    () => workflowsApi.getTemplates().then(res => res.data),
    { onSuccess: (data: WorkflowTemplate[]) => setTemplates(data) }
  );

  const showModal = (workflow: WorkflowDefinition | null = null) => {
    setEditingWorkflow(workflow);
    setModalVisible(true);
  };

  const handleOk = async () => {
    // TODO: 实现工作流保存逻辑
    setModalVisible(false);
    message.success('工作流保存成功');
    refetchWorkflows();
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个工作流吗？',
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await workflowsApi.deleteWorkflow(id);
        message.success('工作流删除成功');
        refetchWorkflows();
      },
    });
  };

  const handleExecute = (workflow: WorkflowDefinition) => {
    Modal.confirm({
      title: '执行工作流',
      content: '确定要执行这个工作流吗？',
      okText: '确认',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          await workflowsApi.executeWorkflow(workflow.id);
          message.success('工作流执行已开始');
        } catch (error) {
          message.error('工作流执行失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '工作流名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '引擎',
      dataIndex: 'engine',
      key: 'engine',
      render: (engine: string) => (
        <Tag color={engine === 'lobster' ? 'green' : engine === 'openviking' ? 'blue' : 'default'}>
          {engine.toUpperCase()}
        </Tag>
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
      render: (_: unknown, record: WorkflowDefinition) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record)}
          >
            执行
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
            编辑
          </Button>
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

  const templateColumns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => category.toUpperCase(),
    },
    {
      title: '引擎',
      dataIndex: 'engine',
      key: 'engine',
    },
  ];

  const WorkflowEditor = () => {
    const [nodes, setNodes] = useState<WorkflowNode[]>([
      { id: '1', type: 'start', x: 100, y: 50 },
      { id: '2', type: 'task', x: 100, y: 150 },
      { id: '3', type: 'end', x: 100, y: 250 },
    ]);

    const [connections, setConnections] = useState<WorkflowConnection[]>([
      { id: '1-2', from: '1', to: '2' },
      { id: '2-3', from: '2', to: '3' },
    ]);

    const addNode = (type: string) => {
      const newNode = {
        id: `node-${Date.now()}`,
        type,
        x: 200,
        y: 100,
      };
      setNodes([...nodes, newNode]);
    };

    const deleteNode = (nodeId: string) => {
      setNodes(nodes.filter(node => node.id !== nodeId));
      setConnections(connections.filter(conn => conn.from !== nodeId && conn.to !== nodeId));
    };

    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h3>节点工具箱</h3>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {Object.entries(NODE_TYPES).map(([type, info]) => (
              <Button
                key={type}
                type="default"
                style={{ backgroundColor: info.color, color: 'white' }}
                onClick={() => addNode(type)}
              >
                {info.name}
              </Button>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', height: 500, border: '1px solid #d9d9d9', backgroundColor: '#fafafa' }}>
          {nodes.map((node) => (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                padding: '8px 16px',
                backgroundColor: NODE_TYPES[node.type].color,
                color: 'white',
                borderRadius: 4,
                cursor: 'move',
                userSelect: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {NODE_TYPES[node.type].name}
              <Button
                type="text"
                size="small"
                style={{ color: 'white', marginLeft: 8 }}
                onClick={() => deleteNode(node.id)}
              >
                ×
              </Button>
            </div>
          ))}

          {connections.map((conn) => (
            <svg
              key={conn.id}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              <line
                x1={nodes.find(n => n.id === conn.from)?.x || 0}
                y1={nodes.find(n => n.id === conn.from)?.y || 0}
                x2={nodes.find(n => n.id === conn.to)?.x || 0}
                y2={nodes.find(n => n.id === conn.to)?.y || 0}
                stroke={NODE_TYPES[nodes.find(n => n.id === conn.from)?.type || 'task'].color}
                strokeWidth={2}
                markerEnd="url(#arrowhead)"
              />
            </svg>
          ))}

          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={NODE_TYPES.task.color}
              />
            </marker>
          </defs>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>工作流管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
        >
          创建工作流
        </Button>
      </div>

      <Tabs defaultActiveKey="1">
        <TabPane tab="工作流" key="1">
          <Card>
            <Table
              columns={columns}
              dataSource={workflows}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条`,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="模板库" key="2">
          <Card>
            <Table
              columns={templateColumns}
              dataSource={templates}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条`,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="工作流编辑器" key="3">
          <Card>
            <WorkflowEditor />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={editingWorkflow ? '编辑工作流' : '创建工作流'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form layout="vertical">
          <Form.Item
            label="工作流名称"
            name="name"
            rules={[{ required: true, message: '请输入工作流名称' }]}
          >
            <Input placeholder="输入工作流名称" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ required: true, message: '请输入工作流描述' }]}
          >
            <TextArea rows={3} placeholder="输入工作流描述" />
          </Form.Item>

          <Form.Item
            label="工作流引擎"
            name="engine"
            rules={[{ required: true }]}
          >
            <Select placeholder="选择工作流引擎">
              <Option value="lobster">Lobster</Option>
              <Option value="openviking">OpenViking</Option>
              <Option value="temporal">Temporal</Option>
              <Option value="custom">Custom</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="配置（JSON）"
            name="config"
          >
            <TextArea
              rows={6}
              placeholder="输入配置，如：{ &quot;timeout&quot;: 3600 }"
            />
          </Form.Item>

          <Form.Item
            label="定义（JSON）"
            name="definition"
          >
            <TextArea
              rows={8}
              placeholder="输入工作流定义，如：{ &quot;nodes&quot;: [...], &quot;edges&quot;: [...] }"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};