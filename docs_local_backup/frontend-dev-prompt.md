# Nexus 前端开发任务 — 第一轮迭代

> **目标读者**: 前端开发 Agent（CC / Codex）
> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/frontend/`
> **项目名称**: Nexus（原 agent-orchestration）
> **迭代轮次**: 第一轮（重构 + 登录注册 + Agent 管理 + 项目任务 + 设置）

---

## 一、项目背景

Nexus 是一个 AI Agent 编排管理系统。当前前端是 v2.4.0 版本的单用户无认证应用，需要重构为支持多用户登录、有权限控制的新前端。

**本轮核心目标**：
1. 搭建 Design Token 系统 + Ant Design 主题覆盖
2. 登录/注册页面 + 路由守卫
3. 主布局重构（Header + Sidebar + Content）
4. Agent 实例管理页面
5. 项目/任务管理页面（基础版）
6. 个人设置 + 通知通道配置
7. Dashboard 基础版

---

## 二、参考文档（开发前必读）

| 文件 | 路径 | 用途 |
|------|------|------|
| **🚨 前端设计规范** | `DESIGN_SPEC.md` | **强制约束！所有代码必须遵循** |
| **需求文档** | `../docs/requirements-v1.3.md` | 功能需求 |
| **架构设计** | `../docs/architecture-v1.md` | 路由结构、目录规划 |
| **后端 API 提示词** | `../docs/backend-dev-prompt.md` | 后端 API 接口定义（你调用的接口） |

**⚠️ 最重要的文件：`DESIGN_SPEC.md` — 必须逐字阅读，所有样式必须使用 Design Token，禁止硬编码！**

---

## 三、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.2 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Ant Design | 5.11 | 组件库（主 UI） |
| styled-components | 6.3 | 自定义组件样式 |
| Zustand | 4.4 | 状态管理 |
| react-query | 3.39 | 数据请求 + 缓存 |
| react-router-dom | 6.20 | 路由 |
| Recharts | 2.8 | 图表（Dashboard 用） |
| React Flow | 10.3 | 流程图（后续轮次） |

---

## 四、设计规范（核心摘要）

> 以下是从 `DESIGN_SPEC.md` 提取的核心约束，**开发时必须严格遵守**。

### 4.1 风格参考
- **Linear.app**（极致简洁、暗色主题）
- **Vercel Dashboard**（层次清晰、精致）

### 4.2 强制规则

| 规则 | 说明 |
|------|------|
| **必须使用 Design Token** | 禁止 `#333`、`padding: 13px` 等硬编码 |
| **必须使用 Ant Design 组件** | 优先 antd，自定义用 styled-components |
| **必须有 Hover 状态** | 可交互元素必须有 hover/focus/active |
| **必须有 Loading 状态** | 加载时显示 Skeleton 或 Spin |
| **必须有 Empty 状态** | 无数据时显示 Empty |
| **必须有 Error 状态** | 失败时显示错误 + 重试按钮 |
| **组件超 200 行必须拆分** | 单文件不超过 200 行 |

### 4.3 颜色 Token

```typescript
// 🚨 所有颜色必须从 tokens/color.ts 导入，禁止硬编码
import { colors } from '@/styles/tokens/color';

// 品牌色
primary: '#6366f1'  // Indigo

// 暗色主题
background:  '#0a0a0a'   // 页面背景
surface:     '#141414'   // 卡片/面板
raised:      '#1a1a1a'   // 弹出层
border:      'rgba(255,255,255,0.06)'  // 默认边框
borderHover: 'rgba(255,255,255,0.10)'  // Hover 边框
textPrimary: '#fafafa'
textSecondary: '#a3a3a3'
textMuted:   '#737373'

// 语义色
success: '#22c55e'
error:   '#ef4444'
warning: '#f59e0b'
info:    '#3b82f6'
```

### 4.4 间距 Token

```typescript
import { spacing } from '@/styles/tokens/spacing';
// 基准 4px，所有间距必须是 4 的倍数
// 最常用：8px, 16px, 24px, 32px
// 组件内边距：16-24px
// 组件间距：24px
// 页面内边距：24px
// 最大宽度：1400px
```

