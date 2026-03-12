import api from './client';
import { WorkflowDefinition, WorkflowTemplate } from '../types';

export const workflowsApi = {
  // 获取工作流列表
  getWorkflows: () => api.get<WorkflowDefinition[]>('/workflows'),

  // 创建工作流
  createWorkflow: (data: Partial<WorkflowDefinition>) => api.post<WorkflowDefinition>('/workflows', data),

  // 获取单个工作流
  getWorkflow: (id: string) => api.get<WorkflowDefinition>(`/workflows/${id}`),

  // 更新工作流
  updateWorkflow: (id: string, data: Partial<WorkflowDefinition>) => api.put<WorkflowDefinition>(`/workflows/${id}`, data),

  // 删除工作流
  deleteWorkflow: (id: string) => api.delete(`/workflows/${id}`),

  // 执行工作流
  executeWorkflow: (id: string, context?: any) => api.post(`/workflows/${id}/execute`, { context }),

  // 获取工作流执行状态
  getWorkflowStatus: (executionId: string) => api.get(`/workflows/status/${executionId}`),

  // 获取工作流执行日志
  getWorkflowLogs: (executionId: string) => api.get(`/workflows/logs/${executionId}`),

  // 获取工作流模板
  getTemplates: () => api.get<WorkflowTemplate[]>('/workflows/templates'),

  // 获取单个模板
  getTemplate: (id: string) => api.get<WorkflowTemplate>(`/workflows/templates/${id}`),

  // 创建模板
  createTemplate: (data: Partial<WorkflowTemplate>) => api.post<WorkflowTemplate>('/workflows/templates', data),

  // 删除模板
  deleteTemplate: (id: string) => api.delete(`/workflows/templates/${id}`),
};