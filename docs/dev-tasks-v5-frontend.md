# Agent Orchestrator 前端改造任务（第 5 轮）

## 项目路径
/Users/lh8/projects/agent-orchestration/frontend

## 技术栈
React 18 + TypeScript + Vite + Ant Design 5 + react-query v3 + zustand + styled-components

## 当前部署
- Vite dev server: 127.0.0.1:5174
- Nginx 反代: 81.70.98.45:9443（API 转发到 8082）
- 前端热更新自动生效，无需手动重启

## 任务列表

### 任务 1：前台菜单调整（MainLayout.tsx）
文件：src/components/Layout/MainLayout.tsx

当前侧边栏有 4 个菜单：Dashboard、项目、代理中心、设置

改为：
- Dashboard（保持不变，路径 /）
- 项目（保持不变，路径 /projects）
- 任务中心（新增，路径 /tasks，图标 UnorderedListOutlined）
- 工作流（新增，路径 /workflows，图标 ApartmentOutlined）
- 设置（保持不变，路径 /settings）

侧边栏底部（SidebarFooter 上方）增加一个「后台管理」入口按钮，
用 SettingOutlined 图标，点击 navigate('/admin')。

### 任务 2：AdminRoute 权限改造（ProtectedRoute.tsx）
文件：src/components/Auth/ProtectedRoute.tsx

当前 AdminRoute 拦截 user.role !== 'admin' 的用户，重定向到 "/"。
改为：AdminRoute 只验证是否登录（和 ProtectedRoute 一样），
不再拦截非 admin 用户。权限控制由后台菜单动态过滤实现。

### 任务 3：后台主题统一（AdminLayout.tsx）
文件：src/components/Layout/AdminLayout.tsx

当前 AdminLayout 使用暗色主题（colors.neutral[950] 背景）。
需要改为和 MainLayout 一致的浅色风格：
- Header: background #334155（和前台一致）
- Sidebar: background #1e293b（保持深色侧边栏）
- 内容区: background #f5f5f5
- 其他 surface/border/text 颜色参考 MainLayout.tsx 的配色

同时在 AdminLayout 的 Header 中 Logo 旁加一个「返回前台」按钮，
点击 navigate('/')。

### 任务 4：后台菜单调整（AdminLayout.tsx）
文件：src/components/Layout/AdminLayout.tsx

根据用户 role 动态生成菜单（用户角色从 useAuthStore 的 user.role 获取）：

admin 角色显示全部：
- 后台首页（/admin）图标 DashboardOutlined
- Gateway 管理（/admin/gateway）图标 CloudServerOutlined
- 代理中心（/admin/agents）图标 RobotOutlined
- Agent 类型（/admin/agent-types）图标 ToolOutlined
- 用户管理（/admin/users）图标 TeamOutlined
- 系统设置（/admin/settings）图标 SettingOutlined
- 通知配置（/admin/notifications）图标 BellOutlined
- 全局统计（/admin/stats）图标 BarChartOutlined

普通用户（role === 'user'）显示：
- 后台首页（/admin）
- Gateway 管理（/admin/gateway）—— 只读查看
- 代理中心（/admin/agents）—— 只读查看
- 通知配置（/admin/notifications）

### 任务 5：路由调整（App.tsx）
文件：src/App.tsx

