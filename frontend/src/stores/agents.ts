import { create } from 'zustand';
import { Agent } from '../types';
import { agentsApi } from '../api/agents';

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

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const response = await agentsApi.getAgents();
      set({ agents: response.data, loading: false });
    } catch (error) {
      set({ error: error.message || 'Failed to fetch agents', loading: false });
    }
  },

  createAgent: async (agentData) => {
    set({ loading: true, error: null });
    try {
      const response = await agentsApi.createAgent(agentData);
      set((state) => ({
        agents: [...state.agents, response.data],
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to create agent', loading: false });
    }
  },

  updateAgent: async (id, agentData) => {
    set({ loading: true, error: null });
    try {
      const response = await agentsApi.updateAgent(id, agentData);
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id ? response.data : agent
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to update agent', loading: false });
    }
  },

  deleteAgent: async (id) => {
    set({ loading: true, error: null });
    try {
      await agentsApi.deleteAgent(id);
      set((state) => ({
        agents: state.agents.filter((agent) => agent.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to delete agent', loading: false });
    }
  },

  getAgent: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await agentsApi.getAgent(id);
      set({ loading: false });
      return response.data;
    } catch (error) {
      set({ error: error.message || 'Failed to fetch agent', loading: false });
      throw error;
    }
  },

  startAgent: async (id) => {
    set({ loading: true, error: null });
    try {
      await agentsApi.startAgent(id);
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id
            ? { ...agent, status: 'busy' as const }
            : agent
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to start agent', loading: false });
    }
  },

  stopAgent: async (id) => {
    set({ loading: true, error: null });
    try {
      await agentsApi.stopAgent(id);
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id
            ? { ...agent, status: 'online' as const }
            : agent
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to stop agent', loading: false });
    }
  },
}));