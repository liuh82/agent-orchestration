import { useState, useRef, useMemo } from 'react';
import { Collapse, Table, Checkbox, Tag, Progress, Tooltip } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { useTaskStore } from '@/stores/useTaskStore';
import { AgentExecutionDetail } from './AgentExecutionDetail';
import { HumanIntervention } from './HumanIntervention';
import type { ColumnsType } from 'antd/es/table';
import type { TaskTreeProject, TaskTreeTask } from '@/types/task';

const ProjectHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[3]};
  padding: ${spacing[3]} 0;
`;

const ProjectName = styled.span`
  font-size: ${typography.fontSize.base};
  font-weight: ${typography.fontWeight.semibold};
  color: ${colors.text.primary};
`;

const StatBadge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: ${spacing[2]};
  font-size: 12px;

  &::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
  }
`;

const TableCard = styled.div`
  background: ${colors.surface.DEFAULT};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: ${radius.lg};
  overflow: hidden;
`;

const InterventionRow = styled.div`
  background: rgba(245, 158, 11, 0.04);
  border-left: 3px solid ${colors.warning[500]};
  padding: ${spacing[4]};
  margin: ${spacing[2]} 0;
`;

const formatDate = (val?: string) => {
  if (!val) return '-';
  const d = new Date(val);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
};

interface TaskTreeProps {
  data: TaskTreeProject[];
  loading?: boolean;
}

export const TaskTree = ({ data, loading }: TaskTreeProps) => {
  const { toggleSelect, selectRange, isSelected } = useTaskStore();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(data.map((p) => p.project_id)));
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const lastClickedRef = useRef<string | null>(null);

  const collapseItems = useMemo(() => {
    if (!data) return [];
    return data.map((project) => {
      const taskIds = project.tasks.map((t) => t.id);

      const columns: ColumnsType<TaskTreeTask> = [
        {
          title: '',
          width: 40,
          render: (_: any, record: TaskTreeTask) => (
            <Checkbox
              checked={isSelected(record.id)}
              onChange={(e) => {
                if (e.nativeEvent.shiftKey && lastClickedRef.current) {
                  selectRange(lastClickedRef.current, record.id, taskIds);
                } else {
                  toggleSelect(record.id);
                }
                lastClickedRef.current = record.id;
              }}
            />
          ),
        },
        {
          title: '任务',
          dataIndex: 'title',
          key: 'title',
          ellipsis: true,
          render: (title: string) => (
            <span style={{ color: colors.text.primary, fontSize: 14 }}>{title}</span>
          ),
        },
        {
          title: '状态',
          dataIndex: 'status',
          key: 'status',
          width: 110,
          render: (status: string) => (
            status === 'pending_human' ? (
              <Tooltip title="需要人工干预">
                <Tag color="orange" style={{ margin: 0 }}>
                  <ExclamationCircleOutlined /> 人工干预
                </Tag>
              </Tooltip>
            ) : (
              <StatusBadge status={status} />
            )
          ),
        },
        {
          title: 'Agent',
          dataIndex: 'agent_name',
          key: 'agent_name',
          width: 120,
          render: (name: string) => (
            <span style={{ color: colors.text.secondary, fontSize: 13 }}>{name || '-'}</span>
          ),
        },
        {
          title: '进度',
          dataIndex: 'progress',
          key: 'progress',
          width: 120,
          render: (progress: number, record: TaskTreeTask) => {
            const percent = typeof progress === 'number' ? progress : record.status === 'completed' ? 100 : 0;
            const statusColor =
              record.status === 'completed' ? colors.success[500] :
              record.status === 'failed' ? colors.error[500] :
              colors.primary[500];
            return (
              <Progress
                percent={percent}
                size="small"
                strokeColor={statusColor}
                format={(p) => `${p}%`}
                style={{ maxWidth: 120 }}
              />
            );
          },
        },
        {
          title: '耗时',
          dataIndex: 'started_at',
          key: 'started_at',
          width: 70,
          render: (val: string) => <span style={{ fontSize: 13, color: colors.text.secondary }}>{formatDate(val)}</span>,
        },
      ];

      return {
        key: project.project_id,
        label: (
          <ProjectHeader>
            <ProjectName>{project.project_name}</ProjectName>
            {project.running_count > 0 && (
              <StatBadge $color={colors.info[500]}>{project.running_count} 运行中</StatBadge>
            )}
            {project.completed_count > 0 && (
              <StatBadge $color={colors.success[500]}>{project.completed_count} 完成</StatBadge>
            )}
            {project.failed_count > 0 && (
              <StatBadge $color={colors.error[500]}>{project.failed_count} 失败</StatBadge>
            )}
          </ProjectHeader>
        ),
        children: (
          <div style={{ padding: `0 ${spacing[5]}` }}>
            {project.tasks.length === 0 ? (
              <EmptyState description="暂无任务" />
            ) : (
              <>
                <Table
                  columns={columns}
                  dataSource={project.tasks}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  expandable={{
                    expandedRowKeys: [...expandedTasks],
                    onExpandedRowsChange: (keys) => setExpandedTasks(new Set(keys as string[])),
                    expandedRowRender: (record: TaskTreeTask) => {
                      if (record.status === 'pending_human') {
                        return (
                          <InterventionRow>
                            <HumanIntervention task={record as any} />
                          </InterventionRow>
                        );
                      }
                      return (
                        <AgentExecutionDetail task={record} />
                      );
                    },
                    rowExpandable: record => record.status === 'pending_human' || record.status === 'running',
                  }}
                />
              </>
            )}
          </div>
        ),
      };
    });
  }, [data, expandedProjects, expandedTasks, isSelected, toggleSelect, selectRange]);

  return (
    <div>
      {loading ? (
        <div style={{ padding: spacing[8] }}>加载中...</div>
      ) : data.length === 0 ? (
        <EmptyState description="暂无任务" />
      ) : (
        <TableCard>
          <Collapse
            activeKey={[...expandedProjects]}
            onChange={(keys) => setExpandedProjects(new Set(keys as string[]))}
            ghost={false}
            expandIconPosition="start"
            items={collapseItems}
            style={{ border: 'none' }}
          />
        </TableCard>
      )}
    </div>
  );
};
