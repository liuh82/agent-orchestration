import { create } from 'zustand';
import { Task } from '../types';
import { tasksApi } from '../api/tasks';

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;

  fetchTasks: (params?: any) => Promise<void>;
  createTask: (task: Partial<Task>) => Promise<void>;
  updateTask: (id: string, task: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getTask: (id: string) => Promise<Task>;
  executeTask: (id: string) => Promise<void>;
  pauseTask: (id: string) => Promise<void>;
  resumeTask: (id: string) => Promise<void>;
  cancelTask: (id: string) => Promise<void>;
  assignTask: (id: string, agentId: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await tasksApi.getTasks(params);
      set({ tasks: response.data, loading: false });
    } catch (error) {
      set({ error: error.message || 'Failed to fetch tasks', loading: false });
    }
  },

  createTask: async (taskData) => {
    set({ loading: true, error: null });
    try {
      const response = await tasksApi.createTask(taskData);
      set((state) => ({
        tasks: [...state.tasks, response.data],
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to create task', loading: false });
    }
  },

  updateTask: async (id, taskData) => {
    set({ loading: true, error: null });
    try {
      const response = await tasksApi.updateTask(id, taskData);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === id ? response.data : task
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to update task', loading: false });
    }
  },

  deleteTask: async (id) => {
    set({ loading: true, error: null });
    try {
      await tasksApi.deleteTask(id);
      set((state) => ({
        tasks: state.tasks.filter((task) => task.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to delete task', loading: false });
    }
  },

  getTask: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await tasksApi.getTask(id);
      set({ loading: false });
      return response.data;
    } catch (error) {
      set({ error: error.message || 'Failed to fetch task', loading: false });
      throw error;
    }
  },

  executeTask: async (id) => {
    set({ loading: true, error: null });
    try {
      await tasksApi.executeTask(id);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === id
            ? { ...task, status: 'running' as const }
            : task
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to execute task', loading: false });
    }
  },

  pauseTask: async (id) => {
    set({ loading: true, error: null });
    try {
      await tasksApi.pauseTask(id);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === id
            ? { ...task, status: 'pending' as const }
            : task
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to pause task', loading: false });
    }
  },

  resumeTask: async (id) => {
    set({ loading: true, error: null });
    try {
      await tasksApi.resumeTask(id);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === id
            ? { ...task, status: 'running' as const }
            : task
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to resume task', loading: false });
    }
  },

  cancelTask: async (id) => {
    set({ loading: true, error: null });
    try {
      await tasksApi.cancelTask(id);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === id
            ? { ...task, status: 'cancelled' as const }
            : task
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to cancel task', loading: false });
    }
  },

  assignTask: async (id, agentId) => {
    set({ loading: true, error: null });
    try {
      await tasksApi.assignTask(id, agentId);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === id
            ? { ...task, assignedTo: agentId }
            : task
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to assign task', loading: false });
    }
  },
}));