### 4.5 字体 Token

```typescript
import { typography } from '@/styles/tokens/typography';
// 主字体：Inter
// 等宽：JetBrains Mono
// 正文：14px Regular
// 标题：20px Semibold
// 辅助：12px Regular
// 最小：11px（标签）
```

### 4.6 Ant Design 主题覆盖

```typescript
// 🚨 所有页面必须被 ConfigProvider 包裹
import { ConfigProvider } from 'antd';
import { antdTheme } from '@/styles/antd-theme';

// 核心 token：
// colorPrimary: '#6366f1'
// colorBgContainer: '#141414'
// colorBgElevated: '#1a1a1a'
// colorBorder: 'rgba(255,255,255,0.06)'
// colorText: '#fafafa'
// colorTextSecondary: '#a3a3a3'
// borderRadius: 8
// fontSize: 14
```

### 4.7 状态徽章规范

```typescript
// Agent/Job/Task 的状态显示必须使用统一徽章
const statusColors = {
  running:   { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', dot: '#6366f1' },
  completed: { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', dot: '#22c55e' },
  failed:    { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', dot: '#ef4444' },
  pending:   { bg: 'rgba(163,163,163,0.12)', text: '#a3a3a3', dot: '#737373' },
  offline:   { bg: 'rgba(115,115,115,0.08)', text: '#737373', dot: '#525252' },
};
// 圆角 4px，内边距 2px 8px，字号 12px，带颜色圆点
```

### 4.8 动画

```typescript
// Hover/Active: 100ms ease-out
// 展开/收起: 150ms
// 页面过渡: 300ms
// 元素进入: 200ms ease-out (fadeIn + translateY 8px)
```

### 4.9 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase.tsx | `TaskCard.tsx` |
| 样式组件 | PascalCase | `const StyledCard = styled.div...` |
| Token 文件 | kebab-case.ts | `color.ts` |
| 页面组件 | PascalCase + Page | `TaskCenterPage.tsx` |

---

## 五、路由结构

### 前台（用户，需登录）

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | LoginPage | 登录 |
| `/register` | RegisterPage | 注册 |
| `/` | DashboardPage | Dashboard（默认页） |
| `/projects` | ProjectListPage | 项目列表 |
| `/projects/:id` | ProjectDetailPage | 项目详情 |
| `/projects/:id/tasks` | TaskListPage | 项目下任务列表 |
| `/tasks/:id` | TaskDetailPage | 任务详情（含 Jobs） |
| `/jobs/:id` | JobDetailPage | Job 详情 |
| `/agents` | AgentListPage | Agent 实例列表 |
| `/agents/new` | AgentNewPage | 创建 Agent |
| `/agents/:id` | AgentDetailPage | Agent 详情 |
| `/gateway` | GatewayPage | Gateway 监控（保留现有） |
| `/settings` | SettingsPage | 个人设置 |
| `/settings/notifications` | NotificationPage | 通知通道配置 |

### 后台（Admin）

| 路径 | 页面 | 说明 |
|------|------|------|
| `/admin` | AdminDashboard | 后台概览 |
| `/admin/users` | UserManagePage | 用户管理 |
| `/admin/agent-types` | AgentTypePage | Agent 类型配置 |
| `/admin/settings` | SystemSettingsPage | 系统设置 |
| `/admin/notifications` | AdminNotificationPage | 全局通知 |
| `/admin/stats` | AdminStatsPage | 全局统计 |

### 路由守卫

```typescript
// ProtectedRoute: 未登录 → /login
// AdminRoute: 非 admin → /403
// GuestRoute: 已登录 → /
```

---

## 六、API 接口（后端提供的，你调用的）

### Base URL
- 开发：`http://localhost:8081/api/v1`
- 生产：`/api/v1`（Nginx 反代）

### 认证头
```
Authorization: Bearer <access_token>
```

### 认证 API
```
POST /api/v1/auth/register  {email, password, name}  → {user, access_token, refresh_token}
POST /api/v1/auth/login     {email, password}         → {user, access_token, refresh_token}
POST /api/v1/auth/refresh   {refresh_token}           → {access_token, refresh_token}
GET  /api/v1/auth/me                                 → {user}
PUT  /api/v1/auth/me        {name?, avatar?, settings?}
PUT  /api/v1/auth/password  {old_password, new_password}
```

