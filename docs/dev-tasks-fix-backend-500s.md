# 紧急修复：后端多处 500 错误 + 前端 stats 路径错误

## 项目路径
/Users/lh8/projects/agent-orchestration

## 问题 1：创建任务 ORM 报错
POST /api/tasks/ 返回 500：
```
Can't execute sync rule for source column 'tasks.id'; mapper 'Mapper[Task(tasks)]' does not map this column.
```
修复：`backend/app/models/orm_models.py` 中 Task/TaskAssignment 的 relationship 配置。

## 问题 2：工作流模板接口被动态路由拦截
GET /api/workflows/templates 返回 500。

**根因**：`workflows.py` 中 `/{workflow_id}` 在 `/templates` 之前声明，`/workflows/templates` 被匹配为 `/{workflow_id}`。

**修复**：将 `/templates` 相关路由移到 `/{workflow_id}` 之前。

## 问题 3：workflows.py async/await 不匹配
`workflow_service` 的方法是 sync 的，但路由中用了 `await`，导致 `TypeError: object list can't be used in 'await' expression`。

检查 `backend/app/services/workflow.py` 中所有方法是否为 async，如果不是就去掉路由中的 `await`。

## 问题 4：前端 stats 路径错误（后台首页报错）
`AdminDashboard.tsx` 和 `AdminStatsPage.tsx` 调用 `/v1/admin/stats/global`，但后端实际路由是 `/v1/stats/global`（stats 路由挂载在 `/api/v1/stats`，不是 `/api/v1/admin/stats`）。

修改前端：
- `frontend/src/pages/admin/AdminDashboard.tsx` 第 195 行：`/v1/admin/stats/global` → `/v1/stats/global`
- `frontend/src/pages/admin/AdminStatsPage.tsx` 第 197 行：`/v1/admin/stats/global` → `/v1/stats/global`

## 修复原则
1. 调整 workflows.py 路由声明顺序
2. 去掉 sync 方法上的 await
3. 修复 ORM relationship
4. 修复前端 stats 路径
5. 修改完本地验证所有 4 个问题
6. commit 推送通知我

## 验证命令
```bash
TOKEN=$(curl -s -X POST http://localhost:8082/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"Admin@2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")

# 问题 1: 创建任务
curl -s -L -X POST "http://localhost:8082/api/tasks/" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"test task","description":"test"}'

# 问题 2: 模板列表
curl -s -L "http://localhost:8082/api/workflows/templates" -H "Authorization: Bearer $TOKEN"

# 问题 3: 工作流列表
curl -s -L "http://localhost:8082/api/workflows/" -H "Authorization: Bearer $TOKEN"

# 问题 4: 全局统计
curl -s "http://localhost:8082/api/v1/stats/global" -H "Authorization: Bearer $TOKEN"
```
