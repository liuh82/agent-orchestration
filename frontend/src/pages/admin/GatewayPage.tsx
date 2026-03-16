import { useState } from 'react';
import {
  Table, Button, Tag, Select, Space, Popconfirm, Modal, message, Tooltip,
  Form, Input, InputNumber,
} from 'antd';
import {
  ReloadOutlined, EyeOutlined, DisconnectOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuthStore } from '@/stores/auth';
import api from '@/api/client';
import type { ColumnsType } from 'antd/es/table';

// --------------- Types ---------------
interface AvailableAdapter {
  type: string;
  agent_name: string;
  version: string;
}

interface Bridge {
  id: number;
  bridge_id: string;
  name?: string;
  bridge_type?: string;
  host?: string;
  port?: number;
  protocol?: string;
  auth_config?: Record<string, unknown>;
  platform: string;
  hostname: string;
  os_version: string;
  node_version: string;
  bridge_version: string;
  status: 'online' | 'offline' | 'busy';
  last_seen: number;
  available_adapters: AvailableAdapter[];
  active_tasks: number;
  max_concurrent: number;
  created_at: string;
  updated_at: string;
}

const BRIDGE_TYPE_OPTIONS = [
  { label: 'WebSocket', value: 'websocket' },
  { label: 'HTTP', value: 'http' },
  { label: 'gRPC', value: 'grpc' },
  { label: 'Stdio', value: 'stdio' },
];

const PROTOCOL_OPTIONS: Record<string, { label: string; value: string }[]> = {
  websocket: [{ label: 'ws://', value: 'ws' }, { label: 'wss://', value: 'wss' }],
  http: [{ label: 'http://', value: 'http' }, { label: 'https://', value: 'https' }],
  grpc: [{ label: 'grpc://', value: 'grpc' }, { label: 'grpcs://', value: 'grpcs' }],
  stdio: [],
};

const AUTH_MODE_OPTIONS: Record<string, { label: string; value: string }[]> = {
  websocket: [{ label: '无认证', value: 'none' }, { label: 'Token', value: 'token' }],
  http: [{ label: '无认证', value: 'none' }, { label: 'API Key', value: 'api_key' }, { label: 'Basic Auth', value: 'basic_auth' }],
  grpc: [{ label: '无认证', value: 'none' }, { label: 'TLS 证书', value: 'tls_cert' }],
  stdio: [],
};

// --------------- Styled ---------------
const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  margin-bottom: ${spacing[5]};
`;

const StyledSelect = styled(Select)`
  min-width: 140px;
`;

const DetailRow = styled.div`
  display: flex;
  padding: ${spacing[2]} 0;
  border-bottom: 1px solid ${colors.border.DEFAULT};

  &:last-child {
    border-bottom: none;
  }
`;

const DetailLabel = styled.span`
  min-width: 120px;
  font-size: ${typography.fontSize.sm};
  color: ${colors.text.muted};
  flex-shrink: 0;
`;

const DetailValue = styled.span`
  font-size: ${typography.fontSize.base};
  color: ${colors.text.primary};
  word-break: break-all;
`;

const AdapterList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[2]};
`;

const AdapterTag = styled(Tag)`
  margin: 0;
`;

const FormSection = styled.div`
  margin-bottom: ${spacing[4]};
`;

const FormSectionTitle = styled.div`
  font-size: ${typography.fontSize.base};
  font-weight: ${typography.fontWeight.medium};
  color: ${colors.text.primary};
  margin-bottom: ${spacing[3]};
`;

