# Agent Orchestrator 第 5 轮 Code Review 修复任务

## 项目路径
/Users/lh8/projects/agent-orchestration

## 背景
第 5 轮开发已完成，Code Review 发现 5 个 P0 问题和 3 个 P1 问题，需要修复后推送。

---

## P0 修复（必须完成）

### 修复 1：后端任务日志接口加认证（安全问题）
文件：backend/app/routers/tasks.py

当前 `GET /tasks/{task_id}/logs` 接口没有任何认证，任何人都能查看任务日志。

修改：参考同文件中其他接口的认证方式，添加认证依赖。

注意：这个路由挂载在 `prefix="/api/tasks"` 下（main.py 第 82 行），使用的是旧路由体系（非 Gateway 的 X-API-Key）。请检查 `/api/tasks` 路由组的认证方式：
- 如果同组的其他接口（如 create_task、get_task）也没有显式认证依赖，说明认证可能由中间件处理，那这个接口保持一致即可
- 如果有认证依赖，加上相同的依赖

如果确认中间件已覆盖认证，此修复可跳过，但需在代码注释中说明。

### 修复 2：前端 GatewayPage API 路径缺少 /v1 前缀（功能缺陷）
文件：frontend/src/pages/admin/GatewayPage.tsx

后端 Gateway 路由挂载在 `/api/v1/gateway/` 前缀下（main.py 中 `app.include_router(gateway.router, prefix="/api/v1/gateway")`）。

但前端 client.ts 的 baseURL 是 `/api`，所以前端请求 `/gateway/bridges` 会变成 `GET /api/gateway/bridges`，而后端实际路径是 `/api/v1/gateway/bridges`。

修改两处：

1. Bridge 列表查询（约第 137 行）：
```ts
// 改前
api.get('/gateway/bridges', { params: ... })
// 改后
api.get('/v1/gateway/bridges', { params: ... })
```

2. 强制断开（约第 153 行）：
```ts
// 改前
api.post(`/gateway/bridges/${bridgeId}/disconnect`)
// 改后
api.post(`/v1/gateway/bridges/${bridgeId}/disconnect`)
```

### 修复 3：AgentNewPage 类型名恢复 display_name（回退问题）
文件：frontend/src/pages/agents/AgentNewPage.tsx

上一轮已将 `{type.name}` 改为 `{type.display_name || type.name}`，但本次 CC 的改动又回退成了 `{type.name}`。

修改（约第 331 行）：
```tsx
// 改前
<TypeName>{type.name}</TypeName>
// 改后
<TypeName>{type.display_name || type.name}</TypeName>
```

### 修复 4：Tasks.tsx 编辑任务时保留 workflow_id
文件：frontend/src/pages/Tasks.tsx

当编辑已有任务时，`workflow_id` 被硬编码为 `undefined`，会丢失已有数据。

修改（约第 77 行）：
```ts
// 改前
workflow_id: undefined,
// 改后
workflow_id: task.workflow_id || undefined,
```

同时检查 Tasks.tsx 中创建任务的提交逻辑，确保 `workflow_id` 也被传给后端 API。搜索表单提交的代码，确认 `assigned_agent` 和 `workflow_id` 字段值被包含在提交数据中。

### 修复 5：TaskDetailPage 日志数据解包错误
文件：frontend/src/pages/tasks/TaskDetailPage.tsx

后端日志接口返回格式为：
```json
{ "success": true, "data": { "items": [...], "total": 10, "page": 1, "page_size": 20 } }
```

但前端把 `data` 当成数组解包了。

修改（约第 190 行附近）：
```ts
// 改前
const logs = Array.isArray(logsRes?.data) ? logsRes.data : [];
// 改后
const logs = Array.isArray(logsRes?.data?.items) ? logsRes.data.items : [];
```

注意：client.ts 的 interceptor 会自动解包一层（把 `response.data` 提取出来），所以 `logsRes` 实际上可能是 `{ success: true, data: { items: [...] } }`。请根据实际响应结构调整，确保取到 items 数组。

---

## P1 修复（建议完成）

### 修复 6：TaskDetailPage 加载骨架屏颜色过浅
文件：frontend/src/pages/tasks/TaskDetailPage.tsx

```tsx
// 改前
<div key={i} style={{ height: 20, background: colors.neutral[200], borderRadius: 4 }} />
// 改后
<div key={i} style={{ height: 20, background: colors.surface.raised, borderRadius: 4 }} />
```

### 修复 7：nexus.db 从 Git 追踪中移除
执行以下命令：
```bash
cd /Users/lh8/projects/agent-orchestration
echo "backend/data/nexus.db" >> .gitignore
echo "backend/data/nexus.db-shm" >> .gitignore
echo "backend/data/nexus.db-wal" >> .gitignore
git rm --cached backend/data/nexus.db backend/data/nexus.db-shm backend/data/nexus.db-wal
git add .gitignore
git commit -m "chore: 将数据库文件从 Git 追踪中移除"
```

### 修复 8：DashboardPage 统计卡片响应式断点调整
文件：frontend/src/pages/dashboard/DashboardPage.tsx

```css
/* 改前 */
grid-template-columns: repeat(6, 1fr);
@media (max-width: 1200px) {
  grid-template-columns: repeat(3, 1fr);
}

/* 改后 */
grid-template-columns: repeat(6, 1fr);
@media (max-width: 1400px) {
  grid-template-columns: repeat(3, 1fr);
}
```

---

## 完成后
1. 修复所有 P0 项
2. 尽量修复 P1 项
3. git commit 推送到 main
4. 在飞书通知我已完成
