import { useState } from 'react';
import { Table, Tag, Avatar, Switch, Popconfirm, Dropdown, message, Skeleton } from 'antd';
import { DownOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { animation } from '@/styles/tokens/animation';
import api from '@/api/client';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import type { ApiResponse, PagedData } from '@/types/api';
import type { ColumnsType } from 'antd/es/table';

/* ── styled components ── */

const TableWrapper = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  overflow: hidden;

  .ant-table {
    background: transparent;
  }

  .ant-table-thead > tr > th {
    background: ${colors.surface.raised};
    border-bottom: 1px solid ${colors.border.DEFAULT};
    color: ${colors.text.secondary};
    font-size: ${typography.fontSize.sm};
    font-weight: ${typography.fontWeight.medium};
  }

  .ant-table-tbody > tr > td {
    border-bottom: 1px solid ${colors.border.DEFAULT};
    color: ${colors.text.primary};
    font-size: ${typography.fontSize.base};
  }

  .ant-table-tbody > tr:hover > td {
    background: rgba(255, 255, 255, 0.02);
  }

  .ant-pagination {
    padding: ${spacing[4]} ${spacing[6]};
  }
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[2]};
`;

const RoleMenuButton = styled.a`
  color: ${colors.text.brand};
  font-size: ${typography.fontSize.sm};
  cursor: pointer;
  transition: color ${animation.duration.normal} ${animation.easing.default};

  &:hover {
    color: ${colors.primary[400]};
  }
`;

const SkeletonTable = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.xl};
  padding: ${spacing[6]};
`;

/* ── interfaces ── */

interface UserRow {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user';
  quota?: number;
  status: 'active' | 'disabled';
  created_at: string;
  key: string;
}

/* ── component ── */

export const UserManagePage = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<PagedData<UserRow>>, Error>(
    ['admin-users', { page, page_size: pageSize }],
    () =>
      api.get('/v1/admin/users', { params: { page, page_size: pageSize } }) as Promise<any>,
    {
      keepPreviousData: true,
    },
  );

  const users = response?.data?.items ?? [];
  const total = response?.data?.total ?? 0;

  /* ── mutations ── */

  const roleMutation = useMutation(
    ({ userId, role }: { userId: string; role: string }) =>
      api.put(`/v1/admin/users/${userId}`, { role }) as Promise<any>,
    {
      onSuccess: () => {
        void message.success('角色已更新');
        queryClient.invalidateQueries(['admin-users']);
      },
      onError: () => {
        void message.error('更新角色失败');
      },
    },
  );

  const statusMutation = useMutation(
    ({ userId, status }: { userId: string; status: string }) =>
      api.put(`/v1/admin/users/${userId}`, { status }) as Promise<any>,
    {
      onSuccess: () => {
        void message.success('状态已更新');
        queryClient.invalidateQueries(['admin-users']);
      },
      onError: () => {
        void message.error('更新状态失败');
      },
    },
  );

  /* ── role menu items ── */

  const getRoleMenuItems = (user: UserRow) => [
    {
      key: 'admin',
      label: '设为管理员',
      disabled: user.role === 'admin',
    },
    {
      key: 'user',
      label: '设为普通用户',
      disabled: user.role === 'user',
    },
  ];

  /* ── columns ── */

  const columns: ColumnsType<UserRow> = [
    {
      title: '头像',
      dataIndex: 'avatar',
      key: 'avatar',
      width: 60,
      render: (avatar?: string, record?: UserRow) => (
        <Avatar
          src={avatar}
          icon={!avatar ? <UserOutlined /> : undefined}
          style={{ backgroundColor: colors.primary[600] }}
        >
          {record?.username?.charAt(0)?.toUpperCase()}
        </Avatar>
      ),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (email: string) => (
        <span style={{ color: colors.text.secondary }}>{email || '-'}</span>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '用户'}
        </Tag>
      ),
    },
    {
      title: '配额',
      dataIndex: 'quota',
      key: 'quota',
      width: 100,
      render: (quota?: number) => (
        <span style={{ color: colors.text.secondary }}>
          {quota != null ? quota.toLocaleString() : '-'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => (
        <span style={{ color: colors.text.secondary, fontSize: typography.fontSize.sm }}>
          {date ? new Date(date).toLocaleString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: UserRow) => (
        <ActionButtons>
          <Dropdown
            menu={{
              items: getRoleMenuItems(record),
              onClick: ({ key }) => {
                void roleMutation.mutate({ userId: record.id, role: key });
              },
            }}
            trigger={['click']}
          >
            <RoleMenuButton>
              修改角色 <DownOutlined style={{ fontSize: '10px', marginLeft: '4px' }} />
            </RoleMenuButton>
          </Dropdown>
          <Popconfirm
            title={record.status === 'active' ? '确认禁用' : '确认启用'}
            description={
              record.status === 'active'
                ? `确定要禁用用户「${record.username}」吗？`
                : `确定要启用用户「${record.username}」吗？`
            }
            onConfirm={() => {
              void statusMutation.mutate({
                userId: record.id,
                status: record.status === 'active' ? 'disabled' : 'active',
              });
            }}
            okText="确认"
            cancelText="取消"
          >
            <Switch
              size="small"
              checked={record.status === 'active'}
              disabled={statusMutation.isLoading}
            />
          </Popconfirm>
        </ActionButtons>
      ),
    },
  ];

  /* ── error state ── */
  if (isError) {
    return (
      <div>
        <PageHeader title="用户管理" />
        <ErrorBlock
          message={error?.message || '加载用户列表失败'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  /* ── loading state ── */
  if (isLoading && users.length === 0) {
    return (
      <div>
        <PageHeader title="用户管理" />
        <SkeletonTable>
          <Skeleton active paragraph={{ rows: 8 }} title={false} />
        </SkeletonTable>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="用户管理" />

      {users.length === 0 ? (
        <EmptyState description="暂无用户数据" />
      ) : (
        <TableWrapper>
          <Table<UserRow>
            columns={columns}
            dataSource={users.map((u) => ({ ...u, key: u.id }))}
            rowKey="key"
            loading={isLoading}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 个用户`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
          />
        </TableWrapper>
      )}
    </div>
  );
};

export default UserManagePage;
