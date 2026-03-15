import { create } from 'zustand';
import { Agent } from '../types';
import { agentApi } from '../api/agents';

interface AgentsState {
  agents: Agent[];
  loading: boolean;
  error: string | null;

  fetchAgents: () => Promise<void>;
  createAgent: (agent: Partial<Agent>) => Promise<void>;
  updateAgent: (id: string, agent: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  getAgent: (id: string) => Promise<Agent>;
  startAgent: (id: string) => Promise<void>;
  stopAgent: (id: string) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const response: any = await agentApi.list();
      set({ agents: response?.data?.items ?? response?.data ?? [], loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch agents', loading: false });
    }
  },

  createAgent: async (agentData) => {
    set({ loading: true, error: null });
    try {
      const response: any = await agentApi.create(agentData as any);
      set((state) => ({
        agents: [...state.agents, response?.data ?? response],
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create agent', loading: false });
    }
  },

  updateAgent: async (id, agentData) => {
    set({ loading: true, error: null });
    try {
      const response: any = await agentApi.update(id, agentData as Record<string, unknown>);
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id ? (response?.data ?? agent) : agent
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update agent', loading: false });
    }
  },

  deleteAgent: async (id) => {
    set({ loading: true, error: null });
    try {
      await agentApi.delete(id);
      set((state) => ({
        agents: state.agents.filter((agent) => agent.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete agent', loading: false });
    }
  },

  getAgent: async (id) => {
    set({ loading: true, error: null });
    try {
      const response: any = await agentApi.getById(id);
      set({ loading: false });
      return response?.data ?? response;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch agent', loading: false });
      throw error;
    }
  },

  startAgent: async (id) => {
    set({ loading: true, error: null });
    try {
      await agentApi.start(id);
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id
            ? { ...agent, status: 'busy' as const }
            : agent
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to start agent', loading: false });
    }
  },

  stopAgent: async (id) => {
    set({ loading: true, error: null });
    try {
      await agentApi.stop(id);
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id
            ? { ...agent, status: 'online' as const }
            : agent
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to stop agent', loading: false });
    }
  },
}));
