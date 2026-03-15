import api from './client';

export const fileApi = {
  /** 上传文件 */
  upload: (file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/files/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }) as Promise<any>;
  },

  /** 下载文件 */
  download: (fileId: string) =>
    api.get(`/files/${fileId}/download/`, { responseType: 'blob' }) as Promise<any>,

  /** 删除文件 */
  delete: (fileId: string) =>
    api.delete(`/files/${fileId}/`) as Promise<any>,

  /** 获取文件列表 */
  list: (params?: { project_id?: string; task_id?: string; file_type?: string }) =>
    api.get('/files/', { params }) as Promise<any>,
};
