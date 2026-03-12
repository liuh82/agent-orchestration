import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined, RedoOutlined } from '@ant-design/icons';
import { useTasksStore } from '../stores/tasks';
import { Task } from '../types';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const priorityColors = {
  low: 'default',
  medium: 'orange',
  high: 'yellow',
  critical: 'red',
};

const priorityLabels = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
};

const statusLabels = {
  pending: '待处理',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export const TasksPage = () => {
  const { tasks, loading, fetchTasks, createTask, updateTask, deleteTask, executeTask, pauseTask, resumeTask, cancelTask } = useTasksStore();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const showModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      form.setFieldsValue({
        title: task.title,
        description: task.description,
        priority: task.priority,
        input: task.input,
      });
    } else {
      setEditingTask(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingTask) {
        await updateTask(editingTask.id, values);
        message.success('任务更新成功');
      } else {
        await createTask(values);
        message.success('任务创建成功');
      }
      setModalVisible(false);
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个任务吗？',
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteTask(id);
        message.success('任务删除成功');
      },
    });
  };

  const handleExecute = async (id: string) => {
    await executeTask(id);
    message.success('任务执行已开始');
  };

  const handlePause = async (id: string) => {
    await pauseTask(id);
    message.success('任务已暂停');
  };

  const handleResume = async (id: string) => {
    await resumeTask(id);
    message.success('任务已恢复');
  };

  const handleCancel = async (id: string) => {
    Modal.confirm({
      title: '确认取消',
      content: '确定要取消这个任务吗？',
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await cancelTask(id);
        message.success('任务已取消');
      },
    });
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'completed' ? 'green' : status === 'failed' ? 'red' : status === 'running' ? 'blue' : 'default'}>
          {statusLabels[status as keyof typeof statusLabels]}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={priorityColors[priority as keyof typeof priorityColors]}>
          {priorityLabels[priority as keyof typeof priorityLabels]}
        </Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      render: (agentId: string) => agentId || '未分配',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Task) => (
        <Space size="middle">
          {record.status === 'pending' && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record.id)}
            >
              执行
            </Button>
          )}
          {record.status === 'running' && (
            <>
              <Button
                type="link"
                icon={<PauseCircleOutlined />}
                onClick={() => handlePause(record.id)}
              >
                暂停
              </Button>
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleCancel(record.id)}
              >
                取消
              </Button>
            </>
          )}
          {record.status === 'pending' && (
            <Button
              type="link"
              icon={<RedoOutlined />}
              onClick={() => handleResume(record.id)}
            >
              恢复
            </Button>
          )}
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

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>任务中心</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
        >
          创建任务
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={tasks}
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
        title={editingTask ? '编辑任务' : '创建任务'}
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
            label="任务名称"
            name="title"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="输入任务名称" />
          </Form.Item>

          <Form.Item
            label="任务描述"
            name="description"
            rules={[{ required: true, message: '请输入任务描述' }]}
          >
            <TextArea rows={4} placeholder="输入任务描述" />
          </Form.Item>

          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true }]}
          >
            <Select placeholder="选择优先级">
              <Option value="low">低</Option>
              <Option value="medium">中</Option>
              <Option value="high">高</Option>
              <Option value="critical">紧急</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="输入参数"
            name="input"
          >
            <TextArea
              rows={4}
              placeholder="输入 JSON 格式的参数，如：{&quot;prompt&quot;: &quot;编写一个Python脚本&quot;}"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};