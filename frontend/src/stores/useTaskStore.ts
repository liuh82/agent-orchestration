import { create } from 'zustand';

interface TaskStoreState {
  selectedTaskIds: Set<string>;
  toggleSelect: (taskId: string) => void;
  selectRange: (fromId: string, toId: string, allIds: string[]) => void;
  clearSelection: () => void;
  setSelection: (ids: string[]) => void;
  isSelected: (taskId: string) => boolean;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  selectedTaskIds: new Set<string>(),

  toggleSelect: (taskId: string) => {
    set((state) => {
      const next = new Set(state.selectedTaskIds);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return { selectedTaskIds: next };
    });
  },

  selectRange: (fromId: string, toId: string, allIds: string[]) => {
    const fromIdx = allIds.indexOf(fromId);
    const toIdx = allIds.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    const rangeIds = allIds.slice(start, end + 1);
    set((state) => ({
      selectedTaskIds: new Set([...state.selectedTaskIds, ...rangeIds]),
    }));
  },

  clearSelection: () => set({ selectedTaskIds: new Set() }),

  setSelection: (ids: string[]) => set({ selectedTaskIds: new Set(ids) }),

  isSelected: (taskId: string) => get().selectedTaskIds.has(taskId),
}));