### Agent API
```
GET    /api/v1/agents                    → PagedResponse<AgentInstance>
POST   /api/v1/agents        {type_id, name, model, config}
GET    /api/v1/agents/:id                → AgentInstance
PUT    /api/v1/agents/:id     {...}
DELETE /api/v1/agents/:id
POST   /api/v1/agents/:id/test
POST   /api/v1/agents/:id/start
POST   /api/v1/agents/:id/stop
GET    /api/v1/agents/:id/logs          → PagedResponse<AgentLog>
GET    /api/v1/agent-types              → AgentType[]
```

### 项目 API
```
GET    /api/v1/projects                 → PagedResponse<Project>
POST   /api/v1/projects      {name, description, spec}
GET    /api/v1/projects/:id             → Project
PUT    /api/v1/projects/:id
DELETE /api/v1/projects/:id
```

### 任务 API
```
GET    /api/v1/projects/:pid/tasks      → PagedResponse<Task>
POST   /api/v1/projects/:pid/tasks  {name, description, spec, priority}
GET    /api/v1/tasks/:id                → Task
PUT    /api/v1/tasks/:id
DELETE /api/v1/tasks/:id
```

### Job API
```
GET    /api/v1/tasks/:tid/jobs          → PagedResponse<Job>
GET    /api/v1/jobs/:id                 → Job
POST   /api/v1/jobs/:id/retry
POST   /api/v1/jobs/:id/approve
POST   /api/v1/jobs/:id/reject
```

### 统计 API
```
GET    /api/v1/stats/dashboard          → DashboardStats
GET    /api/v1/stats/projects/:id       → ProjectStats
GET    /api/v1/stats/agents/:id         → AgentStats
```

### 通用响应格式
```typescript
// 成功
interface ApiResponse<T> {
  code: number;      // 0 = 成功
  data: T;
  message: string;
}

// 分页
interface PagedResponse<T> {
  code: number;
  data: {
    items: T[];
    total: number;
    page: number;
    page_size: number;
  };
  message: string;
}
```

### 错误处理
```typescript
// HTTP 状态码：401（未认证）、403（无权限）、404（不存在）、409（重复）、500（服务器错误）
// 统一在前端 axios 拦截器中处理：
// - 401 → 自动跳转 /login
// - 403 → 显示权限不足提示
// - 其他 → 显示错误 message
```

---

## 七、目录结构

