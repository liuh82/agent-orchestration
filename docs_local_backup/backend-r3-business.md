# Nexus 后端 — 第 3 轮：核心业务（Agent + Project + Task + Job）

> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/backend/`
> **前置条件**: 第 1-2 轮已完成（基础设施 + 用户认证）
> **完整文档参考**: `../docs/backend-dev-prompt.md`

---

## 任务清单

### 1. AgentType 模型 — `app/models/agent_type.py`

```python
class AgentType(Base, TimestampMixin):
    __tablename__ = "agent_types"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255))
    protocol: Mapped[str] = mapped_column(String(50), nullable=False)  # ssh, websocket, local_process
    config_schema: Mapped[str | None] = mapped_column(Text)  # JSON
    capabilities: Mapped[str | None] = mapped_column(Text)  # JSON array
    default_models: Mapped[str | None] = mapped_column(Text)  # JSON array
    is_system: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str | None] = mapped_column(String(36))  # FK to users, 可选
```

### 2. AgentInstance 模型 — `app/models/agent_instance.py`

```python
class AgentInstance(Base, TimestampMixin):
    __tablename__ = "agent_instances"
    __table_args__ = (
        Index('idx_agent_instances_user_id', 'user_id'),
        UniqueConstraint('user_id', 'name', name='uq_user_agent_name'),
    )
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    type_id: Mapped[str] = mapped_column(String(36), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default='offline')  # online/offline/busy/error
    model: Mapped[str | None] = mapped_column(String(100))
    config: Mapped[str | None] = mapped_column(Text)  # JSON
    
    # 统计
    task_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    failed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[str | None] = mapped_column(String)
```

### 3. Project 模型 — `app/models/project.py`

```python
class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_user_project_name'),
    )
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    spec: Mapped[str | None] = mapped_column(Text)  # Markdown/YAML
    workflow_id: Mapped[str | None] = mapped_column(String(36))  # FK to workflows
    status: Mapped[str] = mapped_column(String(20), default='active')
    
    total_tasks: Mapped[int] = mapped_column(Integer, default=0)
    completed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
```

### 4. Task 模型 — `app/models/task.py`

```python
class Task(Base, TimestampMixin):
    __tablename__ = "tasks"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    parent_task_id: Mapped[str | None] = mapped_column(String(36))  # 自引用，支持子任务
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    spec: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), default='medium')
    status: Mapped[str] = mapped_column(String(20), default='pending')
    depends_on: Mapped[str | None] = mapped_column(Text)  # JSON array of task_ids
    assigned_agent: Mapped[str | None] = mapped_column(String(36))
    
    total_jobs: Mapped[int] = mapped_column(Integer, default=0)
    completed_jobs: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    
    started_at: Mapped[str | None] = mapped_column(String)
    completed_at: Mapped[str | None] = mapped_column(String)
```

### 5. Job 模型 — `app/models/job.py`

```python
class Job(Base, TimestampMixin):
    __tablename__ = "jobs"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    task_id: Mapped[str] = mapped_column(String(36), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    agent_inst_id: Mapped[str | None] = mapped_column(String(36))
    
    name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default='pending')
    priority: Mapped[str] = mapped_column(String(20), default='medium')
    
    # 执行内容
    prompt: Mapped[str | None] = mapped_column(Text)
    action_params: Mapped[str | None] = mapped_column(Text)  # JSON
    result: Mapped[str | None] = mapped_column(Text)  # JSON
    error_message: Mapped[str | None] = mapped_column(Text)
    input_files: Mapped[str | None] = mapped_column(Text)  # JSON array
    output_files: Mapped[str | None] = mapped_column(Text)  # JSON array
    messages: Mapped[str | None] = mapped_column(Text)  # JSON
    node_data: Mapped[str | None] = mapped_column(Text)  # JSON
    spec: Mapped[str | None] = mapped_column(Text)
    
    # Token 统计
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    
    # 重试
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    
    # 超时
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=300)
    
    started_at: Mapped[str | None] = mapped_column(String)
    completed_at: Mapped[str | None] = mapped_column(String)
```

### 6. Pydantic Schemas

为每个模型创建 `schemas/agent.py`、`schemas/project.py`、`schemas/task.py`、`schemas/job.py`：
- Create 请求
- Update 请求
- Out（响应）
- 统一用 `from_attributes = True`

### 7. API Routers

#### `app/routers/agents.py` — 10 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/agents` | 我的 Agent 列表（分页） |
| POST | `/api/v1/agents` | 创建实例 |
| GET | `/api/v1/agents/:id` | 实例详情 |
| PUT | `/api/v1/agents/:id` | 更新配置 |
| DELETE | `/api/v1/agents/:id` | 删除实例 |
| POST | `/api/v1/agents/:id/test` | 测试连通（返回 success/fail） |
| POST | `/api/v1/agents/:id/start` | 启动 |
| POST | `/api/v1/agents/:id/stop` | 停止 |
| GET | `/api/v1/agents/:id/logs` | 日志（分页） |
| GET | `/api/v1/agent-types` | 可用类型列表（前台只读） |

**关键**：所有查询必须过滤 `user_id == current_user.id`（多租户隔离）

#### `app/routers/projects.py` — 5 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects` | 我的项目列表（分页） |
| POST | `/api/v1/projects` | 创建项目 |
| GET | `/api/v1/projects/:id` | 项目详情 |
| PUT | `/api/v1/projects/:id` | 更新 |
| DELETE | `/api/v1/projects/:id` | 归档（设 status=archived） |

#### `app/routers/tasks.py` — 5 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:pid/tasks` | 项目下任务列表 |
| POST | `/api/v1/projects/:pid/tasks` | 创建任务 |
| GET | `/api/v1/tasks/:id` | 任务详情 |
| PUT | `/api/v1/tasks/:id` | 更新 |
| DELETE | `/api/v1/tasks/:id` | 删除 |

#### `app/routers/jobs.py` — 5 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tasks/:tid/jobs` | 任务下 Job 列表 |
| GET | `/api/v1/jobs/:id` | Job 详情 |
| POST | `/api/v1/jobs/:id/retry` | 重试（retry_count++, status=pending） |
| POST | `/api/v1/jobs/:id/approve` | 审批通过 |
| POST | `/api/v1/jobs/:id/reject` | 审批拒绝 |

### 8. 统一响应格式

```python
def success_response(data, message="success"):
    return {"code": 0, "data": data, "message": message}

def paged_response(items, total, page, page_size):
    return {"code": 0, "data": {"items": items, "total": total, "page": page, "page_size": page_size}, "message": "success"}
```

### 9. 分页参数

所有列表 API 支持：
- `page: int = 1`
- `page_size: int = 20`
- `sort_by: str = "created_at"`（可选）
- `sort_order: str = "desc"`（可选）
- `search: str`（可选，搜索名称/描述）

### 10. Alembic Migration

```bash
alembic revision --autogenerate -m "add_core_business_tables"
alembic upgrade head
```

---

## 输出要求

1. 所有 25 个端点可用（带 Bearer token）
2. 多租户隔离：用户 A 看不到用户 B 的 Agent/Project/Task
3. 分页正常工作
4. Agent 详情返回嵌套的 type 信息
5. Project 详情返回统计汇总
6. Job 重试正确更新 retry_count

---

## ⚠️ 注意

- 所有业务查询加 `user_id` 过滤
- 创建时校验配额（max_agents, max_projects, max_tasks）
- 删除用软删除（is_active=False）或归档（status=archived）
- 不动 Gateway 和现有 router
- 下一轮：Admin + 配置 + 通知 + 统计 + 种子数据
