# Phase 6 - 前端：Dashboard 可定制化

## 任务目标

实现 Dashboard 拖拽卡片布局，支持多套方案保存和切换。

## 修改/新建文件清单

```
frontend/src/pages/dashboard/DashboardPage.tsx     # 重构
frontend/src/components/dashboard/DashboardGrid.tsx  # 拖拽网格容器
frontend/src/components/dashboard/LayoutManager.tsx  # 布局方案管理
frontend/src/components/dashboard/cards/             # 卡片组件
frontend/src/components/dashboard/cards/TaskStatsCard.tsx
frontend/src/components/dashboard/cards/TokenUsageCard.tsx
frontend/src/components/dashboard/cards/CostCard.tsx
frontend/src/components/dashboard/cards/ActiveProjectsCard.tsx
frontend/src/components/dashboard/cards/AgentStatusCard.tsx
frontend/src/components/dashboard/cards/RecentTasksCard.tsx
frontend/src/api/dashboard.ts
frontend/src/stores/useDashboardStore.ts
```

## 依赖

```bash
npm install react-grid-layout @types/react-grid-layout
```

## 卡片类型与数据源

| 卡片 | API | 数据 |
|------|-----|------|
| 任务统计 | GET /api/v1/stats/personal | { running, completed, failed, total } |
| Token 消耗 | GET /api/v1/stats/personal | { today, week, month, total } |
| 成本统计 | GET /api/v1/stats/personal | { today, week, month, total } |
| 活跃项目 | GET /api/v1/stats/personal | { active, total } |
| Agent 状态 | GET /api/v1/stats/personal | { online, offline, total } |
| 最近任务 | GET /api/v1/stats/recent-tasks | [{ title, status, agent, time }] |

Admin 用户用 GET /api/v1/stats/global（全局维度）。

## DashboardGrid 组件

```typescript
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

// 布局数据结构
interface CardLayout {
  i: string;           // 卡片ID
  x: number;
  y: number;
  w: number;           // 宽度（格数，总宽12格）
  h: number;           // 高度（格数，每格约80px）
  minW?: number;
  minH?: number;
}

interface DashboardLayout {
  cards: Array<{
    id: string;
    type: 'task_stats' | 'token_usage' | 'cost' | 'active_projects' | 'agent_status' | 'recent_tasks';
    x: number;
    y: number;
    w: number;
    h: number;
    config?: Record<string, unknown>;
  }>;
}
```

### 默认布局

```typescript
const DEFAULT_LAYOUT: DashboardLayout = {
  cards: [
    { id: 'task-stats', type: 'task_stats', x: 0, y: 0, w: 6, h: 4 },
    { id: 'token-usage', type: 'token_usage', x: 6, y: 0, w: 6, h: 4 },
    { id: 'cost', type: 'cost', x: 0, y: 4, w: 6, h: 4 },
    { id: 'active-projects', type: 'active_projects', x: 6, y: 4, w: 6, h: 4 },
    { id: 'agent-status', type: 'agent_status', x: 0, y: 8, w: 4, h: 3 },
    { id: 'recent-tasks', type: 'recent_tasks', x: 4, y: 8, w: 8, h: 3 },
  ]
};
```

### 拖拽交互

```typescript
<ResponsiveGridLayout
  className="layout"
  layouts={{ lg: layouts }}
  breakpoints={{ lg: 1200, md: 996, sm: 768 }}
  cols={{ lg: 12, md: 10, sm: 6 }}
  rowHeight={80}
  onLayoutChange={handleLayoutChange}
  draggableHandle=".card-drag-handle"
  compactType="vertical"
>
  {cards.map(card => (
    <div key={card.id}>
      <CardComponent type={card.type} data={cardData[card.type]} />
    </div>
  ))}
</ResponsiveGridLayout>
```

### 卡片组件通用规范

每个卡片：
- 顶部：卡片标题 + 折叠/展开按钮 + 拖拽手柄（...图标）
- 内容：根据类型展示不同数据（数字、列表、图表）
- 样式：白色背景，圆角 8px，阴影，间距 16px
- 折叠后高度变为 minH

## LayoutManager 组件

```
┌──────────────────────────────────────┐
│ 布局方案管理              [+ 新建方案] │
├──────────────────────────────────────┤
│ ○ 默认布局          [编辑] [删除]     │
│ ○ 工作视图           [编辑] [删除]     │
│ ○ 简洁模式           [编辑] [删除]     │
└──────────────────────────────────────┘
```

- 从 API 加载用户的布局方案列表
- 选择方案后应用到 DashboardGrid
- 新建方案 = 保存当前布局为新方案
- 删除方案前二次确认

## Dashboard API 对接

```typescript
// src/api/dashboard.ts

// 获取布局方案
export const getLayouts = (scope: 'frontend' | 'admin') =>
  apiClient.get(`/dashboard/layouts?scope=${scope}`);

// 保存布局方案
export const saveLayout = (data: { scope, name, is_default, layout }) =>
  apiClient.post('/dashboard/layouts', data);

// 获取统计数据
export const getPersonalStats = () =>
  apiClient.get('/stats/personal');

export const getGlobalStats = () =>
  apiClient.get('/stats/global');
```

## 后台 Dashboard（admin）

与前台共享 DashboardGrid 组件，区别：
- 数据源：GET /api/v1/stats/global（全局维度）
- 卡片类型增加：用户统计、Bridge连接、系统健康
- scope = 'admin'
- admin 可看到更全面的统计维度

## 约束

- 浅色主题
- 卡片最小尺寸 3格宽 × 2格高
- 拖拽有吸附效果（snap to grid）
- 布局变更后自动保存（debounce 2秒）
- 首次访问无布局方案时使用默认布局

## 验收标准

- [ ] 6 种卡片正确展示数据
- [ ] 卡片可拖拽排列，松手后位置固定
- [ ] 卡片可折叠/展开
- [ ] 布局方案可保存/加载/切换/删除
- [ ] 默认布局首访自动创建
- [ ] admin 和 user 看到不同维度的数据
- [ ] 响应式：窗口缩放时卡片自动调整
