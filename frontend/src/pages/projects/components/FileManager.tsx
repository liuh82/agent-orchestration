import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Table, Tag, Button, Space, Select, message } from 'antd';
import { DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { typography } from '@/styles/tokens/typography';
import { radius } from '@/styles/tokens/radius';
import { projectApi } from '@/api/projects';
import { FileUploader } from '@/components/common/FileUploader';
import type { ColumnsType } from 'antd/es/table';

const fileTypes = [
  { value: 'prompt', label: 'Prompt' },
  { value: 'input', label: '输入文件' },
  { value: 'reference', label: '参考资料' },
  { value: 'constraint', label: '约束条件' },
  { value: 'output', label: '输出文件' },
];

const fileTypeColors: Record<string, string> = {
  prompt: 'blue',
  input: 'green',
  reference: 'orange',
  constraint: 'red',
  output: 'purple',
};

interface ProjectFile {
  id: string;
  name: string;
  file_type: string;
  size?: number;
  file_path?: string;
  created_at: string;
}

interface FileManagerProps {
  projectId: string;
}

const formatSize = (bytes?: number) => {
  if (!bytes) return '-';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

export const FileManager = ({ projectId }: FileManagerProps) => {
  const queryClient = useQueryClient();
  const [uploadType, setUploadType] = useState<string>('input');
  const [filterType, setFilterType] = useState<string | undefined>(undefined);

  const { data, isLoading } = useQuery(
    ['project-files', projectId],
    () => projectApi.getFiles(projectId),
  );
  const files: ProjectFile[] = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);

  const filteredFiles = filterType ? files.filter((f) => f.file_type === filterType) : files;

  const deleteMutation = useMutation(
    (fileId: string) => projectApi.deleteFile(projectId, fileId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project-files', projectId]);
        message.success('文件已删除');
      },
      onError: () => { void message.error('删除失败'); },
    },
  );

  const handleUpload = () => {
    queryClient.invalidateQueries(['project-files', projectId]);
  };

  const handleDownload = async (file: ProjectFile) => {
    try {
      await projectApi.update(projectId, {} as any);
      // Open in new tab if file path available
      if (file.file_path) {
        window.open(file.file_path, '_blank');
      }
    } catch {
      void message.error('下载失败');
    }
  };

  const columns: ColumnsType<ProjectFile> = [
    { title: '文件名', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: '类型', dataIndex: 'file_type', key: 'file_type', width: 100,
      render: (type: string) => <Tag color={fileTypeColors[type] || 'default'}>{type}</Tag>,
    },
    {
      title: '大小', dataIndex: 'size', key: 'size', width: 100,
      render: (size: number) => formatSize(size),
    },
    {
      title: '上传时间', dataIndex: 'created_at', key: 'created_at', width: 180,
      render: (val: string) => val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'actions', width: 140,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>下载</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => deleteMutation.mutate(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] }}>
        <h3 style={{ margin: 0, color: colors.text.primary, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold }}>
          文件管理
        </h3>
        <Space>
          <Select
            value={filterType}
            onChange={setFilterType}
            options={[{ value: undefined, label: '全部类型' }, ...fileTypes]}
            placeholder="筛选类型"
            allowClear
            style={{ width: 120 }}
          />
        </Space>
      </div>

      <div style={{ background: colors.surface.DEFAULT, border: `1px solid ${colors.border.DEFAULT}`, borderRadius: radius.xl, padding: spacing[5], marginBottom: spacing[4] }}>
        <div style={{ marginBottom: spacing[3] }}>
          <Space>
            <span style={{ fontSize: 14, color: colors.text.secondary }}>上传类型：</span>
            <Select value={uploadType} onChange={setUploadType} options={fileTypes} style={{ width: 120 }} size="small" />
          </Space>
        </div>
        <FileUploader variant="button" onUpload={handleUpload} />
      </div>

      <div style={{ background: colors.surface.DEFAULT, border: `1px solid ${colors.border.DEFAULT}`, borderRadius: radius.xl, padding: spacing[5] }}>
        <Table columns={columns} dataSource={filteredFiles} rowKey="id" loading={isLoading} pagination={false} size="small" locale={{ emptyText: '暂无文件' }} />
      </div>
    </div>
  );
};
