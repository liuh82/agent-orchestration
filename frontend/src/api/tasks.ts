import api from './client';
import type { Task } from '@/types/task';

interface TaskListParams {
  page?: number;
  page_size?: number;
  status?: Task['status'];
  priority?: Task['priority'];
  project_id?: string;
  assigned_agent_id?: string;
}

export const tasksApi = {
  list: (params?: TaskListParams) =>
    api.get('/tasks/', { params }) as Promise<any>,

  create: (data: Partial<Task>) =>
    api.post('/tasks/', data) as Promise<any>,

  getById: (id: string) =>
    api.get(`/tasks/${id}`) as Promise<any>,

  update: (id: string, data: Partial<Task>) =>
    api.put(`/tasks/${id}`, data) as Promise<any>,

  delete: (id: string) =>
    api.delete(`/tasks/${id}`) as Promise<any>,

  execute: (id: string) =>
    api.post(`/tasks/${id}/execute`) as Promise<any>,

  pause: (id: string) =>
    api.post(`/tasks/${id}/pause`) as Promise<any>,

  resume: (id: string) =>
    api.post(`/tasks/${id}/resume`) as Promise<any>,

  cancel: (id: string) =>
    api.post(`/tasks/${id}/cancel`) as Promise<any>,

  logs: (id: string, params?: { page?: number; page_size?: number }) =>
    api.get(`/tasks/${id}/logs`, { params }) as Promise<any>,

  assign: (id: string, agentId: string) =>
    api.post(`/tasks/${id}/assign`, { agent_id: agentId }) as Promise<any>,

  /** 三层级树数据 */
  tree: () =>
    api.get('/tasks/tree') as Promise<any>,

  /** 人工干预 — 审批通过 */
  approve: (id: string) =>
    api.post(`/tasks/${id}/approve`) as Promise<any>,

  /** 人工干预 — 驳回/修改意见 */
  reject: (id: string, data: { comment?: string; attachments?: string[] }) =>
    api.post(`/tasks/${id}/reject`, data) as Promise<any>,

  /** 批量操作 */
  batchAction: (taskIds: string[], action: 'pause' | 'cancel') =>
    api.post('/tasks/batch-action', { task_ids: taskIds, action }) as Promise<any>,
};
