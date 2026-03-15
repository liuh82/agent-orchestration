import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Button, Table, Modal, Form, Input, Select, Tag, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { projectApi } from '@/api/projects';
import type { ColumnsType } from 'antd/es/table';

const docTypes = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'specification', label: '需求文档' },
  { value: 'reference', label: '参考文档' },
  { value: 'other', label: '其他' },
];

interface Document {
  id: string;
  title: string;
  doc_type: string;
  content?: string;
  file_id?: string;
  created_at: string;
  updated_at: string;
}

const docTypeColors: Record<string, string> = {
  markdown: 'blue',
  specification: 'green',
  reference: 'orange',
  other: 'default',
};

interface DocumentManagerProps {
  projectId: string;
}

export const DocumentManager = ({ projectId }: DocumentManagerProps) => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [form] = Form.useForm();
  const [editContent, setEditContent] = useState('');

  const { data, isLoading } = useQuery(
    ['project-docs', projectId],
    () => projectApi.getDocuments(projectId),
  );
  const docs = data?.data ?? [];

  const createMutation = useMutation(
    (values: { title: string; doc_type: string; content?: string; file_id?: string }) =>
      projectApi.createDocument(projectId, values),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project-docs', projectId]);
        setCreateOpen(false);
        form.resetFields();
        message.success('文档已创建');
      },
      onError: () => { void message.error('创建失败'); },
    },
  );

  const updateMutation = useMutation(
    (values: { title?: string; content?: string }) =>
      projectApi.updateDocument(projectId, selectedDoc!.id, values),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project-docs', projectId]);
        setEditOpen(false);
        message.success('文档已更新');
      },
      onError: () => { void message.error('更新失败'); },
    },
  );

  const deleteMutation = useMutation(
    (docId: string) => projectApi.deleteDocument(projectId, docId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project-docs', projectId]);
        message.success('文档已删除');
      },
      onError: () => { void message.error('删除失败'); },
    },
  );

  const handleEdit = (doc: Document) => {
    setSelectedDoc(doc);
    setEditContent(doc.content || '');
    setEditOpen(true);
  };

  const handlePreview = (doc: Document) => {
    setSelectedDoc(doc);
    setPreviewOpen(true);
  };

  const columns: ColumnsType<Document> = [
    { title: '标题', dataIndex: 'title', key: 'title', width: 200 },
    {
      title: '类型', dataIndex: 'doc_type', key: 'doc_type', width: 120,
      render: (type: string) => <Tag color={docTypeColors[type] || 'default'}>{type}</Tag>,
    },
    {
      title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 180,
      render: (val: string) => val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'actions', width: 180,
      render: (_, record) => (
        <Space>
          {record.content && (
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)}>预览</Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => deleteMutation.mutate(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[4] }}>
        <h3 style={{ margin: 0, color: colors.text.primary, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>
          文档库
        </h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>创建文档</Button>
      </div>

      <div style={{ background: colors.surface.DEFAULT, border: `1px solid ${colors.border.DEFAULT}`, borderRadius: radius.xl, padding: spacing[5] }}>
        <Table columns={columns} dataSource={docs} rowKey="id" loading={isLoading} pagination={false} size="small" locale={{ emptyText: '暂无文档' }} />
      </div>

      {/* 创建文档 Modal */}
      <Modal title="创建文档" open={createOpen} onOk={() => form.validateFields().then((v) => createMutation.mutate(v))} onCancel={() => { setCreateOpen(false); form.resetFields(); }} confirmLoading={createMutation.isLoading} okText="创建" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="文档标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入文档标题" />
          </Form.Item>
          <Form.Item name="doc_type" label="文档类型" rules={[{ required: true }]}>
            <Select options={docTypes} placeholder="选择类型" />
          </Form.Item>
          <Form.Item name="content" label="内容（Markdown）">
            <Input.TextArea rows={8} placeholder="输入 Markdown 内容" style={{ fontFamily: typography.fontFamily.mono, fontSize: 14, background: '#fafafa' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑文档 Modal */}
      <Modal title="编辑文档" open={editOpen} onOk={() => updateMutation.mutate({ content: editContent })} onCancel={() => setEditOpen(false)} confirmLoading={updateMutation.isLoading} okText="保存" cancelText="取消" width={720} destroyOnClose>
        {selectedDoc && (
          <div>
            <div style={{ marginBottom: spacing[3], fontSize: 14, color: colors.text.secondary }}>
              标题：{selectedDoc.title}
            </div>
            <Input.TextArea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={16}
              style={{ fontFamily: typography.fontFamily.mono, fontSize: 14, background: '#fafafa', color: '#1f2937' }}
            />
          </div>
        )}
      </Modal>

      {/* 预览 Modal */}
      <Modal title={selectedDoc?.title} open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width={720}>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: typography.fontFamily.mono, fontSize: 14, background: '#fafafa', color: '#1f2937', padding: spacing[5], borderRadius: radius.lg, maxHeight: 500, overflow: 'auto' }}>
          {selectedDoc?.content || '无内容'}
        </pre>
      </Modal>
    </div>
  );
};
