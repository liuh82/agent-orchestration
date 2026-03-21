import api from './client';
import type { WorkflowDefinition } from '@/types/workflow';

// WorkflowDefinition is the schema v1 object used for the `definition` field in create/update payloads.
// It is re-exported here for convenience.
export type { WorkflowDefinition };

export interface WorkflowCreatePayload {
  name: string;
  description?: string;
  definition: string; // JSON.stringify(WorkflowDefinition)
}

export interface WorkflowUpdatePayload {
  name?: string;
  description?: string;
  definition?: string;
}

export interface WorkflowListResponse {
  items: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowDetailResponse {
  id: string;
  name: string;
  description?: string;
  definition: string; // JSON string of WorkflowDefinition
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutePayload {
  name?: string;
  variables?: Record<string, unknown>;
}

export const workflowsApi = {
  list: () => api.get('/workflows') as Promise<any>,

  create: (data: WorkflowCreatePayload) =>
    api.post('/workflows', data) as Promise<any>,

  getById: (id: string) =>
    api.get(`/workflows/${id}`) as Promise<any>,

  update: (id: string, data: WorkflowUpdatePayload) =>
    api.put(`/workflows/${id}`, data) as Promise<any>,

  delete: (id: string) =>
    api.delete(`/workflows/${id}`) as Promise<any>,

  execute: (id: string, data?: WorkflowExecutePayload) =>
    api.post(`/workflows/${id}/execute`, data) as Promise<any>,

  /** 执行实例操作 */
  pauseExecution: (executionId: string) =>
    api.post(`/workflows/executions/${executionId}/pause`) as Promise<any>,

  resumeExecution: (executionId: string) =>
    api.post(`/workflows/executions/${executionId}/resume`) as Promise<any>,

  cancelExecution: (executionId: string) =>
    api.post(`/workflows/executions/${executionId}/cancel`) as Promise<any>,

  getExecution: (executionId: string) =>
    api.get(`/workflows/executions/${executionId}`) as Promise<any>,

  listExecutions: (params?: { workflow_id?: string; page?: number; page_size?: number }) =>
    api.get('/workflows/executions', { params }) as Promise<any>,

  getExecutionNodes: (executionId: string) =>
    api.get(`/workflows/executions/${executionId}/nodes`) as Promise<any>,

  /** 模板 */
  listTemplates: () =>
    api.get('/workflows/templates') as Promise<any>,

  getTemplate: (id: string) =>
    api.get(`/workflows/templates/${id}`) as Promise<any>,

  deleteTemplate: (id: string) =>
    api.delete(`/workflows/templates/${id}`) as Promise<any>,

  saveAsTemplate: (data: Record<string, unknown>) =>
    api.post('/workflows/save-as-template', data) as Promise<any>,

  /** 节点类型 schema */
  getNodeTypes: () =>
    api.get('/workflows/node-types') as Promise<any>,
};
