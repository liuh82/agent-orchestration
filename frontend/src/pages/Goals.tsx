import { useEffect, useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form,
  Input, Select, Slider, DatePicker, message, Row, Col, Progress,
  Statistic, Empty
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useOrgStore } from '../stores/org';
import { Goal } from '../types';
import dayjs from 'dayjs';

const { Option } = Select;

export const GoalsPage = () => {
  const {
    goals,
    fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    alignGoal,
    loading
  } = useOrgStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [alignModalVisible, setAlignModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form] = Form.useForm();
  const [alignForm] = Form.useForm();

  useEffect(() => {
    fetchGoals();
  }, []);

  const showModal = (goal?: Goal) => {
    setEditingGoal(goal || null);
    if (goal) {
      form.setFieldsValue({
        ...goal,
        dueDate: goal.dueDate ? dayjs(goal.dueDate) : null,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD HH:mm:ss') : null,
      };
      if (editingGoal?.id) {
        await updateGoal(editingGoal.id, data);
        message.success('目标更新成功');
      } else {
        await createGoal(data);
        message.success('目标创建成功');
      }
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个目标吗？',
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteGoal(id);
        message.success('目标删除成功');
      },
    });
  };

  const showAlignModal = () => {
    setAlignModalVisible(true);
  };

  const handleAlignOk = async () => {
    try {
      const values = await alignForm.validateFields();
      await alignGoal(values);
      message.success('目标对齐成功');
      setAlignModalVisible(false);
      alignForm.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      draft: 'default',
      active: 'blue',
      completed: 'green',
      archived: 'gray',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      draft: '草稿',
      active: '进行中',
      completed: '已完成',
      archived: '已归档',
    };
    return textMap[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    const colorMap: Record<string, string> = {
      low: 'default',
      medium: 'blue',
      high: 'orange',
      urgent: 'red',
    };
    return colorMap[priority] || 'default';
  };

  const getPriorityText = (priority: string) => {
    const textMap: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
      urgent: '紧急',
    };
    return textMap[priority] || priority;
  };

  const columns = [
    {
      title: '目标标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => <Tag color={getPriorityColor(priority)}>{getPriorityText(priority)}</Tag>,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress
          percent={progress}
          size="small"
          status={progress === 100 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '负责人',
      dataIndex: 'ownerId',
      key: 'ownerId',
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string | null) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Goal) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => showModal(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
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

  // 统计数据
  const stats = {
    total: goals.length,
    active: goals.filter(g => g.status === 'active').length,
    completed: goals.filter(g => g.status === 'completed').length,
    avgProgress: goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
      : 0,
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>目标管理</h1>
        <Space>
          <Button icon={<ClockCircleOutlined />} onClick={showAlignModal}>
            目标对齐
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
            新增目标
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总目标数"
              value={stats.total}
              prefix={<PlusOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中"
              value={stats.active}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均进度"
              value={stats.avgProgress}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={goals}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          locale={{
            emptyText: <Empty description="暂无目标数据" />
          }}
        />
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingGoal?.id ? '编辑目标' : '创建目标'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="目标标题" rules={[{ required: true, message: '请输入目标标题' }]}>
            <Input placeholder="请输入目标标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入目标描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="类型" initialValue="objective">
                <Select>
                  <Option value="objective">目标 (Objective)</Option>
                  <Option value="key_result">关键结果 (OKR)</Option>
                  <Option value="milestone">里程碑 (Milestone)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" initialValue="medium">
                <Select>
                  <Option value="low">低</Option>
                  <Option value="medium">中</Option>
                  <Option value="high">高</Option>
                  <Option value="urgent">紧急</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ownerId" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <Select placeholder="请选择负责人">
              <Option value="user1">用户1</Option>
              <Option value="user2">用户2</Option>
              <Option value="user3">用户3</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dueDate" label="截止日期">
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
          <Form.Item name="progress" label="进度" initialValue={0}>
            <Slider
              marks={{
                0: '0%',
                25: '25%',
                50: '50%',
                75: '75%',
                100: '100%',
              }}
            />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签并回车" />
          </Form.Item>
          <Form.Item name="metrics" label="指标">
            <Select mode="tags" placeholder="输入指标并回车" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 目标对齐弹窗 */}
      <Modal
        title="目标对齐"
        open={alignModalVisible}
        onOk={handleAlignOk}
        onCancel={() => setAlignModalVisible(false)}
        width={500}
      >
        <Form form={alignForm} layout="vertical">
          <Form.Item
            name="parentId"
            label="父目标"
            rules={[{ required: true, message: '请选择父目标' }]}
          >
            <Select placeholder="选择父目标">
              {goals.map(goal => (
                <Option key={goal.id} value={goal.id}>{goal.title}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="childId"
            label="子目标"
            rules={[{ required: true, message: '请选择子目标' }]}
          >
            <Select placeholder="选择子目标">
              {goals.map(goal => (
                <Option key={goal.id} value={goal.id}>{goal.title}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="weight" label="权重" initialValue={1.0}>
            <Input type="number" step={0.1} min={0} max={1} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} placeholder="请输入对齐说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
