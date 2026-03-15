import { useState } from 'react';
import { Modal, Button, Space, Typography, message } from 'antd';
import { PauseCircleOutlined, StopOutlined, ClearOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { useTaskStore } from '@/stores/useTaskStore';
import { tasksApi } from '@/api/tasks';
import { useQueryClient } from 'react-query';

const { Text } = Typography;

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${colors.surface.raised};
  border: 1px solid ${colors.border.DEFAULT};
  border-radius: 12px;
  padding: ${spacing[3]} ${spacing[5]};
  margin-top: ${spacing[4]};
`;

interface BatchActionsProps {
  selectedTaskIds: string[];
  onActionComplete: () => void;
}

export const BatchActions = ({ selectedTaskIds, onActionComplete }: BatchActionsProps) => {
  const queryClient = useQueryClient();
  const { clearSelection } = useTaskStore();
  const [actionLoading, setActionLoading] = useState(false);

  const handleBatchAction = async (action: 'pause' | 'cancel', label: string) => {
    Modal.confirm({
      title: `确认${label}`,
      content: `确定要对 ${selectedTaskIds.length} 个任务执行「${label}」操作吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(true);
        try {
          await tasksApi.batchAction([...selectedTaskIds], action);
          void message.success(`${label}成功`);
          clearSelection();
          queryClient.invalidateQueries(['tasks-tree']);
          onActionComplete();
        } catch {
          void message.error(`${label}失败`);
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  if (selectedTaskIds.length === 0) return null;

  return (
    <Wrapper>
      <Text style={{ fontSize: 14, color: colors.text.primary }}>
        已选 <Text strong style={{ color: colors.primary[500] }}>{selectedTaskIds.length}</Text> 项
      </Text>
      <Space>
        <Button
          icon={<PauseCircleOutlined />}
          loading={actionLoading}
          onClick={() => handleBatchAction('pause', '批量暂停')}
        >
          批量暂停
        </Button>
        <Button
          danger
          icon={<StopOutlined />}
          loading={actionLoading}
          onClick={() => handleBatchAction('cancel', '批量取消')}
        >
          批量取消
        </Button>
        <Button
          type="text"
          icon={<ClearOutlined />}
          onClick={clearSelection}
        >
          取消选择
        </Button>
      </Space>
    </Wrapper>
  );
};