```
frontend/
├── src/
│   ├── api/                         # API 客户端
│   │   ├── client.ts                # axios 实例（JWT 拦截器、自动刷新、错误处理）
│   │   ├── auth.ts                  # login, register, refresh, getMe, updateMe
│   │   ├── agents.ts                # Agent CRUD + 启停 + 日志
│   │   ├── projects.ts              # Project CRUD
│   │   ├── tasks.ts                 # Task CRUD
│   │   ├── jobs.ts                  # Job CRUD + 重试 + 审批
│   │   ├── stats.ts                 # Dashboard + 统计
│   │   ├── settings.ts              # 系统设置
│   │   └── notifications.ts         # 通知通道
│   │
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── MainLayout.tsx       # 主布局（Header + Sidebar + Content）
│   │   │   ├── Sidebar.tsx          # 侧边栏导航
│   │   │   ├── Header.tsx           # 顶部栏（Logo + 搜索 + 通知 + 设置 + 头像）
│   │   │   └── AdminLayout.tsx      # Admin 后台布局（带 Admin 侧边栏）
│   │   ├── Auth/
│   │   │   ├── ProtectedRoute.tsx   # 路由守卫（检查登录）
│   │   │   ├── AdminRoute.tsx       # Admin 路由守卫
│   │   │   └── GuestRoute.tsx       # 未登录路由（已登录重定向 /）
│   │   ├── common/
│   │   │   ├── StatusBadge.tsx      # 统一状态徽章（running/completed/failed/pending）
│   │   │   ├── EmptyState.tsx       # 空状态组件
│   │   │   ├── ErrorBlock.tsx       # 错误状态（带重试）
│   │   │   ├── PageHeader.tsx       # 页面标题栏
│   │   │   └── TokenUsageCard.tsx   # Token 消耗卡片
│   │   └── agents/
│   │       ├── AgentCard.tsx        # Agent 实例卡片
│   │       └── AgentConfigForm.tsx  # Agent 配置表单
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx        # 登录页（居中卡片，邮箱+密码）
│   │   │   └── RegisterPage.tsx     # 注册页
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx    # Dashboard（统计卡片 + Agent 状态 + 最近任务）
│   │   ├── agents/
│   │   │   ├── AgentListPage.tsx    # Agent 列表（卡片网格 / 表格切换）
│   │   │   ├── AgentNewPage.tsx     # 创建 Agent（选类型 → 配置 → 创建）
│   │   │   └── AgentDetailPage.tsx  # Agent 详情（状态 + 统计 + 日志 + 配置）
│   │   ├── projects/
│   │   │   ├── ProjectListPage.tsx  # 项目列表（卡片视图）
│   │   │   ├── ProjectDetailPage.tsx # 项目详情（任务列表）
│   │   │   └── TaskListPage.tsx     # 项目下的任务列表
│   │   ├── tasks/
│   │   │   ├── TaskDetailPage.tsx   # 任务详情（含 Job 列表）
│   │   │   └── JobDetailPage.tsx    # Job 详情（会话内容 + 文件 + 日志）
│   │   ├── settings/
│   │   │   ├── SettingsPage.tsx     # 个人设置（信息 + 密码）
│   │   │   └── NotificationPage.tsx # 通知通道配置
│   │   ├── gateway/
│   │   │   └── GatewayPage.tsx      # 保留现有
│   │   └── admin/
│   │       ├── AdminDashboard.tsx   # Admin 概览（全局统计）
│   │       ├── UserManagePage.tsx   # 用户管理表格
│   │       ├── AgentTypePage.tsx    # Agent 类型配置
│   │       ├── SystemSettingsPage.tsx # 系统设置
│   │       ├── AdminNotificationPage.tsx # 全局通知
│   │       └── AdminStatsPage.tsx   # 全局统计图表
│   │
│   ├── stores/
│   │   ├── auth.ts                  # 用户认证状态（token, user, login/logout）
│   │   ├── agents.ts                # Agent 列表状态
│   │   ├── projects.ts              # 项目列表状态
│   │   └── ui.ts                    # UI 状态（侧边栏折叠、主题）
│   │
│   ├── styles/
│   │   ├── tokens/                  # 🚨 Design Token（必须使用）
│   │   │   ├── color.ts             # 颜色系统
│   │   │   ├── spacing.ts           # 间距系统
│   │   │   ├── typography.ts        # 字体系统
│   │   │   ├── radius.ts            # 圆角系统
│   │   │   ├── shadow.ts            # 阴影系统
│   │   │   └── animation.ts         # 动画系统
│   │   ├── antd-theme.ts            # ConfigProvider 主题覆盖
│   │   └── global.ts                # 全局样式 + Keyframes + Google Fonts import
│   │
│   ├── types/                       # TypeScript 类型定义
│   │   ├── auth.ts                  # User, LoginRequest, RegisterRequest, TokenResponse
│   │   ├── agent.ts                 # AgentType, AgentInstance, AgentConfig
│   │   ├── project.ts               # Project
│   │   ├── task.ts                  # Task
│   │   ├── job.ts                   # Job
│   │   ├── stats.ts                 # DashboardStats
│   │   └── api.ts                   # ApiResponse<T>, PagedResponse<T>
│   │
│   ├── hooks/                       # 自定义 Hooks
│   │   ├── useAuth.ts               # 登录/登出/刷新
│   │   └── usePagination.ts         # 分页逻辑
│   │
│   ├── App.tsx                      # ConfigProvider + Router
│   └── main.tsx                     # React 渲染入口
│
├── DESIGN_SPEC.md                   # 🚨 前端设计规范（必读）
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 八、核心实现要点

### 8.1 API 客户端（带 JWT 拦截器）

```typescript
// api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
});

