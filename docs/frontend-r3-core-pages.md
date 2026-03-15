# Nexus 前端 — 第 3 轮：核心页面（Dashboard + Agent + Project）

> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/frontend/`
> **前置条件**: 第 1-2 轮已完成（Token + 主题 + 认证 + 布局）
> **完整文档参考**: `../docs/frontend-dev-prompt.md`

---

## 任务清单

### 1. API 模块 — `src/api/`

#### `src/api/agents.ts`
```typescript
import api from './client';
import type { AgentInstance, AgentType, PagedData } from '@/types';

export const agentApi = {
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    api.get('/agents', { params }),
  getById: (id: string) => api.get(`/agents/${id}`),
  create: (data: { type_id: string; name: string; model?: string; config?: Record<string, any> }) =>
    api.post('/agents', data),
  update: (id: string, data: any) => api.put(`/agents/${id}`, data),
  delete: (id: string) => api.delete(`/agents/${id}`),
  test: (id: string) => api.post(`/agents/${id}/test`),
  start: (id: string) => api.post(`/agents/${id}/start`),
  stop: (id: string) => api.post(`/agents/${id}/stop`),
  getLogs: (id: string, params?: any) => api.get(`/agents/${id}/logs`, { params }),
  getTypes: () => api.get('/agent-types'),
};
```

#### `src/api/projects.ts`
```typescript
export const projectApi = {
  list: (params?: any) => api.get('/projects', { params }),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name: string; description?: string; spec?: string }) =>
    api.post('/projects', data),
  update: (id: string, data: any) => api.put(`/projects/${id}`, data),
  archive: (id: string) => api.delete(`/projects/${id}`),
  getTasks: (projectId: string, params?: any) =>
    api.get(`/projects/${projectId}/tasks`, { params }),
  createTask: (projectId: string, data: any) =>
    api.post(`/projects/${projectId}/tasks`, data),
};
```

#### `src/api/stats.ts`
```typescript
export const statsApi = {
  getDashboard: () => api.get('/stats/dashboard'),
  getProjectStats: (id: string) => api.get(`/stats/projects/${id}`),
  getAgentStats: (id: string) => api.get(`/stats/agents/${id}`),
};
```

### 2. Dashboard 页面 — `src/pages/dashboard/DashboardPage.tsx`

**布局**：

```
┌──────────┬──────────┬──────────┬──────────┐
│ Agent    │ 项目     │ 任务     │ 今日Token │  ← 4 个统计卡片（一行）
│ 3/5 在线 │ 8 个     │ 45 完成  │ 50K      │
├──────────┴──────────┴──────────┴──────────┤
│                                                │
│  [Agent 状态面板]      [最近任务列表]          │  ← 两列布局
│                                                │
├────────────────────────────────────────────────┤
│  Token 消耗趋势图（最近 7 天）                  │
└────────────────────────────────────────────────┘
```

**统计卡片**（4 个一行，等宽）：
1. **Agent 在线** — 图标 RobotOutlined，显示 `online / total`，在线数绿色
2. **项目数** — 图标 ProjectOutlined，显示 `active / total`
3. **任务完成率** — 图标 CheckCircleOutlined，显示百分比 + 小进度条
4. **今日 Token** — 图标 ThunderboltOutlined，显示数字 + "tokens"

卡片样式：背景 `#141414`，边框 `rgba(255,255,255,0.06)`，圆角 `12px`，内边距 `24px`

**Agent 状态面板**：
- 在线 Agent 列表（卡片视图）
- 每个 Agent：名称、类型徽章、状态指示灯（绿色=在线）、模型

**最近任务列表**：
- Ant Design Table，最近 10 条
- 列：任务名、项目、状态（StatusBadge）、创建时间

**Token 趋势图**：
- Recharts AreaChart，最近 7 天
- X 轴日期，Y 轴 token 数
- 颜色用 Indigo 半透明填充

**数据获取**：用 `react-query`，`useQuery('dashboard', statsApi.getDashboard)`

### 3. Agent 列表页 — `src/pages/agents/AgentListPage.tsx`

**布局**：
- PageHeader: "代理中心" + [创建代理] Primary 按钮
- 工具栏：搜索框 + 视图切换（卡片/表格）
- Agent 卡片网格（2-3 列）

