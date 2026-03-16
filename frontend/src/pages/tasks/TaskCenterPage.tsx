import { useState } from 'react';
import { Button, Select, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useQuery } from 'react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { TaskTree } from './components/TaskTree';
import { BatchActions } from './components/BatchActions';
import { tasksApi } from '@/api/tasks';
import { useTaskStore } from '@/stores/useTaskStore';
import type { TaskTreeProject } from '@/types/task';

const statusOptions = [
  { label: '运行中', value: 'running' },
  { label: '已完成', value: 'completed' },
  { label: '已失败', value: 'failed' },
  { label: '人工干预', value: 'pending_human' },
  { label: '已暂停', value: 'paused' },
];

export const TaskCenterPage = () => {
  const { selectedTaskIds } = useTaskStore();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const {
    data: treeData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<TaskTreeProject[]>(
    ['tasks-tree', statusFilter],
    async () => {
      const res: any = await tasksApi.tree();
      const data = res.data ?? res;
      if (!statusFilter) return data;
      return data.map((project: TaskTreeProject) => ({
        ...project,
        tasks: project.tasks.filter((t: any) => t.status === statusFilter),
      }));
    },
    {
      refetchInterval: 10_000,
      keepPreviousData: true,
      staleTime: 5_000,
    }
  );

  const handleActionComplete = () => {
    void refetch();
  };

  return (
    <div>
      <PageHeader
        title="任务中心"
        actions={
          <Space>
            <Select
              allowClear
              placeholder="筛选状态"
              style={{ width: 140 }}
              options={statusOptions}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
            />
            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => void refetch()}
            >
              刷新
            </Button>
          </Space>
        }
      />

      {isError && (
        <ErrorBlock
          message={String((error as any)?.message || error || '加载失败')}
          onRetry={() => void refetch()}
        />
      )}

      {!isError && (
        <>
          <TaskTree data={treeData ?? []} loading={isLoading} />
          <BatchActions
            selectedTaskIds={[...selectedTaskIds]}
            onActionComplete={handleActionComplete}
          />
        </>
      )}
    </div>
  );
};

export default TaskCenterPage;
