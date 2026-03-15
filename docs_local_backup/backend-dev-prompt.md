# Nexus 后端开发任务 — 第一轮迭代

> **目标读者**: 后端开发 Agent（CC / Codex）
> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/backend/`
> **项目名称**: Nexus（原 agent-orchestration）
> **迭代轮次**: 第一轮（重构 + 用户体系 + Agent 管理 + 基础功能）

---

## 一、项目背景

Nexus 是一个 AI Agent 编排管理系统，用于管理和调度多种编程 Agent（CC、Codex、OpenCode 等）。当前版本 v2.4.0 是单用户无认证的单体应用，需要重构为支持多用户、多租户、有认证授权的系统。

**本轮核心目标**：
1. 从零搭建用户认证体系（JWT + bcrypt）
2. 数据库抽象层（SQLite / PostgreSQL 双模式）
3. 拆分现有扁平数据模型为三层结构（Project → Task → Job）
4. Agent 类型/实例分离
5. 基础系统配置和通知通道
6. Token 消耗采集和统计 API

---

## 二、参考文档（开发前必读）

| 文件 | 路径 | 用途 |
|------|------|------|
| **需求文档** | `../docs/requirements-v1.3.md` | 完整功能需求 |
| **架构设计** | `../docs/architecture-v1.md` | 数据模型、API 设计、目录结构 |
| **前端设计规范** | `../frontend/DESIGN_SPEC.md` | 前端规范（了解即可，后端不用遵循） |
| **现有数据模型** | `app/models/orm_models.py` | v2.4.0 的 18 张表 |
| **现有 Gateway 模型** | `app/models/gateway.py` | BridgeRecord + TaskRecord |

---

## 三、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.11+ | 运行时 |
| FastAPI | 0.100+ | Web 框架 |
| SQLAlchemy | 2.0 | ORM（Mapped 声明式） |
| Alembic | 1.x | 数据库迁移 |
| Pydantic | 2.x | 数据校验 + Schema |
| bcrypt | 4.x | 密码哈希 |
| PyJWT | 2.x | JWT Token |
| python-dotenv | 1.x | 环境变量 |
| uvicorn | 0.24+ | ASGI 服务器 |
| websockets | 已有 | Agent 实时状态推送 |

---

## 四、数据模型设计

### 4.1 新增表

**users**（改造自 members）:
```sql
CREATE TABLE users (
    id              VARCHAR(36) PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'user',  -- admin / user
    avatar          VARCHAR(500),
    settings        TEXT,                              -- JSON
    max_agents      INTEGER DEFAULT 10,
    max_projects    INTEGER DEFAULT 20,
    max_tasks       INTEGER DEFAULT 100,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP
);
```

**agent_types**（新增）:
```sql
CREATE TABLE agent_types (
    id              VARCHAR(36) PRIMARY KEY,
    name            VARCHAR(100) UNIQUE NOT NULL,     -- cc, codex, opencode, openclaw
    display_name    VARCHAR(255),
    protocol        VARCHAR(50) NOT NULL,             -- ssh, websocket, local_process
    config_schema   TEXT,                              -- JSON: 连接参数结构定义
    capabilities    TEXT,                              -- JSON: 能力标签列表
    default_models  TEXT,                              -- JSON: 推荐模型列表
    is_system       BOOLEAN DEFAULT TRUE,
    created_by      VARCHAR(36) REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**agent_instances**（改造自 agents）:
```sql
CREATE TABLE agent_instances (
    id              VARCHAR(36) PRIMARY KEY,
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id),
    type_id         VARCHAR(36) NOT NULL REFERENCES agent_types(id),
    name            VARCHAR(255) NOT NULL,
    status          VARCHAR(20) DEFAULT 'offline',
    model           VARCHAR(100),
    config          TEXT,                              -- JSON
    task_count      INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks    INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    total_cost      FLOAT DEFAULT 0.0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at    TIMESTAMP,
    UNIQUE(user_id, name)
);
```

**projects**（新增）:
```sql
CREATE TABLE projects (
    id              VARCHAR(36) PRIMARY KEY,
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    spec            TEXT,
    workflow_id     VARCHAR(36) REFERENCES workflows(id),
    status          VARCHAR(20) DEFAULT 'active',
    total_tasks     INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    total_cost      FLOAT DEFAULT 0.0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);
```

**tasks**（改造）:
```sql
CREATE TABLE tasks (
    id              VARCHAR(36) PRIMARY KEY,
    project_id      VARCHAR(36) NOT NULL REFERENCES projects(id),
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id),
    parent_task_id  VARCHAR(36) REFERENCES tasks(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    spec            TEXT,
    priority        VARCHAR(20) DEFAULT 'medium',
    status          VARCHAR(20) DEFAULT 'pending',
    depends_on      TEXT,                              -- JSON array
    assigned_agent  VARCHAR(36) REFERENCES agent_instances(id),
    total_jobs      INTEGER DEFAULT 0,
    completed_jobs  INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    total_cost      FLOAT DEFAULT 0.0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP
);
```

**jobs**（新增，执行单元）:
```sql
CREATE TABLE jobs (
    id              VARCHAR(36) PRIMARY KEY,
    task_id         VARCHAR(36) NOT NULL REFERENCES tasks(id),
    project_id      VARCHAR(36) NOT NULL REFERENCES projects(id),
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id),
    agent_inst_id   VARCHAR(36) REFERENCES agent_instances(id),
    name            VARCHAR(255),
    status          VARCHAR(20) DEFAULT 'pending',
    priority        VARCHAR(20) DEFAULT 'medium',
    prompt          TEXT,
    action_params   TEXT,                              -- JSON
    result          TEXT,                              -- JSON
    error_message   TEXT,
    input_files     TEXT,                              -- JSON
    output_files    TEXT,                              -- JSON
    messages        TEXT,                              -- JSON
    node_data       TEXT,                              -- JSON
    spec            TEXT,
    prompt_tokens   INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    retry_count     INTEGER DEFAULT 0,
    max_retries     INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 300,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP
);
```

**system_settings**（新增）:
```sql
CREATE TABLE system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT NOT NULL,                      -- JSON
    description     TEXT,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by      VARCHAR(36) REFERENCES users(id)
);
```

**notification_channels**（新增）:
```sql
CREATE TABLE notification_channels (
    id              VARCHAR(36) PRIMARY KEY,
    user_id         VARCHAR(36) REFERENCES users(id),   -- NULL = 全局
    channel_type    VARCHAR(50) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    config          TEXT NOT NULL,                      -- JSON
    triggers        TEXT,                              -- JSON
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 改造的表（增加 user_id）

以下表需要加 `user_id VARCHAR(36) REFERENCES users(id)`:
- `cost_entries` → 增加 `agent_inst_id`（替换原来的 `agent_id`）
- `daily_costs` → 增加 `user_id`
- `budgets` → 增加 `user_id`
- `heartbeats` → 增加 `user_id`
- `agent_logs` → 改为引用 `agent_instances(id)`

### 4.3 搁置的表

以下表移入 `models/legacy/`，不删但不在本轮使用:
- `org_chart_nodes`, `departments`, `goal_alignments`, `approvals`, `approval_history`
- `goals`（后续改为 spec）
- `task_assignments`（被 jobs 替代）

### 4.4 保留不动的表

- `gateway_bridges`, `gateway_tasks` — Gateway 相关，不动
- `workflows`, `workflow_templates` — 后续轮次处理
- `heartbeat_logs` — 不动
- `cost_alerts` — 保留

---

## 五、API 设计（完整列表）

### 5.1 认证

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/v1/auth/register` | 注册 | `{email, password, name}` | `{user, access_token, refresh_token}` |
| POST | `/api/v1/auth/login` | 登录 | `{email, password}` | `{user, access_token, refresh_token}` |
| POST | `/api/v1/auth/refresh` | 刷新 | `{refresh_token}` | `{access_token, refresh_token}` |
| GET | `/api/v1/auth/me` | 当前用户 | — | `{user}` |
| PUT | `/api/v1/auth/me` | 更新信息 | `{name?, avatar?, settings?}` | `{user}` |
| PUT | `/api/v1/auth/password` | 改密码 | `{old_password, new_password}` | `{success}` |

### 5.2 用户管理（Admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/users` | 用户列表（分页） |
| PUT | `/api/v1/admin/users/:id/quota` | 修改配额 `{max_agents, max_projects, max_tasks}` |
| PUT | `/api/v1/admin/users/:id/role` | 修改角色 `{role: admin/user}` |
| PUT | `/api/v1/admin/users/:id/status` | 启用/禁用 `{is_active}` |

### 5.3 Agent 类型（Admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/agent-types` | 类型列表 |
| POST | `/api/v1/admin/agent-types` | 新增类型 |
| PUT | `/api/v1/admin/agent-types/:id` | 编辑类型 |
| DELETE | `/api/v1/admin/agent-types/:id` | 删除（仅非系统预置） |

### 5.4 Agent 实例（用户）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/agents` | 我的实例列表 |
| POST | `/api/v1/agents` | 创建实例 `{type_id, name, model, config}` |
| GET | `/api/v1/agents/:id` | 实例详情 |
| PUT | `/api/v1/agents/:id` | 更新配置 |
| DELETE | `/api/v1/agents/:id` | 删除实例 |
| POST | `/api/v1/agents/:id/test` | 测试连通性 |
| POST | `/api/v1/agents/:id/start` | 启动 |
| POST | `/api/v1/agents/:id/stop` | 停止 |
| GET | `/api/v1/agents/:id/logs` | 实例日志（分页） |
| GET | `/api/v1/agent-types` | 可用类型列表（前台只读） |

### 5.5 项目（用户）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects` | 我的项目列表（分页） |
| POST | `/api/v1/projects` | 创建项目 `{name, description, spec}` |
| GET | `/api/v1/projects/:id` | 项目详情 |
| PUT | `/api/v1/projects/:id` | 更新项目 |
| DELETE | `/api/v1/projects/:id` | 归档项目 |

### 5.6 任务（用户）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:pid/tasks` | 项目下任务列表 |
| POST | `/api/v1/projects/:pid/tasks` | 创建任务 `{name, description, spec, priority, depends_on, assigned_agent}` |
| GET | `/api/v1/tasks/:id` | 任务详情 |
| PUT | `/api/v1/tasks/:id` | 更新任务 |
| DELETE | `/api/v1/tasks/:id` | 删除任务 |

### 5.7 Job（用户）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tasks/:tid/jobs` | 任务下 Job 列表 |
| GET | `/api/v1/jobs/:id` | Job 详情 |
| POST | `/api/v1/jobs/:id/retry` | 重试 |
| POST | `/api/v1/jobs/:id/approve` | 审批通过 |
| POST | `/api/v1/jobs/:id/reject` | 审批拒绝 |

### 5.8 系统设置（Admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/settings` | 获取所有设置 |
| PUT | `/api/v1/admin/settings` | 批量更新 `{settings: {key: value, ...}}` |

### 5.9 通知通道

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/notifications/channels` | 我的通道列表 |
| POST | `/api/v1/notifications/channels` | 创建 `{channel_type, name, config, triggers}` |
| PUT | `/api/v1/notifications/channels/:id` | 更新 |
| DELETE | `/api/v1/notifications/channels/:id` | 删除 |
| POST | `/api/v1/notifications/channels/:id/test` | 测试发送 |
| GET | `/api/v1/admin/notifications/channels` | 全局通道（Admin） |

### 5.10 统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/stats/dashboard` | Dashboard 汇总（我的 Token/费用/任务统计） |
| GET | `/api/v1/stats/projects/:id` | 项目统计 |
| GET | `/api/v1/stats/agents/:id` | Agent 统计 |
| GET | `/api/v1/admin/stats/global` | 全局统计（Admin） |

### 5.11 通用约定

- 所有列表 API 支持分页：`?page=1&page_size=20`
- 所有列表 API 支持排序：`?sort_by=created_at&sort_order=desc`
- 所有列表 API 支持搜索：`?search=keyword`
- 响应格式统一：
```json
// 成功
{"code": 0, "data": {...}, "message": "success"}

// 列表
{"code": 0, "data": {"items": [...], "total": 100, "page": 1, "page_size": 20}}

// 错误
{"code": 40001, "message": "User not found", "data": null}
```

- 认证失败：`401 Unauthorized`
- 权限不足：`403 Forbidden`
- 资源不存在：`404 Not Found`
- 重复资源：`409 Conflict`

---

## 六、目录结构

```
backend/
├── main.py                          # FastAPI 入口 + startup 事件
├── database.py                      # 数据库引擎（SQLite/PG 切换）
├── alembic/
│   ├── alembic.ini
│   ├── env.py
│   └── versions/                    # 迁移版本文件
├── .env.example                     # 环境变量模板
├── app/
│   ├── __init__.py
│   ├── config.py                    # Settings 类（pydantic-settings，读取 .env）
│   ├── deps.py                      # 依赖注入：get_db, get_current_user, require_admin
│   ├── models/
│   │   ├── __init__.py              # 导出所有新模型
│   │   ├── base.py                  # Base, 公共 Mixin（TimestampMixin, TenantMixin）
│   │   ├── user.py
│   │   ├── agent_type.py
│   │   ├── agent_instance.py
│   │   ├── agent_log.py
│   │   ├── project.py
│   │   ├── task.py
│   │   ├── job.py
│   │   ├── cost.py                  # CostEntry, DailyCost（加 user_id）
│   │   ├── budget.py                # Budget（加 user_id）
│   │   ├── heartbeat.py             # Heartbeat（加 user_id）
│   │   ├── heartbeat_log.py         # 不动
│   │   ├── gateway.py               # 保留不动
│   │   ├── gateway_schemas.py       # 保留不动
│   │   ├── workflow.py              # 保留不动
│   │   ├── system_setting.py
│   │   ├── notification.py
│   │   └── legacy/                  # 搁置模型
│   │       ├── org_models.py
│   │       ├── role_models.py
│   │       ├── goal.py
│   │       ├── approval.py
│   │       └── audit_log.py
│   ├── schemas/                     # Pydantic v2 模型
│   │   ├── __init__.py
│   │   ├── auth.py                  # RegisterRequest, LoginRequest, TokenResponse, UserOut
│   │   ├── agent.py                 # AgentTypeOut, AgentInstanceCreate/Update/Out
│   │   ├── project.py               # ProjectCreate/Update/Out
│   │   ├── task.py                  # TaskCreate/Update/Out
│   │   ├── job.py                   # JobOut
│   │   ├── stats.py                 # DashboardStats, ProjectStats
│   │   ├── settings.py              # SystemSettingOut
│   │   ├── notification.py          # NotificationChannelCreate/Update/Out
│   │   └── common.py                # PagedResponse, ErrorResponse
│   ├── routers/
│   │   ├── auth.py                  # 认证相关 6 个端点
│   │   ├── admin.py                 # Admin 4 组端点
│   │   ├── agents.py                # Agent 实例 10 个端点
│   │   ├── projects.py              # 项目 5 个端点
│   │   ├── tasks.py                 # 任务 5 个端点
│   │   ├── jobs.py                  # Job 5 个端点
│   │   ├── gateway.py               # 保留不动
│   │   ├── heartbeats.py            # 保留（加 user_id 过滤）
│   │   ├── stats.py                 # 统计 4 个端点
│   │   ├── settings.py              # 系统设置 2 个端点
│   │   ├── notifications.py         # 通知 6 个端点
│   │   └── ws.py                    # WebSocket（保留）
│   ├── services/
│   │   ├── auth.py                  # JWT 生成/验证, bcrypt, 登录限流
│   │   ├── agent.py                 # Agent 实例业务逻辑
│   │   ├── project.py               # 项目 CRUD
│   │   ├── task.py                  # 任务 CRUD
│   │   ├── job.py                   # Job CRUD + 状态流转
│   │   ├── stats.py                 # 汇总计算（Token/费用/任务）
│   │   ├── notification.py          # 通知通道管理
│   │   ├── seed.py                  # 系统预置数据初始化
│   │   └── gateway/                 # 保留不动
│   └── middleware/
│       ├── __init__.py
│       ├── auth.py                  # JWT 验证中间件
│       ├── tenant.py                # 多租户自动过滤
│       └── rate_limit.py            # 登录限流（5次/分钟）
└── tests/
    ├── conftest.py                  # 测试 fixtures（test DB、test client）
    ├── test_auth.py
    ├── test_agents.py
    ├── test_projects.py
    ├── test_tasks.py
    └── test_jobs.py
```

---

## 七、核心实现要点

### 7.1 数据库抽象

```python
# database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/nexus.db")

# SQLite 需要 check_same_thread=False
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

### 7.2 JWT 认证

```python
# services/auth.py
import bcrypt
import jwt
from datetime import datetime, timedelta

SECRET_KEY = settings.JWT_SECRET
ALGORITHM = "HS256"
ACCESS_EXPIRE = timedelta(hours=24)
REFRESH_EXPIRE = timedelta(days=7)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "access", "exp": datetime.utcnow() + ACCESS_EXPIRE}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh", "exp": datetime.utcnow() + REFRESH_EXPIRE}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
```

### 7.3 多租户中间件

```python
# deps.py — 依赖注入
async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or disabled")
    return user

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user
```

### 7.4 首次启动初始化

```python
# services/seed.py
# 在 FastAPI startup 事件中调用：
# 1. 运行 Alembic upgrade head
# 2. 检查是否有 admin 用户，没有则用 .env 中的 ADMIN_EMAIL/ADMIN_PASSWORD 创建
# 3. 插入系统预置 agent_types:
PRESET_AGENT_TYPES = [
    {"name": "cc", "display_name": "Claude Code", "protocol": "local_process",
     "capabilities": ["coding", "refactoring", "debugging"],
     "default_models": ["claude-3-sonnet", "claude-3-opus"]},
    {"name": "codex", "display_name": "Codex", "protocol": "local_process",
     "capabilities": ["coding", "testing"],
     "default_models": ["gpt-4", "gpt-3.5-turbo"]},
    {"name": "opencode", "display_name": "OpenCode", "protocol": "local_process",
     "capabilities": ["coding"],
     "default_models": ["deepseek-coder", "qwen-coder"]},
    {"name": "openclaw", "display_name": "OpenClaw", "protocol": "websocket",
     "capabilities": ["orchestration", "scheduling"],
     "default_models": ["minimax-M2.5"]},
]
# 4. 插入默认 system_settings（如有需要）
```

### 7.5 现有代码处理

- `gateway.py` / `gateway_schemas.py` — **完全保留不动**
- `workflows.py` — **保留不动**，`projects.workflow_id` 引用它
- 现有 `routers/agents.py` — **重构**，改为基于 agent_instances 的新 API
- 现有 `routers/tasks.py` — **重构**，改为 projects + tasks + jobs 的新 API
- 现有 `routers/heartbeats.py` — **改造**，查询时加 user_id 过滤
- 现有 `database.py` — **改造**，支持 SQLite/PG 切换
- 现有 `main.py` — **改造**，添加 startup 初始化、注册新 router

---

## 八、与前端约定的接口

### API Base URL
- 开发环境：`http://localhost:8081/api/v1`
- 生产环境：`http://<host>:9443/api/v1`

