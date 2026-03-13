import { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form,
  Input, Select, InputNumber, message, Row, Col, Statistic,
  Badge, Timeline, Drawer, Empty, Switch
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined,
  StopOutlined, HistoryOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ApiOutlined
} from '@ant-design/icons';
import { useHeartbeatsStore } from '../stores/heartbeats';
import { Heartbeat, HeartbeatLog, HeartbeatStats } from '../types';
import { PAGE_CONFIG } from '../config/constants';
import dayjs from 'dayjs';

const { Option } = Select;

export const HeartbeatsPage = () => {
  const {
    heartbeats, heartbeatLogs, stats, loading, error,
    fetchHeartbeats, fetchHeartbeatStats, createHeartbeat,
    updateHeartbeat, deleteHeartbeat, enableHeartbeat,
    disableHeartbeat, triggerHeartbeat, fetchHeartbeatLogs
  } = useHeartbeatsStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [logsDrawerVisible, setLogsDrawerVisible] = useState(false);
  const [selectedHeartbeat, setSelectedHeartbeat] = useState<Heartbeat | null>(null);
  const [editingHeartbeat, setEditingHeartbeat] = useState<Heartbeat | null>(null);
  const [form] = Form.useForm();

  // 轮询刷新函数（使用 useCallback 确保引用稳定）
  const refreshData = useCallback(() => {
    fetchHeartbeats();
    fetchHeartbeatStats();
  }, [fetchHeartbeats, fetchHeartbeatStats]);

  useEffect(() => {
    refreshData();
    // 设置轮询刷新（使用配置常量）
    const interval = setInterval(refreshData, PAGE_CONFIG.HEARTBEATS.POLL_INTERVAL);
    // cleanup 函数确保组件卸载时清除定时器
    return () => clearInterval(interval);
  }, [refreshData]);

  const showModal = (heartbeat?: Heartbeat) => {
    setEditingHeartbeat(heartbeat || null);
    if (heartbeat) {
      form.setFieldsValue(heartbeat);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingHeartbeat?.id) {
        await updateHeartbeat(editingHeartbeat.id, values);
        message.success('心跳更新成功');
      } else {
        await createHeartbeat(values);
        message.success('心跳创建成功');
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
      content: '确定要删除这个心跳配置吗？',
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteHeartbeat(id);
        message.success('心跳删除成功');
      },
    });
  };

  const handleToggle = async (heartbeat: Heartbeat) => {
    if (heartbeat.isActive) {
      await disableHeartbeat(heartbeat.id);
      message.success('心跳已禁用');
    } else {
      await enableHeartbeat(heartbeat.id);
      message.success('心跳已启用');
    }
  };

  const handleTrigger = async (heartbeat: Heartbeat) => {
    await triggerHeartbeat(heartbeat.id);
    message.success('心跳已触发');
  };

  const showLogs = async (heartbeat: Heartbeat) => {
    setSelectedHeartbeat(heartbeat);
    await fetchHeartbeatLogs(heartbeat.id);
    setLogsDrawerVisible(true);
  };

  const getActionTypeText = (type: string) => {
    const textMap: Record<string, string> = {
      check_agent_status: '检查Agent状态',
      send_reminder: '发送提醒',
      custom: '自定义',
    };
    return textMap[type] || type;
  };

  const getLogStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '操作类型',
      dataIndex: 'actionType',
      key: 'actionType',
      render: (type: string) => getActionTypeText(type),
    },
    {
      title: '间隔',
      dataIndex: 'intervalSeconds',
      key: 'intervalSeconds',
      render: (seconds: number) => `${seconds}秒`,
    },
    {
      title: '上次执行',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      render: (date: string | null) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '下次执行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      render: (date: string | null) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? '运行中' : '已禁用'}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Heartbeat) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => showLogs(record)}
          >
            日志
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleTrigger(record)}
          >
            触发
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
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

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>心跳配置</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
          新增心跳
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总配置数"
              value={stats?.total || 0}
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={stats?.active || 0}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已禁用"
              value={stats?.inactive || 0}
              prefix={<StopOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="24h失败"
              value={stats?.failed24h || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={heartbeats}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          locale={{
            emptyText: <Empty description="暂无心跳配置" />
          }}
        />
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingHeartbeat?.id ? '编辑心跳' : '创建心跳'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="请输入心跳名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="actionType" label="操作类型" rules={[{ required: true }]}>
            <Select placeholder="请选择操作类型">
              <Option value="check_agent_status">检查Agent状态</Option>
              <Option value="send_reminder">发送提醒</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>
          <Form.Item name="intervalSeconds" label="执行间隔（秒）" rules={[{ required: true, min: 10 }]}>
            <InputNumber
              min={10}
              style={{ width: '100%' }}
              placeholder="最小10秒"
            />
          </Form.Item>
          <Form.Item label="启用状态" name="isActive" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 执行日志抽屉 */}
      <Drawer
        title="执行日志"
        placement="right"
        onClose={() => setLogsDrawerVisible(false)}
        open={logsDrawerVisible}
        width={500}
      >
        {selectedHeartbeat && (
          <div>
            <h3>{selectedHeartbeat.name}</h3>
            <p><strong>操作类型:</strong> {getActionTypeText(selectedHeartbeat.actionType)}</p>
            <p><strong>执行间隔:</strong> {selectedHeartbeat.intervalSeconds}秒</p>

            <Timeline style={{ marginTop: 24 }}>
              {(heartbeatLogs[selectedHeartbeat.id] || []).map((log) => (
                <Timeline.Item key={log.id} dot={getLogStatusIcon(log.status)}>
                  <p><strong>{log.startedAt}</strong></p>
                  <Tag color={log.status === 'success' ? 'green' : log.status === 'failed' ? 'red' : 'blue'}>
                    {log.status}
                  </Tag>
                  {log.completedAt && <p style={{ color: '#999', fontSize: 12 }}>
                    耗时: {new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()}ms
                  </p>}
                  {log.errorMessage && (
                    <p style={{ color: '#ff4d4f', fontSize: 12 }}>
                      {log.errorMessage}
                    </p>
                  )}
                </Timeline.Item>
              ))}
            </Timeline>

            {(heartbeatLogs[selectedHeartbeat.id] || []).length === 0 && (
              <Empty description="暂无执行日志" style={{ marginTop: 16 }} />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
