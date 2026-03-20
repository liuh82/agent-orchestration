import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Button, Table, Modal, Form, Input, Select, Tag, Space, message, Upload, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { projectApi } from '@/api/projects';
import type { ColumnsType } from 'antd/es/table';

const docTypes = [
  { value: 'requirement', label: '需求文档' },
  { value: 'architecture', label: '架构设计' },
  { value: 'specification', label: '功能规格' },
  { value: 'plan', label: '实施计划' },
  { value: 'reference', label: '参考文档' },
  { value: 'guide', label: '开发指南' },
  { value: 'other', label: '其他' },
];

const ALLOWED_EXTS = ['.md', '.txt', '.pdf', '.docx', '.json', '.yaml', '.yml', '.py', '.js', '.ts', '.png', '.jpg', '.jpeg', '.gif'];

interface Document {
  id: string;
  title: string;
  doc_type: string;
  content?: string;
  file_id?: string;
  file_path?: string;
  file_size?: number;
  created_at: string;
  updated_at: string;
}

const docTypeColors: Record<string, string> = {
  requirement: 'blue',
  architecture: 'purple',
  specification: 'green',
  plan: 'cyan',
  reference: 'orange',
  guide: 'geekblue',
  other: 'default',
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentManagerProps {
  projectId: string;
}

export const DocumentManager = ({ projectId }: DocumentManagerProps) => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'text' | 'file'>('text');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [form] = Form.useForm();
  const [editContent, setEditContent] = useState('');

  const { data, isLoading } = useQuery(
    ['project-docs', projectId],
    () => projectApi.getDocuments(projectId),
  );
  const docs = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);

  const createMutation = useMutation(
    (values: { title: string; doc_type: string; content?: string; file_id?: string }) =>
      projectApi.createDocument(projectId, values),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project-docs', projectId]);
        setCreateOpen(false);
        form.resetFields();
        setUploadFile(null);
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

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (createMode === 'file' && uploadFile) {
        // File upload mode — use multipart
        setUploading(true);
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('title', values.title || uploadFile.name);
        formData.append('doc_type', values.doc_type || 'other');

        await projectApi.createDocument(projectId, formData as any);
        queryClient.invalidateQueries(['project-docs', projectId]);
        setCreateOpen(false);
        form.resetFields();
        setUploadFile(null);
        setUploading(false);
        message.success('文档已上传');
      } else {
        // Text mode — JSON body
        createMutation.mutate(values);
      }
    } catch {
      // validation error
    }
  };

  const handleEdit = (doc: Document) => {
    setSelectedDoc(doc);
    setEditContent(doc.content || '');
    setEditOpen(true);
  };

  const handlePreview = (doc: Document) => {
    setSelectedDoc(doc);
    setPreviewOpen(true);
  };

  const handleFileSelect = (file: File) => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      message.error(`不支持的文件格式: ${ext}，支持: ${ALLOWED_EXTS.join(', ')}`);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('文件大小不能超过 10MB');
      return false;
    }
    setUploadFile(file);
    // Auto-fill title from filename if empty
    const title = form.getFieldValue('title');
    if (!title) {
      form.setFieldValue('title', file.name.replace(/\.[^.]+$/, ''));
    }
    return false; // prevent auto upload
  };

  const columns: ColumnsType<Document> = [
    { title: '标题', dataIndex: 'title', key: 'title', width: 240 },
    {
      title: '类型', dataIndex: 'doc_type', key: 'doc_type', width: 120,
      render: (type: string) => <Tag color={docTypeColors[type] || 'default'}>{type}</Tag>,
    },
    {
      title: '大小', dataIndex: 'file_size', key: 'file_size', width: 100,
      render: (val: number) => formatFileSize(val),
    },
    {
      title: '来源', key: 'source', width: 80,
      render: (_, record) => record.file_path ? <Tag>文件</Tag> : <Tag color="blue">文本</Tag>,
    },
    {
      title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 180,
      render: (val: string) => val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'actions', width: 200,
      render: (_, record) => (
        <Space>
          {(record.content || record.file_path) && (
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
      <Modal
        title="创建文档"
        open={createOpen}
        onOk={handleCreateSubmit}
        onCancel={() => { setCreateOpen(false); form.resetFields(); setUploadFile(null); }}
        confirmLoading={createMutation.isLoading || uploading}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="创建方式">
            <Radio.Group value={createMode} onChange={(e) => setCreateMode(e.target.value)}>
              <Radio.Button value="text">文本输入</Radio.Button>
              <Radio.Button value="file">上传文件</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="title" label="文档标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入文档标题" />
          </Form.Item>

          <Form.Item name="doc_type" label="文档类型" rules={[{ required: true }]}>
            <Select options={docTypes} placeholder="选择类型" />
          </Form.Item>

          {createMode === 'text' ? (
            <Form.Item name="content" label="内容（Markdown）">
              <Input.TextArea rows={8} placeholder="输入 Markdown 内容" style={{ fontFamily: typography.fontFamily.mono, fontSize: 14, background: '#fafafa' }} />
            </Form.Item>
          ) : (
            <Form.Item label="上传文件">
              {uploadFile ? (
                <div style={{
                  padding: spacing[3], border: `1px dashed ${colors.border.DEFAULT}`,
                  borderRadius: radius.lg, background: colors.surface.DEFAULT,
                  display: 'flex', alignItems: 'center', gap: spacing[3],
                }}>
                  <UploadOutlined />
                  <span style={{ flex: 1 }}>{uploadFile.name} ({formatFileSize(uploadFile.size)})</span>
                  <Button size="small" danger onClick={() => setUploadFile(null)}>移除</Button>
                </div>
              ) : (
                <Upload.Dragger
                  beforeUpload={handleFileSelect}
                  showUploadList={false}
                  accept={ALLOWED_EXTS.join(',')}
                >
                  <p style={{ fontSize: 32, color: colors.text.muted }}><InboxOutlined /></p>
                  <p style={{ color: colors.text.secondary }}>点击或拖拽文件到此处上传</p>
                  <p style={{ fontSize: 12, color: colors.text.muted }}>支持 {ALLOWED_EXTS.join(', ')}，最大 10MB</p>
                </Upload.Dragger>
              )}
            </Form.Item>
          )}
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
          {selectedDoc?.content || '无内容（文件上传文档暂不支持在线预览）'}
        </pre>
      </Modal>
    </div>
  );
};
