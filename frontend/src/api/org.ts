import api from './client';
import { ApiResponse } from '../types';

export const orgApi = {
  // ===== Org Chart =====
  getOrgChart: () => api.get<ApiResponse<any>>('/org/chart'),

  getOrgNodes: (includeInactive = false) =>
    api.get<ApiResponse<any>>('/org/chart/nodes', { params: { include_inactive: includeInactive } }),

  getOrgNode: (nodeId: string) =>
    api.get<ApiResponse<any>>(`/org/chart/nodes/${nodeId}`),

  createOrgNode: (data: any) =>
    api.post<ApiResponse<any>>('/org/chart/nodes', data),

  updateOrgNode: (nodeId: string, data: any) =>
    api.put<ApiResponse<any>>(`/org/chart/nodes/${nodeId}`, data),

  deleteOrgNode: (nodeId: string) =>
    api.delete(`/org/chart/nodes/${nodeId}`),

  // ===== Roles =====
  getRoles: (includeInactive = false) =>
    api.get<ApiResponse<any>>('/org/roles', { params: { include_inactive: includeInactive } }),

  getRole: (roleId: string) =>
    api.get<ApiResponse<any>>(`/org/roles/${roleId}`),

  createRole: (data: any) =>
    api.post<ApiResponse<any>>('/org/roles', data),

  updateRole: (roleId: string, data: any) =>
    api.put<ApiResponse<any>>(`/org/roles/${roleId}`, data),

  deleteRole: (roleId: string) =>
    api.delete(`/org/roles/${roleId}`),

  // ===== Members =====
  getMembers: (includeInactive = false) =>
    api.get<ApiResponse<any>>('/org/members', { params: { include_inactive: includeInactive } }),

  getMember: (memberId: string) =>
    api.get<ApiResponse<any>>(`/org/members/${memberId}`),

  createMember: (data: any) =>
    api.post<ApiResponse<any>>('/org/members', data),

  updateMember: (memberId: string, data: any) =>
    api.put<ApiResponse<any>>(`/org/members/${memberId}`, data),

  deleteMember: (memberId: string) =>
    api.delete(`/org/members/${memberId}`),

  // ===== Goals =====
  getGoals: () =>
    api.get<ApiResponse<any>>('/org/goals'),

  getGoal: (goalId: string) =>
    api.get<ApiResponse<any>>(`/org/goals/${goalId}`),

  createGoal: (data: any) =>
    api.post<ApiResponse<any>>('/org/goals', data),

  updateGoal: (goalId: string, data: any) =>
    api.put<ApiResponse<any>>(`/org/goals/${goalId}`, data),

  deleteGoal: (goalId: string) =>
    api.delete(`/org/goals/${goalId}`),

  alignGoal: (data: any) =>
    api.post<ApiResponse<any>>('/org/goals/align', data),

  // ===== Approvals =====
  getApprovals: (status?: string) =>
    api.get<ApiResponse<any>>('/org/approvals', { params: { status } }),

  getApproval: (approvalId: string) =>
    api.get<ApiResponse<any>>(`/org/approvals/${approvalId}`),

  createApproval: (data: any) =>
    api.post<ApiResponse<any>>('/org/approvals', data),

  updateApproval: (approvalId: string, data: any) =>
    api.put<ApiResponse<any>>(`/org/approvals/${approvalId}`, data),

  approveApproval: (approvalId: string, comment?: string) =>
    api.post<ApiResponse<any>>(`/org/approvals/${approvalId}/approve`, null, {
      params: { comment }
    }),

  rejectApproval: (approvalId: string, comment?: string) =>
    api.post<ApiResponse<any>>(`/org/approvals/${approvalId}/reject`, null, {
      params: { comment }
    }),

  getApprovalHistory: (approvalId: string) =>
    api.get<ApiResponse<any>>(`/org/approvals/${approvalId}/history`),

  // ===== Audit =====
  getAuditLogs: (params?: {
    page?: number;
    pageSize?: number;
    startTime?: string;
    endTime?: string;
    userId?: string;
    resourceType?: string;
    action?: string;
    statusCode?: number;
  }) =>
    api.get<ApiResponse<any>>('/org/audit/logs', { params }),

  getAuditSummary: (params?: {
    startTime?: string;
    endTime?: string;
  }) =>
    api.get<any>('/org/audit/summary', { params }),
};
