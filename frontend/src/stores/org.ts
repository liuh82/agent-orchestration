import { create } from 'zustand';
import {
  OrgNode, Role, Member, Goal, Approval,
  AuditLog
} from '../types';
import { orgApi } from '../api/org';

interface OrgState {
  // Org Chart
  orgNodes: OrgNode[];
  orgChart: any;
  loading: boolean;
  error: string | null;

  // Roles
  roles: Role[];

  // Members
  members: Member[];

  // Goals
  goals: Goal[];

  // Approvals
  approvals: Approval[];

  // Audit Logs
  auditLogs: AuditLog[];
  auditSummary: any;

  // Org Chart Actions
  fetchOrgChart: () => Promise<void>;
  fetchOrgNodes: () => Promise<void>;
  createOrgNode: (data: any) => Promise<void>;
  updateOrgNode: (nodeId: string, data: any) => Promise<void>;
  deleteOrgNode: (nodeId: string) => Promise<void>;

  // Role Actions
  fetchRoles: () => Promise<void>;
  createRole: (data: any) => Promise<void>;
  updateRole: (roleId: string, data: any) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;

  // Member Actions
  fetchMembers: () => Promise<void>;
  createMember: (data: any) => Promise<void>;
  updateMember: (memberId: string, data: any) => Promise<void>;
  deleteMember: (memberId: string) => Promise<void>;

  // Goal Actions
  fetchGoals: () => Promise<void>;
  createGoal: (data: any) => Promise<void>;
  updateGoal: (goalId: string, data: any) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  alignGoal: (data: any) => Promise<void>;

  // Approval Actions
  fetchApprovals: (status?: string) => Promise<void>;
  createApproval: (data: any) => Promise<void>;
  approveApproval: (approvalId: string, comment?: string) => Promise<void>;
  rejectApproval: (approvalId: string, comment?: string) => Promise<void>;

  // Audit Actions
  fetchAuditLogs: (params?: any) => Promise<void>;
  fetchAuditSummary: (params?: any) => Promise<void>;
}

export const useOrgStore = create<OrgState>((set) => ({
  // Initial state
  orgNodes: [],
  orgChart: null,
  roles: [],
  members: [],
  goals: [],
  approvals: [],
  auditLogs: [],
  auditSummary: null,
  loading: false,
  error: null,

  // Org Chart Actions
  fetchOrgChart: async () => {
    set({ loading: true, error: null });
    try {
      const response = await orgApi.getOrgChart();
      set({ orgChart: response.data.data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch org chart',
        loading: false
      });
    }
  },

  fetchOrgNodes: async () => {
    set({ loading: true, error: null });
    try {
      const response = await orgApi.getOrgNodes();
      set({ orgNodes: response.data.data || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch org nodes',
        loading: false
      });
    }
  },

  createOrgNode: async (data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.createOrgNode(data);
      await orgApi.getOrgNodes(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create org node',
        loading: false
      });
    }
  },

  updateOrgNode: async (nodeId, data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.updateOrgNode(nodeId, data);
      await orgApi.getOrgNodes(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update org node',
        loading: false
      });
    }
  },

  deleteOrgNode: async (nodeId) => {
    set({ loading: true, error: null });
    try {
      await orgApi.deleteOrgNode(nodeId);
      await orgApi.getOrgNodes(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete org node',
        loading: false
      });
    }
  },

  // Role Actions
  fetchRoles: async () => {
    set({ loading: true, error: null });
    try {
      const response = await orgApi.getRoles();
      set({ roles: response.data.data || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch roles',
        loading: false
      });
    }
  },

  createRole: async (data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.createRole(data);
      await orgApi.getRoles(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create role',
        loading: false
      });
    }
  },

  updateRole: async (roleId, data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.updateRole(roleId, data);
      await orgApi.getRoles(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update role',
        loading: false
      });
    }
  },

  deleteRole: async (roleId) => {
    set({ loading: true, error: null });
    try {
      await orgApi.deleteRole(roleId);
      await orgApi.getRoles(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete role',
        loading: false
      });
    }
  },

  // Member Actions
  fetchMembers: async () => {
    set({ loading: true, error: null });
    try {
      const response = await orgApi.getMembers();
      set({ members: response.data.data || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch members',
        loading: false
      });
    }
  },

  createMember: async (data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.createMember(data);
      await orgApi.getMembers(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create member',
        loading: false
      });
    }
  },

  updateMember: async (memberId, data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.updateMember(memberId, data);
      await orgApi.getMembers(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update member',
        loading: false
      });
    }
  },

  deleteMember: async (memberId) => {
    set({ loading: true, error: null });
    try {
      await orgApi.deleteMember(memberId);
      await orgApi.getMembers(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete member',
        loading: false
      });
    }
  },

  // Goal Actions
  fetchGoals: async () => {
    set({ loading: true, error: null });
    try {
      const response = await orgApi.getGoals();
      set({ goals: response.data.data || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch goals',
        loading: false
      });
    }
  },

  createGoal: async (data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.createGoal(data);
      await orgApi.getGoals(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create goal',
        loading: false
      });
    }
  },

  updateGoal: async (goalId, data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.updateGoal(goalId, data);
      await orgApi.getGoals(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update goal',
        loading: false
      });
    }
  },

  deleteGoal: async (goalId) => {
    set({ loading: true, error: null });
    try {
      await orgApi.deleteGoal(goalId);
      await orgApi.getGoals(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete goal',
        loading: false
      });
    }
  },

  alignGoal: async (data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.alignGoal(data);
      await orgApi.getGoals(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to align goals',
        loading: false
      });
    }
  },

  // Approval Actions
  fetchApprovals: async (status) => {
    set({ loading: true, error: null });
    try {
      const response = await orgApi.getApprovals(status);
      set({ approvals: response.data.data || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch approvals',
        loading: false
      });
    }
  },

  createApproval: async (data) => {
    set({ loading: true, error: null });
    try {
      await orgApi.createApproval(data);
      await orgApi.getApprovals(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create approval',
        loading: false
      });
    }
  },

  approveApproval: async (approvalId, comment) => {
    set({ loading: true, error: null });
    try {
      await orgApi.approveApproval(approvalId, comment);
      await orgApi.getApprovals(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to approve',
        loading: false
      });
    }
  },

  rejectApproval: async (approvalId, comment) => {
    set({ loading: true, error: null });
    try {
      await orgApi.rejectApproval(approvalId, comment);
      await orgApi.getApprovals(); // Refresh
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reject',
        loading: false
      });
    }
  },

  // Audit Actions
  fetchAuditLogs: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await orgApi.getAuditLogs(params);
      set({
        auditLogs: response.data.data || [],
        loading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch audit logs',
        loading: false
      });
    }
  },

  fetchAuditSummary: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await orgApi.getAuditSummary(params);
      set({ auditSummary: response.data.data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch audit summary',
        loading: false
      });
    }
  },
}));
