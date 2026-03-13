import { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message,
  Tabs, Timeline, Badge, Drawer, Row, Col, Statistic, Empty
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  HistoryOutlined, BellOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { useOrgStore } from '../stores/org';
import { Approval, ApprovalHistory } from '../types';
import { PAGE_CONFIG } from '../config/constants';

const { TabPane } = Tabs;
const { Option } = Select;

export const ApprovalsPage = () => {
  const {
    approvals,
    fetchApprovals,
    createApproval,
    approveApproval,
    rejectApproval,
    loading
  } = useOrgStore();

  const [activeTab, setActiveTab] = useState('pending');
  const [modalVisible, setModalVisible] = useState(false);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<ApprovalHistory[]>([]);
  const [form] = Form.useForm();

  // 轮询刷新函数（使用 useCallback 确保引用稳定）
  const refreshApprovals = useCallback(() => {
    fetchApprovals(activeTab === 'all' ? undefined : activeTab);
  }, [activeTab, fetchApprovals]);

  useEffect(() => {
    refreshApprovals();
    // 设置轮询刷新（使用配置常量）
    const interval = setInterval(refreshApprovals, PAGE_CONFIG.APPROVALS.POLL_INTERVAL);
    // cleanup 函数确保组件卸载时清除定时器
    return () => clearInterval(interval);
  }, [refreshApprovals]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    fetchApprovals(key === 'all' ? undefined : key);
  };

  const showCreateModal = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleCreateOk = async () => {
    try {
      const values = await form.validateFields();
      await createApproval(values);
      message.success('审批创建成功');
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleApprove = async (id: string, comment?: string) => {
    await approveApproval(id, comment);
    message.success('已批准');
    fetchApprovals(activeTab === 'all' ? undefined : activeTab);
  };

  const handleReject = async (id: string, comment?: string) => {
    await rejectApproval(id, comment);
    message.success('已拒绝');
    fetchApprovals(activeTab === 'all' ? undefined : activeTab);
  };

  const showHistory = async (approval: Approval) => {
    setSelectedApproval(approval);
    setSelectedHistory(approval.approvalHistory || []);
    setHistoryDrawerVisible(true);
  };

  const showApproveModal = (approval: Approval) => {
    Modal.confirm({
      title: '确认批准',
      content: (
        <div>
          <p>确定要批准以下审批吗？</p>
          <p><strong>{approval.title}</strong></p>
        </div>
      ),
      okText: '批准',
      cancelText: '取消',
      onOk: () => handleApprove(approval.id),
    });
  };

  const showRejectModal = (approval: Approval) => {
    Modal.confirm({
      title: '确认拒绝',
      content: (
        <div>
          <p>确定要拒绝以下审批吗？</p>
          <p><strong>{approval.title}</strong></p>
        </div>
      ),
      okText: '拒绝',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => handleReject(approval.id),
    });
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'orange',
      approved: 'green',
      rejected: 'red',
      cancelled: 'gray',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      pending: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
      cancelled: '已取消',
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
      title: '审批标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>{getPriorityText(priority)}</Tag>
      ),
    },
    {
      title: '申请者',
      dataIndex: 'requesterId',
      key: 'requesterId',
    },
    {
      title: '审批人',
      dataIndex: 'approverIds',
      key: 'approverIds',
      render: (ids: string[]) => ids?.length || 0,
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string | null) => date || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Approval) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => showHistory(record)}
          >
            历史
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => showApproveModal(record)}
              >
                批准
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => showRejectModal(record)}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  // 统计数据
  const stats = {
    total: approvals.length,
    pending: approvals.filter(a => a.status === 'pending').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    rejected: approvals.filter(a => a.status === 'rejected').length,
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>审批中心</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={showCreateModal}>
          创建审批
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总审批数"
              value={stats.total}
              prefix={<BellOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审批"
              value={stats.pending}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已批准"
              value={stats.approved}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已拒绝"
              value={stats.rejected}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane
            tab={
              <span>
                待审批
                {stats.pending > 0 && <Badge count={stats.pending} />}
              </span>
            }
            key="pending"
          />
          <TabPane tab="已批准" key="approved" />
          <TabPane tab="已拒绝" key="rejected" />
          <TabPane tab="全部" key="all" />
        </Tabs>

        <Table
          columns={columns}
          dataSource={approvals}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          locale={{
            emptyText: <Empty description="暂无审批数据" />
          }}
        />
      </Card>

      {/* 创建审批弹窗 */}
      <Modal
        title="创建审批"
        open={modalVisible}
        onOk={handleCreateOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="审批标题" rules={[{ required: true, message: '请输入审批标题' }]}>
            <Input placeholder="请输入审批标题" />
          </Form.Item>
          <Form.Item name="type" label="审批类型" rules={[{ required: true }]}>
            <Select placeholder="请选择审批类型">
              <Option value="agent_create">Agent 创建</Option>
              <Option value="task_create">任务创建</Option>
              <Option value="workflow_create">工作流创建</Option>
              <Option value="budget_change">预算变更</Option>
              <Option value="goal_create">目标创建</Option>
            </Select>
          </Form.Item>
          <Form.Item name="content" label="审批内容" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="请输入审批内容（JSON格式）" />
          </Form.Item>
          <Form.Item name="requesterId" label="申请者" rules={[{ required: true }]}>
            <Select placeholder="请选择申请者">
              <Option value="user1">用户1</Option>
              <Option value="user2">用户2</Option>
            </Select>
          </Form.Item>
          <Form.Item name="approverIds" label="审批人" rules={[{ required: true }]}>
            <Select mode="multiple" placeholder="请选择审批人">
              <Option value="manager1">经理1</Option>
              <Option value="manager2">经理2</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              <Option value="low">低</Option>
              <Option value="medium">中</Option>
              <Option value="high">高</Option>
              <Option value="urgent">紧急</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 审批历史抽屉 */}
      <Drawer
        title="审批历史"
        placement="right"
        onClose={() => setHistoryDrawerVisible(false)}
        open={historyDrawerVisible}
        width={400}
      >
        {selectedApproval && (
          <div>
            <h3>{selectedApproval.title}</h3>
            <Timeline>
              {selectedHistory.map((item, index) => (
                <Timeline.Item key={index} color={item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'blue'}>
                  <p><strong>{item.actorName}</strong></p>
                  <p>{item.action}</p>
                  {item.comment && <p style={{ color: '#666' }}>{item.comment}</p>}
                  <p style={{ color: '#999', fontSize: 12 }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}
      </Drawer>
    </div>
  );
};
