# Nexus 开发任务 T3：后台管理页修复

## 必读文件（先读完再动手）
- CLAUDE.md
- docs/architecture-v3.md（重点看 2.1 管理概览、2.3 代理中心）
- frontend/src/App.tsx（路由定义）
- frontend/src/components/Layout/AdminLayout.tsx（侧边栏）
- frontend/src/pages/admin/AdminDashboard.tsx
- frontend/src/pages/admin/AdminStatsPage.tsx
- frontend/src/pages/admin/AgentTypePage.tsx
- frontend/src/pages/agents/AgentListPage.tsx
- frontend/src/pages/admin/UserManagementPage.tsx
- backend/app/routers/ 目录

## 任务目标
修复4个后台管理问题：

### 3.1 合并后台首页 + 全局统计
- 删除独立的 AdminStatsPage
- 将统计内容整合到 AdminDashboard 中
- 删除 /admin/stats 路由
- 管理概览应直接展示：用户数、项目数、任务数、Agent数、最近活动等

### 3.2 代理中心合并 Agent 类型
- 在代理中心页面增加 Tabs：「代理列表」|「类型管理」
- 将 AgentTypePage 的功能作为「类型管理」Tab 嵌入
- 删除独立的 /admin/agent-types 路由
- 删除 AdminAgentPage（如果存在）

### 3.3 Agent 配置表单化
- 编辑 Agent 时，如果有 config_schema，渲染表单而非 JSON 编辑器
- 检查 SchemaForm 组件是否正常工作
- 删除 Agent 编辑页的"启动"按钮（无用功能）
- 如果 config_schema 为空，显示基础配置表单（名称、类型、Bridge、模型、超时、重试）

### 3.4 用户管理修复
- 用户列表"用户名"列显示正确值（检查 API 返回字段和前端映射）
- 新增管理员重置用户密码功能：
  - 后端：POST /api/v1/admin/users/{user_id}/reset-password
  - 前端：用户列表增加"重置密码"操作按钮，弹出 Modal 输入新密码

## 完成标准
- [ ] /admin 直接显示管理概览+统计，无独立统计页
- [ ] 代理中心有"代理列表"和"类型管理"两个Tab
- [ ] Agent 编辑显示表单配置（非JSON）
- [ ] 无"启动"按钮
- [ ] 用户名正常显示
- [ ] 管理员可重置其他用户密码
- [ ] 前端无 console error
- [ ] git status 列出所有修改文件

## 不要做的事
- 不要修改数据库模型
- 不要修改工作流相关代码
- 不要 git commit
