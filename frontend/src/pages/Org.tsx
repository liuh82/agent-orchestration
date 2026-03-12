import { useEffect, useState } from 'react';
import {
  Card, Tabs, Table, Button, Space, Tag, Modal, Form,
  Input, Select, Tree, message, Drawer, Row, Col, Statistic
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ApartmentOutlined, UserOutlined, TeamOutlined, ProjectOutlined
} from '@ant-design/icons';
import { useOrgStore } from '../stores/org';
import { OrgNode, Role, Member, Goal } from '../types';

const { Option } = Select;
const { TabPane } = Tabs;

export const OrgPage = () => {
  const {
    orgNodes, orgChart, roles, members,
    fetchOrgNodes, fetchRoles, fetchMembers,
    createOrgNode, updateOrgNode, deleteOrgNode,
    createRole, updateRole, deleteRole,
    createMember, updateMember, deleteMember,
    loading
  } = useOrgStore();

  const [activeTab, setActiveTab] = useState('chart');
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrgNodes();
    fetchRoles();
    fetchMembers();
  }, []);

  const showModal = (item?: any, type: 'node' | 'role' | 'member' = 'node') => {
    setEditingItem(item || null);
    if (item) {
      form.setFieldsValue(item);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const showDrawer = (node: OrgNode) => {
    setSelectedNode(node);
    setDrawerVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem?.id) {
        if (activeTab === 'chart') updateOrgNode(editingItem.id, values);
        else if (activeTab === 'roles') updateRole(editingItem.id, values);
        else if (activeTab === 'members') updateMember(editingItem.id, values);
        message.success('更新成功');
      } else {
        if (activeTab === 'chart') createOrgNode(values);
        else if (activeTab === 'roles') createRole(values);
        else if (activeTab === 'members') createMember(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此项吗？',
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (activeTab === 'chart') deleteOrgNode(id);
        else if (activeTab === 'roles') deleteRole(id);
        else if (activeTab === 'members') deleteMember(id);
        message.success('删除成功');
      },
    });
  };

  const orgColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '职位', dataIndex: 'title', key: 'title' },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '层级', dataIndex: 'level', key: 'level' },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) =>
        active ? <Tag color="green">启用</Tag> : <Tag color="gray">禁用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: OrgNode) => (
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

  const roleColumns = [
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '角色代码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '权限数量', dataIndex: 'permissions', key: 'permissions', render: (p: string[]) => p?.length || 0 },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Role) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => showModal(record, 'role')}>
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

  const memberColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '职位', dataIndex: 'position', key: 'position' },
    { title: '角色数', dataIndex: 'roleIds', key: 'roleIds', render: (r: string[]) => r?.length || 0 },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) =>
        active ? <Tag color="green">启用</Tag> : <Tag color="gray">禁用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Member) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => showModal(record, 'member')}>
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
        <h1>组织架构管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
          新增
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="组织节点"
              value={orgNodes.length}
              prefix={<ApartmentOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="角色数"
              value={roles.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成员数"
              value={members.length}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃节点"
              value={orgNodes.filter(n => n.isActive).length}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="组织架构" key="chart">
            <Table
              columns={orgColumns}
              dataSource={orgNodes}
              rowKey="id"
              loading={loading}
              onRow={(record) => ({ onClick: () => showDrawer(record) })}
              style={{ cursor: 'pointer' }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </TabPane>
          <TabPane tab="角色管理" key="roles">
            <Table
              columns={roleColumns}
              dataSource={roles}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </TabPane>
          <TabPane tab="成员管理" key="members">
            <Table
              columns={memberColumns}
              dataSource={members}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingItem?.id ? '编辑' : '创建'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          {activeTab === 'chart' && (
            <>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="请输入名称" />
              </Form.Item>
              <Form.Item name="title" label="职位" rules={[{ required: true, message: '请输入职位' }]}>
                <Input placeholder="请输入职位" />
              </Form.Item>
              <Form.Item name="department" label="部门" rules={[{ required: true, message: '请输入部门' }]}>
                <Input placeholder="请输入部门" />
              </Form.Item>
              <Form.Item name="parentId" label="上级节点">
                <Select placeholder="选择上级节点（可选）" allowClear>
                  {orgNodes.map(node => (
                    <Option key={node.id} value={node.id}>{node.name}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
              <Form.Item name="phone" label="电话">
                <Input placeholder="请输入电话" />
              </Form.Item>
            </>
          )}
          {activeTab === 'roles' && (
            <>
              <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
                <Input placeholder="请输入角色名称" />
              </Form.Item>
              <Form.Item name="code" label="角色代码" rules={[{ required: true, message: '请输入角色代码' }]}>
                <Input placeholder="请输入角色代码（大写字母和下划线）" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={3} placeholder="请输入描述" />
              </Form.Item>
              <Form.Item name="permissions" label="权限">
                <Select mode="tags" placeholder="请输入权限" />
              </Form.Item>
            </>
          )}
          {activeTab === 'members' && (
            <>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input placeholder="请输入姓名" />
              </Form.Item>
              <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }]}>
                <Input placeholder="请输入邮箱" />
              </Form.Item>
              <Form.Item name="phone" label="电话">
                <Input placeholder="请输入电话" />
              </Form.Item>
              <Form.Item name="position" label="职位" rules={[{ required: true, message: '请输入职位' }]}>
                <Input placeholder="请输入职位" />
              </Form.Item>
              <Form.Item name="roleIds" label="角色">
                <Select mode="multiple" placeholder="选择角色">
                  {roles.map(role => (
                    <Option key={role.id} value={role.id}>{role.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="节点详情"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={400}
      >
        {selectedNode && (
          <div>
            <p><strong>ID:</strong> {selectedNode.id}</p>
            <p><strong>名称:</strong> {selectedNode.name}</p>
            <p><strong>职位:</strong> {selectedNode.title}</p>
            <p><strong>部门:</strong> {selectedNode.department}</p>
            <p><strong>层级:</strong> {selectedNode.level}</p>
            <p><strong>邮箱:</strong> {selectedNode.email || '-'}</p>
            <p><strong>电话:</strong> {selectedNode.phone || '-'}</p>
            <p><strong>状态:</strong> {selectedNode.isActive ? '启用' : '禁用'}</p>
            <p><strong>子节点数:</strong> {selectedNode.childrenIds?.length || 0}</p>
          </div>
        )}
      </Drawer>
    </div>
  );
};
