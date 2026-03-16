# Nexus 开发任务 T10-A：任务实例化 — 后端

## 必读文件（先读完再动手）
- CLAUDE.md
- docs/architecture-v4.md（第2章表结构、第3章 API）
- backend/app/models/task.py（NexusTask 模型）
- backend/app/models/project.py（Project 模型）
- backend/app/models/workflow.py（Workflow/WorkflowExecution 模型）
- backend/app/routers/tasks.py（当前 tasks API）
- backend/app/routers/projects.py（当前 projects API）
- backend/app/routers/workflows.py（当前 workflows API）
- backend/app/routers/tasks_v3.py（v3 tasks 路由）

## 重要上下文
- 数据库已清空重建，所有表全新，数据为零
- Task 模型是 `NexusTask`（app/models/task.py），不是旧的 orm_models.Task
- Project 模型有 `user_id` 字段
- 已有 `workflow_executions` 表和 `workflow_node_executions` 表
- 已有 `project_documents` 表、`task_files` 表

## 任务目标
实现任务实例化的后端 API，支持基于工作流模板创建项目/任务。

## 具体要求

### 10A.1 项目创建 API 增强

`POST /api/v1/projects` 增强：
```
{
  "name": "项目名称",
  "description": "项目描述",
  "workflow_id": "可选，关联工作流模板",
  "config_overrides": {  // 可选，工作流节点配置覆盖
    "node_id_1": { "prompt": "自定义指令", "timeout": 600 },
    "node_id_2": { "model": "opus" }
  }
}
```
- `workflow_id` 为可选字段，关联后项目可以使用该工作流
- `config_overrides` 存储为 JSON 字符串，保存到 `projects.config_overrides` 字段（需新增）

### 10A.2 任务创建 API

`POST /api/v1/projects/{project_id}/tasks`：
```
{
  "name": "任务名称",
  "description": "任务描述",
  "workflow_id": "关联的工作流模板 ID",
  "assigned_agent": "可选，指定 Agent",
  "config_overrides": { ... },  // 工作流节点配置覆盖
  "schedule": {                 // 可选，执行调度
    "type": "immediate",        // immediate / cron / interval
    "cron_expression": "0 * * * *",  // type=cron 时
    "interval_seconds": 3600         // type=interval 时
  }
}
```

`POST /api/v1/tasks`（独立任务，不归属项目）：
- 同上，`project_id` 为空或 null

### 10A.3 任务配置覆盖表

使用已有的 `task_agent_configs` 表（如果不存在则创建）：
```sql
CREATE TABLE IF NOT EXISTS task_agent_configs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  workflow_node_id TEXT NOT NULL,
  agent_type_id TEXT,
  config_override TEXT,  -- JSON
  created_at TEXT,
  updated_at TEXT
);
```

### 10A.4 任务文档隔离

使用已有的 `project_documents` 和 `task_files` 表：
- `project_documents`：项目级文档，`project_id` 关联
- `task_files`：任务级附件，`task_id` 关联

### 10A.5 定时/循环执行

- 创建任务时如果 `schedule.type != "immediate"`，创建对应的 APScheduler job
- cron 类型：用 `scheduler.add_job(cron, ...)` 
- interval 类型：用 `scheduler.add_job(interval, ...)`
- 执行时创建 `workflow_execution` 记录，调用 `workflow_engine.start()`
- 每次执行产生独立的 execution_id

### 10A.6 任务状态机

```
pending → running → completed
pending → running → failed
pending → scheduled（定时/循环）
scheduled → running → completed
running → paused → resumed → running
running → cancelled
```

### 10A.7 任务列表查询

`GET /api/v1/projects/{project_id}/tasks`：
- 支持分页、状态过滤、排序
- 返回任务基本信息 + workflow 名称 + agent 名称（关联查询）

`GET /api/v1/tasks`（独立任务列表）：
- 同上，但只返回不归属项目的任务

## 完成标准
- [ ] 项目创建 API 支持可选 workflow_id 和 config_overrides
- [ ] 项目下创建任务 API 正常工作
- [ ] 独立任务创建 API 正常工作
- [ ] 配置覆盖正确存储和读取
- [ ] 定时/循环任务创建后 scheduler 正确注册
- [ ] 任务状态机流转正确
- [ ] 任务列表查询支持过滤排序
- [ ] Python 语法检查通过
- [ ] API 可正常响应（用 curl 或 FastAPI docs 测试）

## 不要做的事
- 不要修改前端代码（T10-B 负责）
- 不要修改工作流编辑器（T8 负责）
- 不要修改工作流执行引擎核心逻辑（T9 负责）
- 不要 git commit
