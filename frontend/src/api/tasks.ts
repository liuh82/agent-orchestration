import api from './client';
import { Task } from '../types';

interface TaskListParams {
  page?: number;
  page_size?: number;
  status?: Task['status'];
  priority?: Task['priority'];
  project_id?: string;
  assigned_agent_id?: string;
}

export const tasksApi = {
  // 获取任务列表
  getTasks: (params?: TaskListParams) => api.get<Task[]>('/tasks/', { params }),

  // 创建任务
  createTask: (data: Partial<Task>) => api.post<Task>('/tasks/', data),

  // 获取单个任务
  getTask: (id: string) => api.get<Task>(`/tasks/${id}`),

  // 更新任务
  updateTask: (id: string, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data),

  // 删除任务
  deleteTask: (id: string) => api.delete(`/tasks/${id}`),

  // 执行任务
  executeTask: (id: string) => api.post(`/tasks/${id}/execute`),

  // 暂停任务
  pauseTask: (id: string) => api.post(`/tasks/${id}/pause`),

  // 恢复任务
  resumeTask: (id: string) => api.post(`/tasks/${id}/resume`),

  // 取消任务
  cancelTask: (id: string) => api.post(`/tasks/${id}/cancel`),

  // 获取任务日志
  getTaskLogs: (id: string) => api.get(`/tasks/${id}/logs`),

  // 分配任务
  assignTask: (id: string, agentId: string) => api.post(`/tasks/${id}/assign`, { agentId }),
};