**Agent 卡片**（`AgentCard.tsx`）：
```
┌─────────────────────────┐
│ ● 在线     CC Agent 1   │  ← 状态灯 + 名称
│ Claude Code              │  ← 类型
│ Model: claude-3-sonnet   │  ← 模型
│ ─────────────────────── │
│ 任务 8  完成 6  失败 1   │  ← 统计
│ Token: 150K  Cost: $3.5  │
│                [详情 →] │
└─────────────────────────┘
```

- 背景 `#141414`，边框 `rgba(255,255,255,0.06)`，圆角 `12px`
- Hover：边框 `rgba(255,255,255,0.10)` + `translateY(-1px)` + `shadow.sm`
- 状态灯：online 绿色脉冲 / offline 灰色 / busy 橙色 / error 红色

**空状态**：引导创建第一个 Agent（"还没有代理，点击创建开始使用"）

**Loading**：Skeleton 卡片占位

### 4. 创建 Agent 页 — `src/pages/agents/AgentNewPage.tsx`

**步骤表单**（Ant Design Steps）：
1. **选择类型** — 卡片选择 AgentType（CC / Codex / OpenCode / OpenClaw）
2. **配置参数** — 根据选择的类型动态渲染表单（名称、模型、连接参数）
3. **确认创建** — 预览配置，确认创建

### 5. Agent 详情页 — `src/pages/agents/AgentDetailPage.tsx`

**布局**（Tab 切换）：
- **概览** — Agent 信息卡片 + 统计数据
- **日志** — 日志列表（带分页）
- **配置** — 查看/编辑配置

### 6. 项目列表页 — `src/pages/projects/ProjectListPage.tsx`

**布局**：
- PageHeader: "项目" + [创建项目] Primary 按钮
- 项目卡片网格（2-3 列）

**项目卡片**：
```
┌─────────────────────────┐
│ Project Name            │
│ 描述文字（最多 2 行）     │
│ ─────────────────────── │
│ 任务 12  完成 8  ✓ 67%  │  ← 进度条
│ Token: 500K             │
│ active ●                │
└─────────────────────────┘
```

### 7. 项目详情页 — `src/pages/projects/ProjectDetailPage.tsx`

**布局**：
- PageHeader: 项目名 + [编辑] [归档] 按钮
- 项目信息卡片（名称、描述、spec、状态、统计）
- 任务列表（Ant Design Table）
  - 列：名称、优先级、状态（StatusBadge）、Agent、创建时间
  - 顶部 [创建任务] 按钮
  - 支持分页

### 8. 任务详情页 — `src/pages/tasks/TaskDetailPage.tsx`

**布局**：
- PageHeader: 任务名 + [编辑] [删除] 按钮
- 任务信息：优先级、状态、描述、Spec、依赖关系
- Job 列表（Ant Design Table）
  - 列：名称、状态（StatusBadge）、Agent、Token 消耗、耗时
  - 支持重试、审批操作按钮

### 9. 更新路由

在 `App.tsx` 的 MainLayout 子路由中添加：
```tsx
<Route path="projects" element={<ProjectListPage />} />
<Route path="projects/:id" element={<ProjectDetailPage />} />
<Route path="agents" element={<AgentListPage />} />
<Route path="agents/new" element={<AgentNewPage />} />
<Route path="agents/:id" element={<AgentDetailPage />} />
<Route path="tasks/:id" element={<TaskDetailPage />} />
```

### 10. 更新 Sidebar 导航

确保菜单项与路由匹配：
- Dashboard（首页）
- 项目（/projects）
- 代理中心（/agents）
- Gateway（/gateway，保留现有）
- 设置（/settings）

---

## 输出要求

1. Dashboard 显示 4 个统计卡片 + Agent 状态 + 最近任务 + Token 图表
2. Agent 列表页能显示 Agent 卡片（或空状态）
3. 创建 Agent 步骤表单能走通
4. 项目列表页能显示项目卡片
5. 项目详情页能显示任务列表
6. 任务详情页能显示 Job 列表
7. 所有页面 Loading/Empty/Error 状态正常
8. 所有样式使用 Design Token，暗色主题一致

---

## ⚠️ 注意

- **用 react-query** 管理数据请求和缓存
- **用 useNavigate** 做页面跳转
- **StatusBadge 组件复用**，所有状态显示统一
- **卡片 hover 效果**必须有
- **分页**用 Ant Design Pagination
- 不动 Gateway 页面
- 下一轮：Settings + Admin 页面 + 打磨