// 请求拦截：自动加 Authorization 头
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：401 自动刷新 token，刷新失败跳转登录
api.interceptors.response.use(
  (response) => response.data,  // 直接返回 data 层
  async (error) => {
    if (error.response?.status === 401) {
      const refreshed = await useAuthStore.getState().refreshToken();
      if (refreshed) {
        return api(error.config);  // 重试原请求
      }
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);
```

### 8.2 路由守卫

```typescript
// components/Auth/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export const ProtectedRoute = ({ children }) => {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

export const AdminRoute = ({ children }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

export const GuestRoute = ({ children }) => {
  const { user } = useAuthStore();
  if (user) return <Navigate to="/" replace />;
  return children;
};
```

### 8.3 布局组件

```typescript
// Layout/MainLayout.tsx — 核心
// Header: 56px 高度，[Logo] [搜索] ... [通知] [设置] [头像下拉]
// Sidebar: 240px 宽度，可折叠到 64px
// Content: 内边距 24px，最大宽度 1400px 居中
// 背景色: #0a0a0a
// 卡片背景: #141414，边框 rgba(255,255,255,0.06)，圆角 12px

// Layout/AdminLayout.tsx — 在 MainLayout 基础上换 Admin 侧边栏
// Admin 侧边栏：后台首页、用户管理、Agent 类型、系统设置、通知、统计
```

### 8.4 登录/注册页

```typescript
// 登录页：
// - 全屏暗色背景 #0a0a0a
// - 居中白色卡片（#141414），宽 400px
// - Logo + 标题 "Nexus"
// - 邮箱输入框 + 密码输入框 + 登录按钮
// - "没有账号？注册" 链接
// - 错误信息显示在卡片内
// - 登录成功后跳转原来页面或 Dashboard

// 注册页：
// - 同上布局
// - 多一个"用户名"输入框
// - "已有账号？登录" 链接
```

### 8.5 Agent 列表页

```typescript
// AgentListPage
// - PageHeader: "代理中心" + [创建代理] 按钮
// - 展示模式：卡片网格（默认） / 表格切换
// - 每个卡片显示：名称、类型徽章、状态指示灯、模型、统计数据
// - Hover 效果：边框高亮 + 微上移
// - 空状态：引导创建第一个 Agent
// - 点击卡片跳转 AgentDetailPage
```

### 8.6 Dashboard 页

```typescript
// DashboardPage
// - 4 个统计卡片（一行）：
//   1. Agent 在线数 / 总数
//   2. 项目数（活跃/总数）
//   3. 任务完成率（环形进度条）
//   4. 今日 Token 消耗
// - Agent 状态面板（在线/离线/繁忙列表）
// - 最近任务列表（最新 10 条）
// - Token 消耗趋势图（最近 7 天，Recharts 折线图）
```

---

## 九、状态管理

### auth store（Zustand）

```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshTokenValue: string | null;
  isAuthenticated: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  setUser: (user: User) => void;
}
```

### agents store

```typescript
interface AgentsState {
  agents: AgentInstance[];
  loading: boolean;
  fetchAgents: () => Promise<void>;
}
```

### ui store

```typescript
interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}
```

---

## 十、TypeScript 类型定义

```typescript
// types/api.ts
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

interface PagedData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// types/auth.ts
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  avatar?: string;
  settings?: Record<string, any>;
  max_agents: number;
  max_projects: number;
  max_tasks: number;
  is_active: boolean;
  created_at: string;
}

// types/agent.ts
interface AgentType {
  id: string;
  name: string;
  display_name: string;
  protocol: string;
  capabilities: string[];
  default_models: string[];
  is_system: boolean;
}