// --------------- Component ---------------
export const GatewayPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedBridge, setSelectedBridge] = useState<Bridge | null>(null);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingBridge, setEditingBridge] = useState<Bridge | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Bridge list from bridges API (CRUD source)
  const { data: bridgesData, isLoading, refetch } = useQuery<Bridge[]>(
    ['bridges'],
    () => api.get('/v1/bridges').then((res: any) => res.data ?? []),
    { refetchInterval: 10000 },
  );

  const bridges = Array.isArray(bridgesData) ? bridgesData : [];

  const disconnectMutation = useMutation(
    (bridgeId: string) => api.post(`/gateway/bridges/${bridgeId}/disconnect`),
    {
      onSuccess: () => {
        void message.success('已强制断开连接');
        void queryClient.invalidateQueries(['bridges']);
      },
      onError: () => {
        void message.error('断开连接失败');
      },
    },
  );

  const createMutation = useMutation(
    (values: any) => api.post('/v1/bridges', values),
    {
      onSuccess: () => {
        void message.success('Bridge 创建成功');
        void queryClient.invalidateQueries(['bridges']);
        closeFormModal();
      },
      onError: () => {
        void message.error('创建失败');
      },
    },
  );

  const updateMutation = useMutation(
    ({ bridgeId, values }: { bridgeId: string; values: any }) =>
      api.put(`/v1/bridges/${bridgeId}`, values),
    {
      onSuccess: () => {
        void message.success('Bridge 更新成功');
        void queryClient.invalidateQueries(['bridges']);
        closeFormModal();
      },
      onError: () => {
        void message.error('更新失败');
      },
    },
  );

  const deleteMutation = useMutation(
    (bridgeId: string) => api.delete(`/v1/bridges/${bridgeId}`),
    {
      onSuccess: () => {
        void message.success('Bridge 已删除');
        void queryClient.invalidateQueries(['bridges']);
      },
      onError: () => {
        void message.error('删除失败');
      },
    },
  );

  // ---- Handlers ----
  const showDetail = (bridge: Bridge) => {
    setSelectedBridge(bridge);
    setDetailModalVisible(true);
  };

  const openCreateModal = () => {
    setEditingBridge(null);
    form.resetFields();
    form.setFieldsValue({ bridge_type: 'websocket', protocol: 'ws', auth_mode: 'none' });
    setFormModalVisible(true);
  };

  const openEditModal = (bridge: Bridge) => {
    setEditingBridge(bridge);
    const authConfig = (bridge.auth_config || {}) as Record<string, unknown>;
    const authMode = authConfig.mode || 'none';
    form.setFieldsValue({
      name: bridge.name,
      bridge_type: bridge.bridge_type,
      host: bridge.host,
      port: bridge.port,
      protocol: bridge.protocol,
      auth_mode: authMode,
      auth_token: authConfig.token,
      auth_api_key: authConfig.api_key,
      auth_username: authConfig.username,
      auth_password: authConfig.password,
      auth_tls_cert: authConfig.tls_cert,
      auth_command: authConfig.command,
    });
    setFormModalVisible(true);
  };

  const closeFormModal = () => {
    setFormModalVisible(false);
    setEditingBridge(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { auth_mode, auth_token, auth_api_key, auth_username, auth_password, auth_tls_cert, auth_command, ...rest } = values;

      // Build auth_config based on auth_mode
      let auth_config: Record<string, unknown> | null = null;
      if (auth_mode === 'token') {
        auth_config = { mode: 'token', token: auth_token };
      } else if (auth_mode === 'api_key') {
        auth_config = { mode: 'api_key', api_key: auth_api_key };
      } else if (auth_mode === 'basic_auth') {
        auth_config = { mode: 'basic_auth', username: auth_username, password: auth_password };
      } else if (auth_mode === 'tls_cert') {
        auth_config = { mode: 'tls_cert', tls_cert: auth_tls_cert };
      } else if (rest.bridge_type === 'stdio') {
        auth_config = { mode: 'stdio', command: auth_command };
      }

      const payload = { ...rest, auth_config };

      if (editingBridge) {
        updateMutation.mutate({ bridgeId: editingBridge.bridge_id, values: payload });
      } else {
        createMutation.mutate(payload);
      }
    } catch {
      // form validation failed
    }
  };

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  const statusTag = (status: string) => {
    switch (status) {
      case 'online':
        return <Tag color="success">online</Tag>;
      case 'busy':
        return <Tag color="warning">busy</Tag>;
      case 'offline':
      default:
        return <Tag color="default">offline</Tag>;
    }
  };

  const bridgeTypeTag = (type?: string) => {
    if (!type) return <Tag>auto</Tag>;
    const colorMap: Record<string, string> = {
      websocket: 'blue',
      http: 'green',
      grpc: 'purple',
      stdio: 'orange',
    };
    return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
  };

  // Watch bridge_type for dynamic form fields
  const bridgeType = Form.useWatch('bridge_type', form);
  const authMode = Form.useWatch('auth_mode', form);

  const columns: ColumnsType<Bridge> = [
    {
      title: '名称',
      key: 'name',
      ellipsis: true,
      render: (_: unknown, record: Bridge) =>
        record.name || (
          <span style={{ fontFamily: typography.fontFamily.mono, fontSize: typography.fontSize.sm }}>
            {record.bridge_id.slice(0, 8)}...
          </span>
        ),
    },
    {
      title: '类型',
      dataIndex: 'bridge_type',
      key: 'bridge_type',
      width: 100,
      render: (type: string) => bridgeTypeTag(type),
    },
    {
      title: '主机',
      key: 'host',
      width: 160,
      ellipsis: true,
      render: (_: unknown, record: Bridge) =>
        record.host ? `${record.host}${record.port ? `:${record.port}` : ''}` : record.hostname,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => statusTag(status),
    },
    {
      title: '活跃任务',
      dataIndex: 'active_tasks',
      key: 'active_tasks',
      width: 100,
      render: (active: number, record: Bridge) => `${active} / ${record.max_concurrent}`,
    },
    {
      title: '最后活跃',
      dataIndex: 'last_seen',
      key: 'last_seen',
      width: 170,
      render: (ts: number) => formatLastSeen(ts),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: Bridge) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除 Bridge "${record.name || record.bridge_id.slice(0, 8)}" 吗？在线连接将被断开。`}
            onConfirm={() => deleteMutation.mutate(record.bridge_id)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
          {user?.role === 'admin' && record.status !== 'offline' && (
            <Popconfirm
              title="确认断开"
              description={`确定要强制断开 ${record.bridge_id} 吗？`}
              onConfirm={() => disconnectMutation.mutate(record.bridge_id)}
              okText="确认"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="强制断开">
                <Button type="text" size="small" danger icon={<DisconnectOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ---- Auth config form fields ----
  const renderAuthFields = () => {
    if (!bridgeType || bridgeType === 'stdio') {
      return (
        <Form.Item label="启动命令" name="auth_command">
          <Input placeholder="例: oc-bridge start --port 8765" />
        </Form.Item>
      );
    }

    const modes = AUTH_MODE_OPTIONS[bridgeType] || [];
    return (
      <>
        <Form.Item label="认证方式" name="auth_mode">
          <Select options={modes} placeholder="选择认证方式" />
        </Form.Item>
        {authMode === 'token' && (
          <Form.Item label="Token" name="auth_token">
            <Input.Password placeholder="输入 WebSocket Token" />
          </Form.Item>
        )}
        {authMode === 'api_key' && (
          <Form.Item label="API Key" name="auth_api_key">
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>
        )}
        {authMode === 'basic_auth' && (
          <>
            <Form.Item label="用户名" name="auth_username">
              <Input placeholder="Basic Auth 用户名" />
            </Form.Item>
            <Form.Item label="密码" name="auth_password">
              <Input.Password placeholder="Basic Auth 密码" />
            </Form.Item>
          </>
        )}
        {authMode === 'tls_cert' && (
          <Form.Item label="TLS 证书" name="auth_tls_cert">
            <Input.TextArea rows={3} placeholder="粘贴 TLS 证书内容" />
          </Form.Item>
        )}
      </>
    );
  };

  const isSubmitting = createMutation.isLoading || updateMutation.isLoading;

  return (
    <div>
      <PageHeader
        title="Gateway 管理"
        actions={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增 Bridge
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
          </Space>
        }
      />

      <FilterBar>
        <span style={{ color: colors.text.secondary, fontSize: typography.fontSize.sm }}>状态筛选：</span>
        <StyledSelect
          value={statusFilter ?? 'all'}
          onChange={(val: unknown) => setStatusFilter(val === 'all' ? undefined : String(val))}
          options={[
            { label: '全部', value: 'all' },
            { label: 'online', value: 'online' },
            { label: 'offline', value: 'offline' },
            { label: 'busy', value: 'busy' },
          ]}
        />
      </FilterBar>

      <Table<Bridge>
        columns={columns}
        dataSource={bridges}
        rowKey="bridge_id"
        loading={isLoading}
        locale={{ emptyText: '暂无 Bridge 连接' }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      {/* Detail Modal */}
      <Modal
        title="Bridge 详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedBridge && (
          <div>
            <DetailRow>
              <DetailLabel>名称</DetailLabel>
              <DetailValue>{selectedBridge.name || '-'}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Bridge ID</DetailLabel>
              <DetailValue style={{ fontFamily: typography.fontFamily.mono }}>
                {selectedBridge.bridge_id}
              </DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>类型</DetailLabel>
              <DetailValue>{bridgeTypeTag(selectedBridge.bridge_type)}</DetailValue>
            </DetailRow>
            {selectedBridge.host && (
              <DetailRow>
                <DetailLabel>连接地址</DetailLabel>
                <DetailValue>
                  {selectedBridge.protocol ? `${selectedBridge.protocol}://` : ''}
                  {selectedBridge.host}{selectedBridge.port ? `:${selectedBridge.port}` : ''}
                </DetailValue>
              </DetailRow>
            )}
            <DetailRow>
              <DetailLabel>平台</DetailLabel>
              <DetailValue>{selectedBridge.platform}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>主机名</DetailLabel>
              <DetailValue>{selectedBridge.hostname}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>操作系统</DetailLabel>
              <DetailValue>{selectedBridge.os_version || '-'}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Node 版本</DetailLabel>
              <DetailValue>{selectedBridge.node_version || '-'}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Bridge 版本</DetailLabel>
              <DetailValue>{selectedBridge.bridge_version || '-'}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>状态</DetailLabel>
              <DetailValue>{statusTag(selectedBridge.status)}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>活跃任务</DetailLabel>
              <DetailValue>
                {selectedBridge.active_tasks} / {selectedBridge.max_concurrent}
              </DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>最后活跃</DetailLabel>
              <DetailValue>{formatLastSeen(selectedBridge.last_seen)}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>创建时间</DetailLabel>
              <DetailValue>{new Date(selectedBridge.created_at).toLocaleString('zh-CN')}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>可用适配器</DetailLabel>
              <DetailValue>
                <AdapterList>
                  {selectedBridge.available_adapters?.map((a, i) => (
                    <AdapterTag key={i} color="blue">
                      {a.agent_name} ({a.type}) v{a.version}
                    </AdapterTag>
                  ))}
                </AdapterList>
              </DetailValue>
            </DetailRow>
          </div>
        )}
      </Modal>

      {/* Create / Edit Modal */}
      <Modal
        title={editingBridge ? '编辑 Bridge' : '新增 Bridge'}
        open={formModalVisible}
        onCancel={closeFormModal}
        onOk={handleSubmit}
        okText={editingBridge ? '保存' : '创建'}
        cancelText="取消"
        confirmLoading={isSubmitting}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" autoComplete="off">
          <FormSection>
            <FormSectionTitle>基本信息</FormSectionTitle>
            <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入 Bridge 名称' }]}>
              <Input placeholder="例: 生产环境 Bridge" />
            </Form.Item>
            <Form.Item label="Bridge 类型" name="bridge_type" rules={[{ required: true, message: '请选择类型' }]}>
              <Select options={BRIDGE_TYPE_OPTIONS} placeholder="选择连接类型" />
            </Form.Item>
          </FormSection>

          {bridgeType !== 'stdio' && (
            <FormSection>
              <FormSectionTitle>连接配置</FormSectionTitle>
              <Form.Item label="主机地址" name="host">
                <Input placeholder="例: 192.168.1.100 或 bridge.example.com" />
              </Form.Item>
              <Form.Item label="端口" name="port">
                <InputNumber placeholder="例: 8765" min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
              {bridgeType && PROTOCOL_OPTIONS[bridgeType]?.length > 0 && (
                <Form.Item label="协议" name="protocol">
                  <Select options={PROTOCOL_OPTIONS[bridgeType]} placeholder="选择协议" allowClear />
                </Form.Item>
              )}
            </FormSection>
          )}

          <FormSection>
            <FormSectionTitle>认证配置</FormSectionTitle>
            {renderAuthFields()}
          </FormSection>
        </Form>
      </Modal>
    </div>
  );
};

export default GatewayPage;
