import { Table } from 'antd';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { StatusBadge } from '@/components/common/StatusBadge';

const TableWrapper = styled.div`
  max-height: 180px;
  overflow-y: auto;
`;

export const RecentTasksCard = ({ data }: { data: any }) => {
  const tasks = data ?? [];

  const columns = [
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (v: string) => <span style={{ fontSize: 13, color: colors.text.primary }}>{v}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: 'Agent',
      dataIndex: 'agent',
      key: 'agent',
      width: 100,
      render: (v: string) => v ? <span style={{ fontSize: 12, color: colors.text.secondary }}>{v}</span> : '-',
    },
  ];

  return (
    <TableWrapper>
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey={(r: any) => r.id ?? r.title}
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无最近任务' }}
      />
    </TableWrapper>
  );
};
