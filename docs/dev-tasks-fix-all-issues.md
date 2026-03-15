# 综合修复：所有后端 500 + 认证 + 路由问题

## 项目路径
/Users/lh8/projects/agent-orchestration

## 测试结果
42 项全接口测试，30 通过，12 失败。以下按模块分类所有问题。

---

## 问题 1：创建任务 ORM 报错
- **接口**：`POST /api/tasks/`
- **状态**：400（实际是 500 被转为 400）
- **错误**：`Can't execute sync rule for source column 'tasks.id'; mapper 'Mapper[Task(tasks)]' does not map this column`
- **文件**：`backend/app/models/orm_models.py`
- **修复**：`Task` 和 `TaskAssignment` 的 relationship 配置有冲突。`TaskAssignment.task_id` 有 ForeignKey 指向 `tasks.id`，但 Task 的 assignments relationship 和 TaskAssignment 的 task relationship 的 foreign_keys 映射冲突。需要显式指定 `foreign_keys`。

## 问题 2：工作流所有接口 500（async/await 不匹配）
- **接口**：`GET /api/workflows/`、`GET /api/v1/workflows`、`GET /api/workflows/templates`、`POST /api/workflows/`
- **状态**：500
- **错误**：`TypeError: object list can't be used in 'await' expression`
- **文件**：`backend/app/routers/workflows.py`
- **修复**：
  1. `workflow_service` 的方法是 sync 的（不是 async def），路由中不能用 `await`
  2. 检查 `backend/app/services/workflow.py` 中所有方法，sync 方法去掉 `await`
  3. 检查 `get_workflow(workflow_id)` 方法 — 它返回 None 时不是 async 对象

## 问题 3：工作流模板路由被动态路由拦截
- **接口**：`GET /api/workflows/templates` → 返回 500（被 `/{workflow_id}` 拦截）
- **接口**：`POST /api/workflows/templates` → 返回 405（同上）
- **文件**：`backend/app/routers/workflows.py`
- **修复**：将 `/templates` 相关路由移到 `/{workflow_id}` 之前声明：
```python
@router.get("/templates", ...)
@router.get("/templates/{template_id}", ...)
@router.post("/templates/", ...)
@router.delete("/templates/{template_id}", ...)

@router.get("/{workflow_id}", ...)
@router.put("/{workflow_id}", ...)
@router.delete("/{workflow_id}", ...)
```

## 问题 4：工作流创建 422
- **接口**：`POST /api/workflows/` → 422
- **原因**：请求体 `{ name, description, steps }` 和 schema 不匹配
- **文件**：`backend/app/routers/workflows.py` 和 `backend/app/models/workflow.py`
- **修复**：检查 `WorkflowDefinition` schema 要求的字段，确保前端传入的字段名匹配

## 问题 5：后台管理接口 401 认证失败
- **接口**：`GET /api/v1/admin/users`、`/api/v1/admin/agent-types`、`/api/v1/admin/settings`、`PUT /api/v1/admin/settings`、`GET /api/v1/notifications/channels`
- **状态**：401 "Not authenticated"
- **原因**：这些路由使用了不同的认证方式（可能是 admin API key 或特定 role 校验），普通的 Bearer token 不被接受
- **文件**：`backend/app/routers/admin.py`、`backend/app/routers/settings.py`、`backend/app/routers/notifications.py`
- **修复**：
  1. 检查 admin 路由的认证依赖（`Depends(verify_admin_key)` 或类似）
  2. 确保已登录用户的 Bearer token 也被这些路由接受
  3. 检查 `verify_admin_key` 的实现，是否支持 JWT Bearer token

## 问题 6：Gateway API 认证失败
- **接口**：`GET /api/gateway/bridges`
- **状态**：401 "Invalid or missing API Key"
- **原因**：前端使用的 API Key `nexus-admin-key-2024` 不正确，或者后端认证逻辑有问题
- **文件**：`backend/app/routers/gateway.py`、`frontend/src/pages/admin/GatewayPage.tsx`
- **修复**：
  1. 检查后端 gateway 路由的认证逻辑，确认正确的 API Key
  2. 或者改为支持 Bearer token 认证（和前端其他接口一致）
  3. 如果使用 API Key，确保前端和后端的 key 一致

## 问题 7：前端 stats 路径错误（后台首页）
- **前端调用**：`/v1/admin/stats/global`
- **后端实际**：`/v1/stats/global`（stats 路由挂载在 `/api/v1/stats`）
- **文件**：
  - `frontend/src/pages/admin/AdminDashboard.tsx`（约第 195 行）
  - `frontend/src/pages/admin/AdminStatsPage.tsx`（约第 197 行）
- **修复**：`api.get('/v1/admin/stats/global')` → `api.get('/v1/stats/global')`

---

## 验证命令
修复后逐一执行：
```bash
TOKEN=$(curl -s -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@2026"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")

# 问题 1: 创建任务
echo "=== 创建任务 ==="
curl -s -L -X POST "http://localhost:8082/api/tasks/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"test task","description":"test"}'

# 问题 2+3+4: 工作流
echo "=== 工作流列表 ==="
curl -s -L "http://localhost:8082/api/workflows/" -H "Authorization: Bearer $TOKEN"
echo "=== 模板列表 ==="
curl -s -L "http://localhost:8082/api/workflows/templates" -H "Authorization: Bearer $TOKEN"

# 问题 5: 后台认证
echo "=== 用户管理 ==="
curl -s "http://localhost:8082/api/v1/admin/users" -H "Authorization: Bearer $TOKEN"
echo "=== 系统设置 ==="
curl -s "http://localhost:8082/api/v1/admin/settings" -H "Authorization: Bearer $TOKEN"
echo "=== 通知渠道 ==="
curl -s "http://localhost:8082/api/v1/notifications/channels" -H "Authorization: Bearer $TOKEN"

# 问题 6: Gateway
echo "=== Gateway bridges ==="
curl -s "http://localhost:8082/api/gateway/bridges" -H "X-API-Key: nexus-admin-key-2024"

# 问题 7: stats (前端改完后浏览器刷新验证)
```

## 注意
1. 问题 1-4 是后端 Bug，只改后端
2. 问题 5-6 可能是认证配置问题，优先检查认证依赖的实现
3. 问题 7 是前端路径问题，只改前端
4. 所有修改完成后 commit 推送通知我

## 完成后
commit 推送，通知我。