interface AgentInstance {
  id: string;
  name: string;
  type: AgentType;
  status: 'online' | 'offline' | 'busy' | 'error';
  model: string;
  config: Record<string, any>;
  stats: {
    task_count: number;
    completed_tasks: number;
    failed_tasks: number;
    total_tokens: number;
    total_cost: number;
  };
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

// types/project.ts
interface Project {
  id: string;
  name: string;
  description?: string;
  spec?: string;
  status: 'active' | 'completed' | 'archived';
  stats: {
    total_tasks: number;
    completed_tasks: number;
    total_tokens: number;
    total_cost: number;
  };
  created_at: string;
  updated_at: string;
}

// types/task.ts
interface Task {
  id: string;
  project_id: string;
  parent_task_id?: string;
  name: string;
  description?: string;
  spec?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'running' | 'completed' | 'failed';
  stats: {
    total_jobs: number;
    completed_jobs: number;
    total_tokens: number;
    total_cost: number;
  };
  created_at: string;
}

// types/job.ts
interface Job {
  id: string;
  task_id: string;
  project_id: string;
  agent_inst_id?: string;
  name?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval';
  prompt?: string;
  result?: any;
  error_message?: string;
  input_files?: string[];
  output_files?: string[];
  messages?: any[];
  prompt_tokens: number;
  completion_tokens: number;
  retry_count: number;
  timeout_seconds: number;
  started_at?: string;
  completed_at?: string;
}

// types/stats.ts
interface DashboardStats {
  agents: { total: number; online: number; offline: number };
  projects: { total: number; active: number; completed: number };
  tasks: { total: number; pending: number; running: number; completed: number; failed: number };
  jobs: { total: number; pending: number; running: number; completed: number; failed: number };
  tokens: { total: number; today: number; this_week: number; this_month: number };
  cost: { total: number; today: number; this_week: number; this_month: number };
}
```

---

## 十一、开发清单（按优先级排序）

### P0 — 基础设施（必须先完成）
- [ ] `styles/tokens/` — 6 个 Token 文件（从 DESIGN_SPEC.md 复制）
- [ ] `styles/antd-theme.ts` — ConfigProvider 主题配置
- [ ] `styles/global.ts` — 全局样式 + Keyframes
- [ ] `api/client.ts` — axios 实例（JWT 拦截器 + 自动刷新）
- [ ] `types/` — TypeScript 类型定义
- [ ] `stores/auth.ts` — 认证状态管理

### P1 — 认证页面
- [ ] `pages/auth/LoginPage.tsx` — 登录页
- [ ] `pages/auth/RegisterPage.tsx` — 注册页
- [ ] `components/Auth/` — 路由守卫（ProtectedRoute, AdminRoute, GuestRoute）
- [ ] `App.tsx` — 路由配置 + ConfigProvider

### P2 — 布局
- [ ] `components/Layout/MainLayout.tsx` — 主布局
- [ ] `components/Layout/Sidebar.tsx` — 侧边栏
- [ ] `components/Layout/Header.tsx` — 顶部栏
- [ ] `components/Layout/AdminLayout.tsx` — Admin 布局
- [ ] `components/common/` — StatusBadge, EmptyState, ErrorBlock, PageHeader

### P3 — 核心页面
- [ ] `pages/dashboard/DashboardPage.tsx` — Dashboard
- [ ] `pages/agents/` — Agent 列表 + 创建 + 详情（3 个页面）
- [ ] `pages/projects/` — 项目列表 + 详情 + 任务列表（3 个页面）
- [ ] `pages/tasks/` — 任务详情 + Job 详情（2 个页面）

### P4 — 设置 + Admin
- [ ] `pages/settings/` — 个人设置 + 通知通道（2 个页面）
- [ ] `pages/admin/` — Admin 6 个页面
- [ ] `api/` — 所有 API 模块

### P5 — 打磨
- [ ] 动画和过渡效果
- [ ] 响应式适配
- [ ] loading / empty / error 状态完善

---

## 十二、注意事项

1. **🚨 必须使用 Design Token**，禁止硬编码任何颜色/间距/字体值
2. **🚨 必须使用 Ant Design 组件**，不自造轮子
3. **所有可交互元素**必须有 hover/focus/active 状态
4. **所有数据加载**必须处理 loading / empty / error 三种状态
5. **单文件不超过 200 行**，超过必须拆分组件
6. **不要修改 Gateway 页面**，保留现有功能
7. **暗色主题是默认**，颜色值直接用 DESIGN_SPEC.md 里的
8. **API 客户端统一用 axios**，拦截器统一处理认证和错误
9. **图标用 Ant Design Icons**（`@ant-design/icons`）
10. **Zustand store 保持简单**，复杂查询用 react-query
