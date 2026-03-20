import api from './client';
import type { Task, TaskConfigOverride, TaskAgentConfig } from '@/types/task';

interface TaskListParams {
  page?: number;
  page_size?: number;
  status?: string;
  sort_by?: string;
  sort_order?: string;
  project_id?: string;
}

export const tasksApi = {
  list: (params?: TaskListParams) =>
    api.get('/tasks/', { params }) as Promise<any>,

  create: (data: {
    name: string;
    description?: string;
    project_id?: string;
    workflow_id?: string;
    assigned_agent?: string;
    config_overrides?: TaskConfigOverride[];
    schedule?: {
      type: 'immediate' | 'cron' | 'interval';
      cron_expression?: string;
      interval_seconds?: number;
    };
  }) =>
    api.post('/tasks/', data) as Promise<any>,

  getById: (id: string) =>
    api.get(`/tasks/${id}/`) as Promise<any>,

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

  /** 任务配置覆盖 */
  getConfigs: (taskId: string) =>
    api.get(`/tasks/${taskId}/configs/`) as Promise<{ data: TaskAgentConfig[] }>,

  upsertConfig: (
    taskId: string,
    data: { workflow_node_id: string; agent_type_id?: string; config_override: Record<string, unknown> },
  ) =>
    api.post(`/tasks/${taskId}/configs/`, data) as Promise<any>,

  deleteConfig: (taskId: string, configId: string) =>
    api.delete(`/tasks/${taskId}/configs/${configId}/`) as Promise<any>,
};
