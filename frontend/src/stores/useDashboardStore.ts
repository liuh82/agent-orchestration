import { create } from 'zustand';
import type { ResponsiveLayouts } from 'react-grid-layout';

export type CardType = 'task_stats' | 'token_usage' | 'cost' | 'active_projects' | 'agent_status' | 'recent_tasks' | 'bridge_status' | 'task_timeline';

export interface DashboardCardDef {
  id: string;
  type: CardType;
}

export interface DashboardLayoutDef {
  id: string;
  name: string;
  is_default: boolean;
  cards: DashboardCardDef[];
  layout?: {
    cards: DashboardCardDef[];
    layouts: ResponsiveLayouts;
  };
}

export interface DashboardState {
  layouts: ResponsiveLayouts;
  cards: DashboardCardDef[];
  layoutDefs: DashboardLayoutDef[];
  activeLayoutId: string | null;
  collapsedCards: Set<string>;

  setLayouts: (layouts: ResponsiveLayouts) => void;
  setCards: (cards: DashboardCardDef[]) => void;
  setLayoutDefs: (defs: DashboardLayoutDef[]) => void;
  setActiveLayoutId: (id: string | null) => void;
  toggleCollapse: (cardId: string) => void;
}

export const DEFAULT_CARDS: DashboardCardDef[] = [
  { id: 'task-stats', type: 'task_stats' },
  { id: 'token-usage', type: 'token_usage' },
  { id: 'cost', type: 'cost' },
  { id: 'active-projects', type: 'active_projects' },
  { id: 'agent-status', type: 'agent_status' },
  { id: 'bridge-status', type: 'bridge_status' },
  { id: 'recent-tasks', type: 'recent_tasks' },
  { id: 'task-timeline', type: 'task_timeline' },
];

export const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'task-stats', x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'token-usage', x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'cost', x: 0, y: 4, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'active-projects', x: 6, y: 4, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'agent-status', x: 0, y: 8, w: 4, h: 3, minW: 3, minH: 2 },
    { i: 'bridge-status', x: 4, y: 8, w: 8, h: 4, minW: 3, minH: 2 },
    { i: 'recent-tasks', x: 0, y: 12, w: 6, h: 3, minW: 3, minH: 2 },
    { i: 'task-timeline', x: 6, y: 12, w: 6, h: 5, minW: 3, minH: 2 },
  ],
  md: [
    { i: 'task-stats', x: 0, y: 0, w: 5, h: 4, minW: 3, minH: 2 },
    { i: 'token-usage', x: 5, y: 0, w: 5, h: 4, minW: 3, minH: 2 },
    { i: 'cost', x: 0, y: 4, w: 5, h: 4, minW: 3, minH: 2 },
    { i: 'active-projects', x: 5, y: 4, w: 5, h: 4, minW: 3, minH: 2 },
    { i: 'agent-status', x: 0, y: 8, w: 5, h: 3, minW: 3, minH: 2 },
    { i: 'bridge-status', x: 5, y: 8, w: 5, h: 4, minW: 3, minH: 2 },
    { i: 'recent-tasks', x: 0, y: 12, w: 5, h: 3, minW: 3, minH: 2 },
    { i: 'task-timeline', x: 5, y: 12, w: 5, h: 5, minW: 3, minH: 2 },
  ],
  sm: [
    { i: 'task-stats', x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'token-usage', x: 0, y: 4, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'cost', x: 0, y: 8, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'active-projects', x: 0, y: 12, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'agent-status', x: 0, y: 16, w: 6, h: 3, minW: 3, minH: 2 },
    { i: 'bridge-status', x: 0, y: 19, w: 6, h: 4, minW: 3, minH: 2 },
    { i: 'recent-tasks', x: 0, y: 23, w: 6, h: 3, minW: 3, minH: 2 },
    { i: 'task-timeline', x: 0, y: 26, w: 6, h: 5, minW: 3, minH: 2 },
  ],
};

export const useDashboardStore = create<DashboardState>((set) => ({
  layouts: DEFAULT_LAYOUTS,
  cards: DEFAULT_CARDS,
  layoutDefs: [],
  activeLayoutId: null,
  collapsedCards: new Set(),

  setLayouts: (layouts) => set({ layouts }),

  setCards: (cards) => set({ cards }),

  setLayoutDefs: (defs) => set({ layoutDefs: defs }),

  setActiveLayoutId: (id) => set({ activeLayoutId: id }),

  toggleCollapse: (cardId) =>
    set((state) => {
      const next = new Set(state.collapsedCards);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return { collapsedCards: next };
    }),
}));