前台路由变更：
- 新增 /tasks → TasksPage（已有组件 src/pages/Tasks.tsx）
- 新增 /workflows → WorkflowsPage（已有组件 src/pages/Workflows.tsx）
- 移除 /agents/* 相关前台路由（代理中心移到后台）
- 移除 /agents/new 前台路由

后台路由变更：
- 新增 /admin/agents → AgentListPage
- 新增 /admin/agents/new → AgentNewPage
- 新增 /admin/agents/:id → AgentDetailPage
- 新增 /admin/gateway → GatewayPage（新组件）

注意：移除前台代理中心路由时，对应的懒加载 import 也要调整位置。

### 任务 6：创建代理表单优化（AgentNewPage.tsx）
文件：src/pages/agents/AgentNewPage.tsx

在 Step 1（配置）的表单中删除「连接地址」字段（name="bridge_url"）。
同时在 Step 2（确认创建）中也删除 bridge_url 的展示。
AgentFormData 接口中也删除 bridge_url 字段。

### 任务 7：新建 Gateway 管理页面
新建文件：src/pages/admin/GatewayPage.tsx

后台管理新页面，展示 Gateway 的 Bridge 列表和状态。

需要：
1. 页面头部：标题「Gateway 管理」+ 刷新按钮 + 状态过滤下拉（全部/online/offline）
2. Bridge 列表（Table 展示）：bridge_id、平台、主机名、状态、当前活跃任务数、最大并发、最后活跃时间、可用适配器
3. 状态用 Tag 标签：online=绿色success, offline=灰色default, busy=橙色warning
4. 操作列：
   - 查看详情按钮（跳转到详情页或弹出 Modal 展示完整信息）
   - 强制断开按钮（仅 admin 显示，用 Popconfirm 确认后调用 API）
5. 支持分页，支持按状态过滤
6. 空状态：暂无 Bridge 连接
7. 每 10 秒自动刷新数据（react-query refetchInterval）

API 说明：
- GET /api/v1/gateway/bridges?status=online → 返回 { success: true, data: [...bridges] }
- POST /api/v1/gateway/bridges/{bridge_id}/disconnect → 返回 { success: true, message: "..." }

Bridge 对象字段：
```json
{
  "bridge_id": "string",
  "platform": "string",
  "hostname": "string",
  "os_version": "string",
  "node_version": "string",
  "bridge_version": "string",
  "status": "online|offline",
  "last_seen": 1710000000,
  "available_adapters": [{"type": "cli", "agent_name": "cc", "version": "1.0"}],
  "active_tasks": 0,
  "max_concurrent": 3,
  "created_at": "2026-03-15T00:00:00",
  "updated_at": "2026-03-15T00:00:00"
}
```

注意：last_seen 是 Unix 时间戳（秒），需要转换为可读时间。

### 任务 8：工作流页面适配（Workflows.tsx）
文件：src/pages/Workflows.tsx

1. 当前使用 antd Tabs 的 TabPane（已废弃 API），改为 antd 5 的 items 属性写法
2. 确保组件样式和浅色主题一致（检查是否有暗色残留，比如 neutral[950]）
3. 工作流编辑器的保存逻辑保持 TODO 状态，本次不实现

### 任务 9：任务创建增加关联选择（Tasks.tsx）
文件：src/pages/Tasks.tsx

在创建任务的 Modal 表单中新增两个下拉选择字段：

1. 关联 Agent（assigned_agent）：
   - 类型：Select
   - 数据来源：GET /api/agents/ 返回的 Agent 列表
   - 显示：agent.name
   - 值：agent.id
   - 可选（placeholder="选择分配的 Agent"）
   - 使用 react-query 获取数据

2. 关联流程（workflow_id）：
   - 类型：Select
   - 数据来源：GET /api/v1/workflows 返回的工作流列表
   - 显示：workflow.name
   - 值：workflow.id
   - 可选（placeholder="选择关联的工作流"）
   - 使用 react-query 获取数据

表单提交时将 assigned_agent 和 workflow_id 传给后端。

API 说明：
- GET /api/agents/ → 返回 Agent 数组 [{id, name, type, status, model, ...}]
- GET /api/v1/workflows → 返回工作流数组 [{id, name, description, engine, ...}]

### 任务 10：任务详情页日志展示（TaskDetailPage.tsx）
文件：src/pages/tasks/TaskDetailPage.tsx

在任务详情页增加「日志」Tab，展示该任务的执行日志。

1. 使用 antd Tabs 组件增加「日志」标签页
2. 调用 GET /api/tasks/{id}/logs 获取日志列表
3. 用 Table 展示日志：时间、级别（info/warn/error 用不同颜色 Tag）、消息内容
4. 支持分页
5. 空状态：暂无日志

### 任务 11：任务详情页编辑和删除（TaskDetailPage.tsx）
文件：src/pages/tasks/TaskDetailPage.tsx

当前编辑和删除按钮的 handler 是 message.info 占位，需要实现：

1. 编辑：点击后弹出 Modal（类似创建任务的 Modal），预填当前任务信息，
   提交调用 PUT /api/tasks/{id}
2. 删除：使用 Popconfirm 确认，确认后调用 DELETE /api/tasks/{id}，
   成功后 navigate('/tasks') 返回列表
3. 两个操作都需要给 tasksApi 在 src/api/tasks.ts 中确认对应方法存在

### 任务 12：Dashboard 成本统计展示（DashboardPage.tsx）
文件：src/pages/dashboard/DashboardPage.tsx

在 Dashboard 页面增加 Token/Cost 相关的统计展示：

1. 在统计卡片区域增加两个新卡片：
   - 今日 Token 消耗（数字 + 趋势图标）
   - 本月成本（数字 + 趋势图标）
2. 如果后端 stats API 返回了 token 和 cost 字段，直接展示
3. 如果后端没有返回这些字段，用占位数据展示（"--"），标注"待接入"

## 注意事项
1. 所有页面样式必须和浅色主题一致，不使用 colors.neutral[950] 作为页面背景
2. 后端 API 已有 X-API-Key 认证，前端 client.ts 已自动带 Token，不需要额外处理认证
3. API 响应格式为 { code: 0, data: ..., message: "..." }，client.ts 的 interceptor 已自动解包
4. 工作流页面创建/编辑保存目前是 TODO，本次不需要实现保存逻辑
5. 改完后确认页面无 TypeScript 编译错误
6. 所有新增的 API 调用都需要处理 loading 和 error 状态
7. styled-components 使用的颜色 token 定义在 src/styles/tokens/color.ts
