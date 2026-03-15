# Nexus 前端 — 第 2 轮：认证 + 布局

> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/frontend/`
> **前置条件**: 第 1 轮已完成（Token, antd-theme, api/client, types, stores）
> **完整文档参考**: `../docs/frontend-dev-prompt.md`

---

## 任务清单

### 1. Auth API 模块 — `src/api/auth.ts`

```typescript
import api from './client';

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }),
  
  getMe: () => api.get('/auth/me'),
  
  updateMe: (data: { name?: string; avatar?: string; settings?: Record<string, any> }) =>
    api.put('/auth/me', data),
  
  changePassword: (old_password: string, new_password: string) =>
    api.put('/auth/password', { old_password, new_password }),
  
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
};
```

### 2. 路由守卫 — `src/components/Auth/`

#### `ProtectedRoute.tsx`
```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};
```

### 3. 登录页面 — `src/pages/auth/LoginPage.tsx`

**设计要求**（用 Design Token）：
- 全屏暗色背景 `#0a0a0a`
- 居中卡片：背景 `#141414`、边框 `1px solid rgba(255,255,255,0.06)`、圆角 `12px`、宽 `400px`、内边距 `32px`
- Logo 文字 "Nexus" — 大号、Indigo 色渐变
- Ant Design Form：邮箱 Input + 密码 Input.Password + 登录 Button（Primary）
- "没有账号？注册" 链接
- 错误信息：表单下方红色提示
- Loading 状态：Button loading
- 登录成功：跳转 `location.state?.from || '/'`

### 4. 注册页面 — `src/pages/auth/RegisterPage.tsx`

同登录布局，额外：
- "用户名" Input
- 密码最少 8 位校验
- "已有账号？登录" 链接

### 5. 通用组件 — `src/components/common/`

#### `PageHeader.tsx`
```tsx
// 标题 + 操作按钮的页面头部
// Props: title, actions (ReactNode)
// 样式：flex, justify-between, margin-bottom 24px
```

#### `StatusBadge.tsx`
```tsx
// 统一状态徽章组件
// Props: status ('running'|'completed'|'failed'|'pending'|'offline'|'error')
// 颜色从 DESIGN_SPEC.md 第六章复制
// 样式：圆角 4px, padding 2px 8px, 12px, 带颜色圆点
// running 状态圆点脉冲动画
```

#### `EmptyState.tsx`
```tsx
// 空状态占位
// Props: description, icon?, action? (ReactNode)
// 居中显示 Ant Design Empty 或自定义
```

#### `ErrorBlock.tsx`
```tsx
// 错误状态
// Props: message, onRetry
// 错误图标 + 消息 + 重试按钮
```

### 6. 主布局 — `src/components/Layout/MainLayout.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  Header (56px)                                          │
│  [Logo]  [搜索]                    [通知] [设置] [头像▼]   │
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  Content Area                                │
│ (240px)  │  <Outlet />                                  │
│          │                                              │
│ Dashboard│  (内边距 24px, 最大宽 1400px 居中)              │
│ 项目      │                                              │
│ 代理中心  │                                              │
│ Gateway   │                                              │
│ 设置      │                                              │
├──────────┴──────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────┘
```

**Header**：
- 高度 `56px`
- 背景 `rgba(10,10,10,0.8)` + `backdrop-filter: blur(8px)`
- 左侧：Logo "Nexus"（Indigo 渐变文字）
- 右侧：通知图标 + 设置图标 + 头像（点击下拉：个人信息、设置、退出登录）
- 底部边框 `1px solid rgba(255,255,255,0.06)`

**Sidebar**：
- 宽度 `240px`，折叠后 `64px`
- 背景 `#0a0a0a`（与页面背景同色，靠边框区分）
- 右侧边框 `1px solid rgba(255,255,255,0.06)`
- 菜单项：图标 + 文字，选中项背景 `rgba(99,102,241,0.1)` 文字 `#818cf8`
- Hover 背景 `rgba(255,255,255,0.04)`
- 底部：折叠按钮

**Content**：
- 内边距 `24px`
- 最大宽度 `1400px` 居中

### 7. Admin 布局 — `src/components/Layout/AdminLayout.tsx`

在 MainLayout 基础上替换 Sidebar 菜单项：
- 后台首页（Dashboard 图标）
- 用户管理（Team 图标）
- Agent 类型（Tool 图标）
- 系统设置（Setting 图标）
- 通知配置（Bell 图标）
- 全局统计（BarChart 图标）

顶部 Header 加 "Admin" 徽章标识。

### 8. 路由配置 — 更新 `App.tsx`

```tsx
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute, AdminRoute, GuestRoute } from '@/components/Auth';
import { MainLayout } from '@/components/Layout/MainLayout';
import { AdminLayout } from '@/components/Layout/AdminLayout';

// 懒加载页面
const LoginPage = React.lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/auth/RegisterPage'));
const DashboardPage = React.lazy(() => import('@/pages/dashboard/DashboardPage'));
// ... 其他页面先创建占位

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <GlobalStyle />
      <Suspense fallback={<Spin />}>
        <Routes>
          {/* 未登录 */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          
          {/* 已登录 - 前台 */}
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            {/* 后续轮次添加更多子路由 */}
          </Route>
          
          {/* 已登录 - 后台 */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            {/* 后续轮次添加 */}
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ConfigProvider>
  );
}
```

### 9. Dashboard 占位 — `src/pages/dashboard/DashboardPage.tsx`

临时占位页面，显示 "Dashboard" 标题和 " coming soon..." 提示。确保路由能跑通。

---

## 输出要求

1. 访问 `/login` 显示登录页（暗色主题、居中卡片）
2. 访问 `/register` 显示注册页
3. 登录后跳转到 Dashboard
4. 未登录访问 `/` 重定向到 `/login`
5. Sidebar 导航菜单正常显示
6. Header 显示用户头像和下拉菜单
7. 退出登录清除 token 并跳转登录
8. 折叠/展开 Sidebar 正常工作

---

## ⚠️ 注意

- **所有样式用 Design Token + styled-components**
- **Ant Design 组件**：Form, Input, Button, Menu, Dropdown, Avatar, Spin
- **Ant Design Icons**：DashboardOutlined, ProjectOutlined, RobotOutlined, SettingOutlined, BellOutlined, BarChartOutlined, MenuFoldOutlined, MenuUnfoldOutlined
- 不实现具体业务页面（R3 做），本轮只做框架
- 下一轮：Dashboard + Agent + Project 核心页面
