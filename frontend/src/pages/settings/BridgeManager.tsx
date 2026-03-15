import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Table, Button, Modal, Space, Skeleton, message, Typography, Alert } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { bridgeApi } from '@/api/bridges';
import type { Bridge, BridgeCreateResponse, BridgeTask } from '@/types/bridge';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

const CardWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

const GuideCard = styled.div`
  background: ${colors.surface.raised};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
  padding: ${spacing[5]};
`;

const CommandBlock = styled.pre`
  background: #1e293b;
  color: #e2e8f0;
  border-radius: ${radius.md};
  padding: ${spacing[4]};
  font-family: ${typography.fontFamily.mono};
  font-size: 13px;
  overflow-x: auto;
  margin: ${spacing[3]} 0;
`;

export const BridgeManager = () => {
  const queryClient = useQueryClient();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [selectedBridge, setSelectedBridge] = useState<string | null>(null);
  const [setupInfo, setSetupInfo] = useState<BridgeCreateResponse | null>(null);

  const {
    data: bridgesRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(
    ['bridges-manage'],
    bridgeApi.list,
  );

  const bridges: Bridge[] = Array.isArray(bridgesRes?.data) ? bridgesRes.data : [];

  // Fetch bridge tasks
  const {
    data: tasksRes,
    isLoading: tasksLoading,
  } = useQuery(
    ['bridge-tasks', selectedBridge],
    () => bridgeApi.getTasks(selectedBridge!),
    { enabled: !!selectedBridge && tasksModalOpen },
  );

  const tasks: BridgeTask[] = Array.isArray(tasksRes?.data) ? tasksRes.data : [];

  const createMutation = useMutation(
    bridgeApi.create,
    {
      onSuccess: (res) => {
        setSetupInfo(res.data);
        queryClient.invalidateQueries(['bridges-manage']);
      },
      onError: () => { void message.error('创建 Bridge 失败'); },
    },
  );

  const deleteMutation = useMutation(
    (bridgeId: string) => bridgeApi.delete(bridgeId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['bridges-manage']);
        message.success('Bridge 已删除');
      },
      onError: () => { void message.error('删除失败'); },
    },
  );

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleAdd = () => {
    createMutation.mutate();
    setAddModalOpen(true);
  };

  const handleViewTasks = (bridgeId: string) => {
    setSelectedBridge(bridgeId);
    setTasksModalOpen(true);
  };

  const columns: ColumnsType<Bridge> = [
    {
      title: '名称',
      dataIndex: 'hostname',
      key: 'hostname',
      render: (name: string, record: Bridge) => (
        <span style={{ color: colors.text.primary, fontWeight: typography.fontWeight.medium }}>
          {name === 'pending-registration' ? `Bridge (${record.bridge_id.slice(0, 8)})` : name}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
    },
    {
      title: '最后活跃',
      dataIndex: 'last_seen',
      key: 'last_seen',
      width: 180,
      render: (val: number) => {
        if (!val) return '-';
        const d = new Date(val * 1000);
        return d.toLocaleString('zh-CN');
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<UnorderedListOutlined />} onClick={() => handleViewTasks(record.bridge_id)}>
            任务
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => deleteMutation.mutate(record.bridge_id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const taskColumns: ColumnsType<BridgeTask> = [
    { title: '任务 ID', dataIndex: 'task_id', key: 'task_id', width: 120 },
    { title: 'Agent 类型', dataIndex: 'agent_type', key: 'agent_type', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 80,
      render: (val: number) => `${val}%`,
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 180,
      render: (val: string) => val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bridge 管理"
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加 Bridge</Button>
          </Space>
        }
      />

      {isError ? (
        <ErrorBlock message={error instanceof Error ? error.message : '加载失败'} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : bridges.length === 0 ? (
        <EmptyState description="暂无 Bridge，点击上方按钮添加" />
      ) : (
        <CardWrapper>
          <Table columns={columns} dataSource={bridges} rowKey="bridge_id" pagination={false} size="middle" />
        </CardWrapper>
      )}

      {/* Add Bridge Modal */}
      <Modal
        title="添加 Bridge"
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); setSetupInfo(null); }}
        footer={setupInfo ? [<Button key="done" type="primary" onClick={() => { setAddModalOpen(false); setSetupInfo(null); }}>完成</Button>] : undefined}
        width={640}
        destroyOnClose
      >
        {createMutation.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : setupInfo ? (
          <div>
            <Alert type="success" message="Bridge 已创建" description="请按照以下步骤配置 Bridge 客户端" showIcon style={{ marginBottom: spacing[5] }} />

            <GuideCard>
              <Text strong>安装步骤</Text>

              <div style={{ marginTop: spacing[4] }}>
                <Text>1. 安装 Bridge 客户端：</Text>
                <CommandBlock>{setupInfo.install_guide.split('\n')[0]}</CommandBlock>
              </div>

              <div style={{ marginTop: spacing[4] }}>
                <Text>2. 配置连接：</Text>
                <CommandBlock>{setupInfo.install_guide.split('\n')[1]}</CommandBlock>
              </div>

              <div style={{ marginTop: spacing[4] }}>
                <Text>3. 启动 Bridge：</Text>
                <CommandBlock>{setupInfo.install_guide.split('\n')[2]}</CommandBlock>
              </div>

              <div style={{ marginTop: spacing[5] }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  WebSocket 地址: {setupInfo.ws_url}
                </Text>
              </div>
            </GuideCard>

            <Space style={{ marginTop: spacing[4] }}>
              <Button icon={<CopyOutlined />} onClick={() => handleCopy(setupInfo.setup_command)}>
                复制配置命令
              </Button>
              <Button icon={<CopyOutlined />} onClick={() => handleCopy(setupInfo.api_key)}>
                复制 API Key
              </Button>
            </Space>
          </div>
        ) : null}
      </Modal>

      {/* Tasks Modal */}
      <Modal
        title="Bridge 任务列表"
        open={tasksModalOpen}
        onCancel={() => { setTasksModalOpen(false); setSelectedBridge(null); }}
        footer={null}
        width={720}
      >
        <Table columns={taskColumns} dataSource={tasks} rowKey="id" loading={tasksLoading} pagination={false} size="small" locale={{ emptyText: '暂无任务' }} />
      </Modal>
    </div>
  );
};

export default BridgeManager;
