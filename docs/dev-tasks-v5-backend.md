# Agent Orchestrator 后端改造任务（第 5 轮）

## 项目路径
/Users/lh8/projects/agent-orchestration/backend

## 技术栈
Python 3 + FastAPI + SQLAlchemy + SQLite + Pydantic v2 + Alembic

## 当前部署
- uvicorn on port 8082，已开启 --reload 自动热更新
- 数据库：data/nexus.db（SQLite）
- Nginx 反代：81.70.98.45:9443 → 8082

## 任务列表

### 任务 1：任务表增加 workflow_id 字段
涉及文件：
- app/models/task.py（NexusTask ORM）
- app/schemas/task.py（TaskCreate / TaskUpdate / TaskOut）
- app/routers/tasks.py（创建任务接口）

1. NexusTask 模型新增字段：
   ```python
   workflow_id: Mapped[str | None] = mapped_column(String(36))
   ```

2. TaskCreate schema 新增可选字段：
   ```python
   workflow_id: Optional[str] = None
   ```

3. TaskUpdate schema 新增可选字段：
   ```python
   workflow_id: Optional[str] = None
   ```

4. TaskOut schema 新增字段：
   ```python
   workflow_id: Optional[str] = None
   ```

5. 创建任务接口（tasks.py create_task）透传 workflow_id 到数据库

6. 创建 Alembic 迁移：
   ```bash
   cd /Users/lh8/projects/agent-orchestration/backend
   alembic revision --autogenerate -m "add_workflow_id_to_tasks"
   alembic upgrade head
   ```

### 任务 2：任务日志接口确认与修复
涉及文件：app/routers/tasks.py、app/services/task.py

当前已有 GET /api/tasks/{id}/logs 端点，需要：
1. 确认该接口能正常返回数据（从 agent_logs 表查询）
2. 如果该接口不存在或报错，需要实现
3. 返回格式应为：
   ```json
   {
     "success": true,
     "data": {
       "items": [
         {"id": "...", "level": "info", "message": "...", "timestamp": "..."}
       ],
       "total": 100
     }
   }
   ```
4. 支持分页参数 page 和 page_size

### 任务 3：Gateway Bridge 列表 API 确认
涉及文件：app/routers/gateway.py

确认以下接口正常工作：
- GET /api/v1/gateway/bridges → Bridge 列表，支持 status 和 platform 过滤
- POST /api/v1/gateway/bridges/{bridge_id}/disconnect → 强制断开（需要 admin 权限）

需要检查的问题：
1. 接口是否需要认证？当前用的是 X-API-Key 认证（verify_api_key / verify_admin_key）
2. Bridge 列表为空时，返回 { success: true, data: [] }，不要报错
3. last_seen 字段是 Unix 时间戳（秒），文档要标注清楚
4. 断开接口的权限检查是否正确（应该需要 admin key）

如果发现问题请修复。

### 任务 4：任务详情编辑/删除接口确认
涉及文件：app/routers/tasks.py

确认以下接口正常工作：
- PUT /api/tasks/{id} → 更新任务
- DELETE /api/tasks/{id} → 删除任务

当前路由已有这两个端点，需要确认：
1. PUT 能正确更新 title、description、priority、status、workflow_id、assigned_agent 字段
2. DELETE 能正确删除任务并返回成功
3. 不存在时返回 404

### 任务 5：工作流列表 API 确认
涉及文件：app/routers/workflows.py

确认 GET /api/v1/workflows 和 GET /api/workflows 正常返回工作流列表。
前端任务创建时需要用这个列表做关联选择。

### 任务 6：Dashboard 统计 API 确认
涉及文件：app/routers/stats.py

确认 GET /api/v1/stats 或类似接口返回的数据中是否包含：
- token_usage（Token 消耗相关）
- cost（成本相关）

如果没有，需要在该接口中补充这两个字段。

### 任务 7：用户角色字段确认
涉及文件：app/routers/auth.py 或相关认证接口

确认 GET /api/v1/auth/me 接口返回的用户对象包含 role 字段。
前端需要根据 role 动态渲染后台菜单。

## 注意事项
1. 修改完代码后不需要重启，uvicorn --reload 会自动热更新
2. 数据库改动务必用 Alembic 迁移，不要直接改表结构
3. SQLite 并发有限，写入操作用 short-lived session
4. API 保持向后兼容，已有接口不要改变响应格式
5. 所有新增字段都是 Optional，不破坏现有功能
6. 迁移文件只改 nexus.db，不动 workflows.db
