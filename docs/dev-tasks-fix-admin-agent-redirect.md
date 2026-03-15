# 修复：后台代理中心点击 Agent 跳转到前台的问题

## 问题描述
后台管理 `/admin/agents` 页面点击具体 Agent 后，跳转到了前台的 `/agents/:id` 而不是后台的 `/admin/agents/:id`。即使路由配置正确（`/admin/agents/:id` → `AgentDetailPage`），`AgentDetailPage` 内部的返回按钮硬编码导航到 `/agents`（前台），导致跳转到前台 Dashboard。

## 修复方案

### 1. `frontend/src/pages/agents/AgentDetailPage.tsx`
- 将所有硬编码的 `navigate('/agents')` 改为动态判断当前路径
- 如果当前路径以 `/admin` 开头，返回按钮导航到 `/admin/agents`
- 否则导航到 `/agents`
- 实现方式：使用 `useLocation()` 获取当前路径，判断 `location.pathname.startsWith('/admin')`
- 涉及的 navigate 调用（约 5 处）：
  - L325: `navigate('/agents')` → 改为动态
  - L362: `navigate('/agents')` → 改为动态
  - L382: `navigate('/agents')` → 改为动态
  - L398: `navigate('/agents')` → 改为动态
  - L579: `navigate('/agents')` → 改为动态

### 2. `frontend/src/pages/agents/AgentNewPage.tsx`
- 同样检查 `navigate('/agents')` 是否需要改为动态（如果这个页面也同时用于前台和后台）

### 3. 确认不需要修改的文件
- `App.tsx` 路由配置已正确，无需修改
- `AdminLayout.tsx` 菜单配置已正确，无需修改

## 约束
- 不改变页面组件的功能和 UI
- 前台 `/agents` 和后台 `/admin/agents` 都能正常使用同一个组件
- 保持浅色主题风格
