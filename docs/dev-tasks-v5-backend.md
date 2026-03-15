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

### 任务 8：Playwright 全流程验收测试（最终环节）

前后端代码合并部署到服务器后，使用 Playwright 对所有页面和功能进行端到端测试。

测试环境：
- 访问地址：http://81.70.98.45:9443
- 测试账号：admin@example.com / Admin@2026（admin 角色）
- 测试账号：test@test.com（普通用户角色，需确认密码）
- 浏览器：Chromium headless

测试覆盖（按前台→后台顺序）：

#### 前台页面
1. **登录页** — 输入账号密码登录成功，跳转到 Dashboard
2. **Dashboard** — 页面正常渲染，统计卡片有数据
3. **项目列表** — 页面正常渲染，无 JS 错误
4. **项目详情** — 点击项目进入详情页正常
5. **任务中心** — 任务列表加载，创建任务弹窗打开正常
6. **任务创建** — 创建任务时能看到 Agent 下拉和流程下拉（即使为空也应显示 placeholder）
7. **任务详情** — 点击任务进入详情页，日志 Tab 有内容或空状态提示
8. **工作流** — 工作流列表加载，模板库 Tab 正常，编辑器 Tab 节点工具栏正常
9. **个人设置** — 设置页面正常渲染
10. **后台管理入口** — 侧边栏底部或用户菜单能看到后台管理入口

#### 后台页面（admin 账号）
11. **后台首页** — 统计数据正常渲染
12. **Gateway 管理** — Bridge 列表加载（可能为空，空状态正常）
13. **代理中心** — Agent 列表加载，创建代理三步骤流程正常
14. **创建代理** — 选择类型能看到 Claude Code/Codex/OpenCode/OpenClaw，配置页无 bridge_url，确认创建正常
15. **Agent 类型** — 类型列表加载正常
16. **用户管理** — 用户列表加载，显示 role 列
17. **系统设置** — 页面正常渲染
18. **通知配置** — 页面正常渲染
19. **全局统计** — 页面正常渲染
20. **返回前台** — Header 有返回按钮，点击跳转正常

#### 后台页面（普通用户账号）
21. 后台菜单只显示：后台首页、Gateway 管理、代理中心、通知配置
22. 不显示：Agent 类型、用户管理、系统设置、全局统计

#### 样式检查
23. 所有页面无暗色残留（neutral[950] 背景）
24. 后台页面 Header 为 #334155，Sidebar 为 #1e293b，内容区为 #f5f5f5
25. 侧边栏收起/展开正常
26. 表格、按钮、Tag 颜色和浅色主题一致

测试结果要求：
- 每个页面截图保存（/Users/lh8/projects/agent-orchestration/docs/screenshots/）
- 输出测试报告（通过/失败/跳过）
- 失败项标注具体错误信息和控制台日志
- 不需要修改代码，只测试和报告
