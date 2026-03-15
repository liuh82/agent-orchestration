import { useState } from 'react';
import { Button, Form, Modal, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import { spacing } from '@/styles/tokens/spacing';
import { notificationApi } from '@/api/notifications';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBlock } from '@/components/common/ErrorBlock';
import { ChannelList } from '@/components/notification/ChannelList';
import { ChannelForm, buildDefaultValues, extractConfig } from '@/components/notification/ChannelForm';
import { TRIGGER_OPTIONS, type NotificationChannel } from '@/components/notification/types';

const ModalFormWrapper = styled.div`
  .ant-form-item {
    margin-bottom: ${spacing[5]};
  }
`;

export const NotificationPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const queryKey = ['notifications'];

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<any, Error>(
    queryKey,
    () => notificationApi.list(),
  );

  const channels: NotificationChannel[] = response?.data?.items ?? response?.data ?? [];

  const createMutation = useMutation(
    (values: Record<string, unknown>) =>
      notificationApi.create({
        channel_type: values.channel_type,
        name: values.name,
        config: extractConfig(values),
        triggers: values.triggers,
        is_active: values.is_active,
      }),
    {
      onSuccess: () => {
        void message.success('通知通道创建成功');
        queryClient.invalidateQueries(queryKey);
        handleCloseModal();
      },
      onError: () => {
        void message.error('创建失败，请重试');
      },
    },
  );

  const updateMutation = useMutation(
    (values: Record<string, unknown>) =>
      notificationApi.update(editingChannel!.id, {
        name: values.name,
        config: extractConfig(values),
        triggers: values.triggers,
        is_active: values.is_active,
      }),
    {
      onSuccess: () => {
        void message.success('通知通道已更新');
        queryClient.invalidateQueries(queryKey);
        handleCloseModal();
      },
      onError: () => {
        void message.error('更新失败，请重试');
      },
    },
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingChannel) {
        updateMutation.mutate(values);
      } else {
        createMutation.mutate(values);
      }
    } catch {
      // form validation failed
    }
  };

  const handleOpenCreate = () => {
    setEditingChannel(null);
    setModalOpen(true);
  };

  const handleEdit = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    form.resetFields();
    setModalOpen(false);
    setEditingChannel(null);
  };

  if (isError) {
    return (
      <div>
        <PageHeader title="通知通道" />
        <ErrorBlock message={error?.message || '加载通知通道失败'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="通知通道"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            创建通道
          </Button>
        }
      />

      {channels.length === 0 && !isLoading ? (
        <EmptyState
          description="还没有通知通道，点击下方按钮创建第一个通知通道"
          action={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              创建通道
            </Button>
          }
        />
      ) : (
        <ChannelList channels={channels} queryKey={queryKey} onEdit={handleEdit} loading={isLoading} />
      )}

      <Modal
        title={editingChannel ? '编辑通知通道' : '创建通知通道'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        okText={editingChannel ? '保存' : '创建'}
        cancelText="取消"
        confirmLoading={createMutation.isLoading || updateMutation.isLoading}
        destroyOnClose
        width={520}
      >
        <ModalFormWrapper>
          <Form
            form={form}
            layout="vertical"
            autoComplete="off"
            initialValues={editingChannel
              ? buildDefaultValues(editingChannel.channel_type, editingChannel)
              : buildDefaultValues('feishu')
            }
          >
            <ChannelForm
              channelType={editingChannel?.channel_type ?? 'feishu'}
              triggerOptions={TRIGGER_OPTIONS}
              disabled={!!editingChannel}
            />
          </Form>
        </ModalFormWrapper>
      </Modal>
    </div>
  );
};

export default NotificationPage;
