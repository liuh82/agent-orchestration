import { useState } from 'react';
import { Table, Button, Tag, Select, Space, Popconfirm, Modal, message, Tooltip } from 'antd';
import { ReloadOutlined, EyeOutlined, DisconnectOutlined } from '@ant-design/icons';
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
  bridge_id: string;
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

// --------------- Component ---------------
export const GatewayPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedBridge, setSelectedBridge] = useState<Bridge | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: bridgesData, isLoading, refetch } = useQuery<Bridge[]>(
    ['gateway-bridges', statusFilter],
    () =>
      api.get('/v1/gateway/bridges', {
        params: statusFilter ? { status: statusFilter } : undefined,
      }).then((res: any) => res.data ?? []),
    {
      refetchInterval: 10000,
    },
  );

  const bridges = Array.isArray(bridgesData) ? bridgesData : [];

  const disconnectMutation = useMutation(
    (bridgeId: string) => api.post(`/v1/gateway/bridges/${bridgeId}/disconnect`),
    {
      onSuccess: () => {
        void message.success('已强制断开连接');
        void queryClient.invalidateQueries(['gateway-bridges']);
      },
      onError: () => {
        void message.error('断开连接失败');
      },
    },
  );

  const showDetail = (bridge: Bridge) => {
    setSelectedBridge(bridge);
    setDetailModalVisible(true);
  };

  const formatLastSeen = (timestamp: number) => {
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

  const columns: ColumnsType<Bridge> = [
    {
      title: 'Bridge ID',
      dataIndex: 'bridge_id',
      key: 'bridge_id',
      ellipsis: true,
      render: (id: string) => (
        <span style={{ fontFamily: typography.fontFamily.mono, fontSize: typography.fontSize.sm }}>
          {id}
        </span>
      ),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
    },
    {
      title: '主机名',
      dataIndex: 'hostname',
      key: 'hostname',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      width: 180,
      render: (ts: number) => formatLastSeen(ts),
    },
    {
      title: '可用适配器',
      dataIndex: 'available_adapters',
      key: 'adapters',
      width: 160,
      render: (adapters: AvailableAdapter[]) => (
        <Space size={[4, 4]} wrap>
          {adapters.map((a, i) => (
            <Tag key={i} style={{ margin: 0 }}>
              {a.agent_name} ({a.type})
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: Bridge) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => showDetail(record)}
            />
          </Tooltip>
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
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DisconnectOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Gateway 管理"
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
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
              <DetailLabel>Bridge ID</DetailLabel>
              <DetailValue style={{ fontFamily: typography.fontFamily.mono }}>
                {selectedBridge.bridge_id}
              </DetailValue>
            </DetailRow>
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
              <DetailValue>{selectedBridge.os_version}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Node 版本</DetailLabel>
              <DetailValue>{selectedBridge.node_version}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Bridge 版本</DetailLabel>
              <DetailValue>{selectedBridge.bridge_version}</DetailValue>
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
                  {selectedBridge.available_adapters.map((a, i) => (
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
    </div>
  );
};

export default GatewayPage;