### 认证头
```
Authorization: Bearer <access_token>
```

### 错误码
| code | 含义 |
|------|------|
| 0 | 成功 |
| 40001 | 资源不存在 |
| 40002 | 认证失败 |
| 40003 | 权限不足 |
| 40004 | 参数错误 |
| 40009 | 重复资源 |
| 50001 | 服务器内部错误 |

### 分页响应格式
```json
{
  "code": 0,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

### Agent 实例详情（前端 Dashboard 需要）
```json
{
  "id": "uuid",
  "name": "My CC Agent",
  "type": {"id": "uuid", "name": "cc", "display_name": "Claude Code"},
  "status": "online",
  "model": "claude-3-sonnet",
  "config": {"host": "...", "port": 22},
  "stats": {
    "task_count": 10,
    "completed_tasks": 8,
    "failed_tasks": 1,
    "total_tokens": 150000,
    "total_cost": 3.5
  },
  "is_active": true,
  "last_seen_at": "2026-03-15T00:00:00Z",
  "created_at": "2026-03-15T00:00:00Z"
}
```

### Dashboard 统计响应
```json
{
  "code": 0,
  "data": {
    "agents": {"total": 5, "online": 3, "offline": 2},
    "projects": {"total": 8, "active": 5, "completed": 3},
    "tasks": {"total": 45, "pending": 10, "running": 5, "completed": 25, "failed": 5},
    "jobs": {"total": 120, "pending": 15, "running": 8, "completed": 90, "failed": 7},
    "tokens": {
      "total": 5000000,
      "today": 50000,
      "this_week": 300000,
      "this_month": 2000000
    },
    "cost": {
      "total": 120.5,
      "today": 5.2,
      "this_week": 35.0,
      "this_month": 80.0
    }
  }
}
```

---

## 九、开发清单（按优先级排序）

### P0 — 基础设施（必须先完成）
- [ ] `app/config.py` — 配置管理（pydantic-settings 读取 .env）
- [ ] `database.py` — 数据库引擎改造（SQLite/PG 切换）
- [ ] `alembic/` — Alembic 初始化 + 初始 migration
- [ ] `app/models/base.py` — Base + TimestampMixin + TenantMixin
- [ ] `app/deps.py` — get_db, get_current_user, require_admin

### P1 — 用户认证
- [ ] `app/models/user.py` + `app/schemas/auth.py`
- [ ] `app/services/auth.py` — JWT + bcrypt + 登录限流
- [ ] `app/routers/auth.py` — 6 个认证端点
- [ ] `app/middleware/auth.py` — JWT 验证

### P2 — 核心业务模型
- [ ] `app/models/agent_type.py` + `app/models/agent_instance.py`
- [ ] `app/models/project.py` + `app/models/task.py` + `app/models/job.py`
- [ ] `app/schemas/agent.py` + `project.py` + `task.py` + `job.py`
- [ ] `app/models/system_setting.py` + `notification.py`
- [ ] 改造 cost/budget/heartbeat 模型（加 user_id）

### P3 — 业务 API
- [ ] `app/routers/agents.py` — 重构（10 个端点）
- [ ] `app/routers/projects.py` — 新增（5 个端点）
- [ ] `app/routers/tasks.py` — 重构（5 个端点）
- [ ] `app/routers/jobs.py` — 新增（5 个端点）

### P4 — Admin + 配置
- [ ] `app/routers/admin.py` — Admin API
- [ ] `app/routers/settings.py` — 系统设置
- [ ] `app/routers/notifications.py` — 通知通道
- [ ] `app/routers/stats.py` — 统计 API

### P5 — 初始化 + 测试
- [ ] `app/services/seed.py` — 首次启动初始化
- [ ] `main.py` — startup 事件 + 注册所有新 router
- [ ] `tests/conftest.py` — 测试 fixtures
- [ ] 单元测试（auth, agents, projects, tasks）
- [ ] `.env.example`

---

## 十、注意事项

1. **不要删除现有 Gateway 相关代码**，它是独立运行的
2. **搁置模型移入 `legacy/`**，不删但不在本轮使用
3. **所有业务表必须有 user_id**，通过 `get_current_user` 依赖注入自动过滤
4. **JWT token 用 HS256**，secret 从 .env 读取
5. **SQLite 下 JSON 字段存 TEXT**，PG 下可用原生 JSON 类型，SQLAlchemy 会处理
6. **迁移用 Alembic**，不要手动改表结构
7. **所有 API 响应统一 `{code, data, message}` 格式**
8. **测试数据库用 SQLite 内存模式**`:memory:`
