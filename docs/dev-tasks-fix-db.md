# 紧急修复：后端启动失败 — 数据库表缺失

## 项目路径
/Users/lh8/projects/agent-orchestration

## 问题
后端 `uvicorn` 启动失败，报错：
```
sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) no such table: heartbeats
```

服务器数据库 `data/nexus.db` 中只有 `gateway_bridges` 和 `gateway_tasks` 两张表，其余所有业务表（heartbeats、heartbeat_logs、agents、tasks、users、projects、workflows 等）均缺失。

原因是 `nexus.db` 之前被从 Git 移除（.gitignore），服务器上的数据库可能被清空或重建过，但没有重新运行 Alembic 迁移。

## 修复方案

### 方案 1（推荐）：重建数据库 + 初始化种子数据

1. 停止 uvicorn
2. 删除 `backend/data/nexus.db`
3. 运行 `alembic upgrade head` 创建所有表
4. 运行初始化脚本创建 seed 数据：
   - admin 用户（admin@example.com / Admin@2026）
   - Agent 类型（type-cc Claude Code、Codex、OpenCode、OpenClaw）
   - 其他必要的基础数据

### 方案 2：从 Git 历史恢复

如果有旧版 `nexus.db` 的备份，可以从 Git 历史中恢复。

## 关键信息

### 数据库表清单（从 ORM 模型中确认）
需要存在的表：
- `users`
- `roles`
- `departments`
- `agents`
- `agent_types`
- `agent_instances`
- `tasks`
- `jobs`
- `projects`
- `workflows`
- `workflow_templates`
- `heartbeats`
- `heartbeat_logs`
- `cost_entries`
- `gateway_bridges`
- `gateway_tasks`

### ORM 模型定义
文件：`backend/app/models/orm_models.py`
所有表的字段定义都在这个文件中。

### Alembic 配置
- 迁移目录：`backend/alembic/versions/`
- 最新迁移：`b53902250590` (add_workflow_id_to_tasks)

### 种子数据要求
- Admin 用户：email=admin@example.com, password=Admin@2026, role=admin
- Agent 类型：
  - id=type-cc, name=cc, display_name=Claude Code
  - id=6e2dcf6e-948e-4474-a493-34e35cd36f6b, name=codex, display_name=Codex
  - id=546aa350-15eb-43d2-851b-3cb4b3af7981, name=opencode, display_name=OpenCode
  - id=517546fc-262c-4a38-a320-1016cbea1cb0, name=openclaw, display_name=OpenClaw

### 注意
1. 密码需要 hash 处理（查看现有代码中的密码 hash 方式，通常是 bcrypt）
2. 确保 Alembic 的 `alembic_version` 表正确记录当前版本
3. 修复后启动 uvicorn 确认可正常运行
4. 不要修改任何 ORM 模型定义或迁移文件，只修复数据库状态

## 完成后
1. commit 并推送到 GitHub
2. 通知我，我会在服务器上拉取并重启服务
