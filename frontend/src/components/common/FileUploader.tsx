import { useState } from 'react';
import { Upload, message, Progress, Button } from 'antd';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { colors } from '@/styles/tokens/color';
import { spacing } from '@/styles/tokens/spacing';
import { radius } from '@/styles/tokens/radius';
import { fileApi } from '@/api/files';

const { Dragger } = Upload;

const Wrapper = styled.div`
  .ant-upload-drag {
    border: 2px dashed ${colors.border.DEFAULT};
    border-radius: ${radius.lg};
    background: #fafafa;
    transition: border-color 0.2s;

    &:hover {
      border-color: ${colors.primary[500]};
    }
  }

  .ant-upload-drag-icon {
    color: ${colors.text.disabled} !important;
    margin-bottom: ${spacing[3]} !important;
  }

  .ant-upload-text {
    color: ${colors.text.secondary} !important;
    font-size: 14px !important;
  }

  .ant-upload-hint {
    color: ${colors.text.muted} !important;
    font-size: 13px !important;
  }
`;

const ProgressWrapper = styled.div`
  margin-top: ${spacing[3]};
`;

interface FileUploaderProps {
  accept?: string;
  maxSize?: number;
  onUpload: (file: { file_id: string; file_path: string; name: string }) => void;
  children?: React.ReactNode;
  variant?: 'drag' | 'button';
}

export const FileUploader = ({
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB
  onUpload,
  children,
  variant = 'drag',
}: FileUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (file: File) => {
    if (file.size > maxSize) {
      void message.error(`文件大小不能超过 ${Math.round(maxSize / 1024 / 1024)}MB`);
      return false;
    }

    setUploading(true);
    setProgress(0);

    try {
      const res = await fileApi.upload(file, setProgress);
      const data = res.data;
      if (data) {
        onUpload({
          file_id: data.id || data.file_id || '',
          file_path: data.file_path || data.path || file.name,
          name: file.name,
        });
        void message.success(`${file.name} 上传成功`);
      }
      return true;
    } catch (err: any) {
      void message.error(err?.message || '上传失败');
      return false;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  if (variant === 'button') {
    return (
      <div>
        <Upload
          accept={accept}
          showUploadList={false}
          beforeUpload={(file) => {
            handleUpload(file);
            return false; // prevent default upload
          }}
          disabled={uploading}
        >
          {children || (
            <Button icon={<UploadOutlined />} loading={uploading}>
              上传文件
            </Button>
          )}
        </Upload>
        {uploading && (
          <ProgressWrapper>
            <Progress percent={progress} size="small" />
          </ProgressWrapper>
        )}
      </div>
    );
  }

  return (
    <Wrapper>
      <Dragger
        accept={accept}
        showUploadList={false}
        beforeUpload={(file) => {
          handleUpload(file);
          return false;
        }}
        disabled={uploading}
        multiple={false}
      >
        {uploading ? (
          <ProgressWrapper>
            <Progress percent={progress} />
          </ProgressWrapper>
        ) : (
          <>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持单个文件上传，最大 {Math.round(maxSize / 1024 / 1024)}MB
            </p>
          </>
        )}
      </Dragger>
    </Wrapper>
  );
};
