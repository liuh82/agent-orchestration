# Phase 0 测试任务

## 测试范围
Phase 0 包含两个 commit：
- `58e5cf6` — 后端数据库迁移（Alembic + 8张新表 + 字段修改）
- `84cc905` — 前端 Bug修复 + 依赖升级 + UI微调

## 验收标准 Checklist

### 后端迁移（commit 58e5cf6）
- [ ] `alembic upgrade head` 执行成功（或已执行过，当前版本正确）
- [ ] `alembic downgrade -1` 后再 `alembic upgrade head` 可逆
- [ ] `gateway_bridges` 表有 `user_id` 列（nullable）
- [ ] `agents` 表有 `bridge_id` 列（nullable）
- [ ] 8张新表存在：project_documents, agent_config_files, task_files, human_interventions, workflow_executions, workflow_node_executions, dashboard_layouts, user_session_tokens
- [ ] 所有新表有正确的索引
- [ ] ORM 模型可正常导入（无 ImportError）
- [ ] 现有功能不受影响：登录 `/api/v1/auth/login` 正常返回 200
- [ ] 现有功能不受影响：查询 Agent 列表 `/api/v1/agents` 正常

### 前端修复（commit 84cc905）
- [ ] 前端编译成功：`cd frontend && npm run build` 无错误
- [ ] 后台 content 区背景色不为透明（应为 #f5f5f5 或类似浅色）
- [ ] 后台 Dashboard 统计卡片高度一致（或至少差距在可接受范围）
- [ ] stats API 路径正确：前端请求 `/api/v1/stats/global`（不是 `/v1/admin/stats/global`）
- [ ] Agent 详情页配置 Tab 背景不为黑色（应为浅色）
- [ ] react-flow-renderer 已移除，@xyflow/react 已安装

### 模板库 API 修复
- [ ] `GET /api/workflows/templates` 不再返回 500（如果此修复在本次 commit 中）

## 测试环境
- 项目路径：`/root/.openclaw/workspace/agent-orchestration`
- 后端：`cd backend && python -c "from app.models.* import *"` 验证导入
- 数据库：`data/nexus.db`
- 前端编译：`cd frontend && npm run build`
- 后端启动测试：`cd backend && uvicorn main:app --host 0.0.0.0 --port 8082`（确认能启动）

## 测试方式
1. 先验证后端数据库迁移（检查表结构 + ORM导入 + API功能）
2. 再验证前端编译
3. 逐项对照 checklist 输出结果

## 输出格式
每个 checklist 项输出 ✅ 或 ❌ + 说明。最后给出总结：通过/不通过。
