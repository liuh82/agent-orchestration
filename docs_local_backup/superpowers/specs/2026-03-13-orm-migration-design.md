# ORM 迁移设计文档

> 项目：AI Agent Orchestration
> 版本：v2.3.5
> 设计日期：2026-03-13
> 目标：将后端全部原生 SQL 重写为 SQLAlchemy 2.0 ORM

---

## 一、概述

### 1.1 背景

后端目前使用 **4 个独立的 SQLite 数据库文件**：
- `tasks.db` — 18 个表（核心业务数据）
- `costs.db` — 3 个表（成本数据，与 tasks.db 有表冲突）
- `workflows.db` — 2 个表（工作流数据）
- `agents.db` — 1 个表（冗余的 agents 数据）

12 个 service 文件共 **147 处**原生 SQL 操作（`cursor.execute` / `fetchall` / `fetchone` / `sqlite3.connect`）。SQLAlchemy 2.0.23 已在 requirements.txt 中但从未使用。

本次迁移将：
1. 合并所有数据库到单一 `tasks.db`（最终 21 个表）
2. 将原生 SQL 替换为 SQLAlchemy 2.0 ORM
3. 引入 Alembic 进行数据库版本管理

### 1.2 目标

1. **零原生 SQL** — 完全消除 `cursor.execute`、`sqlite3.connect` 等裸数据库操作
2. **单一数据库** — 合并 4 个数据库到 `tasks.db`，支持跨表查询和事务一致性
3. **数据安全** — 现有数据完整保留，迁移脚本无 DROP TABLE
4. **保持兼容** — API 接口、请求/响应格式不变，前端无需修改
5. **可维护性** — 通过 Alembic 管理数据库版本

---

## 二、架构设计

### 2.1 当前数据库架构（迁移前）

| 数据库文件 | 大小 | 包含的表 | Service |
|-----------|------|---------|---------|
| `tasks.db` | 245KB | 18 个表 | task, agent, goal, role, org_chart, audit, approval, member, heartbeat |
| `costs.db` | 28KB | 3 个表 | cost, budget_service |
| `workflows.db` | 20KB | 2 个表 | workflow |
| `agents.db` | 12KB | 1 个表 | (冗余) |

**问题**：
- 无法跨表 JOIN 查询
- 跨数据库事务无法保证一致性
- ORM 设计复杂（需配置多引擎）
- Alembic 迁移困难

### 2.2 目标架构（迁移后）

```
┌─────────────────────────────────────────────────────────────────┐
│                         FastAPI 应用层                          │
│  routers/ (依赖注入: db: Session = Depends(get_db))            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Service 层                               │
│  所有方法接收 db: Session 参数，不再管理连接                     │
│  删除 _init_db(), self.conn, cursor.execute                    │
│  统一使用 tasks.db 数据库                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORM 模型层                                 │
│  app/models/orm_models.py - 21 个模型类                        │
│  DeclarativeBase + Mapped[T]                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              SQLAlchemy 2.0 (Sync) + Alembic                    │
│  app/database.py (engine, SessionLocal, get_db)                 │
│  SQLite (WAL mode)                                              │
│  单一数据库: tasks.db                                           │
│  alembic/ (迁移脚本管理)                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 技术决策

| 决策项 | 选择 | 理由 |
|-------|------|-----|
| SQLAlchemy 模式 | **Sync (Session)** | 现有 async 路由调 sync service 已在生产运行，FastAPI 线程池模式验证有效。Async SQLAlchemy API 语法差异大，一起改容易出 bug |
| Service 实例化 | **直接传递 db** | 简单直接，可选依赖注入包装 |
| 数据库策略 | **合并到单一数据库** | 支持跨表 JOIN、事务一致性、简化 ORM 和 Alembic |
| 迁移工具 | **Alembic** | 生产级方案，支持版本控制和回滚 |

---

## 三、数据库模型

### 3.1 ORM 模型列表（21 个表）

> 迁移后，tasks.db 将包含所有 21 个表。

| 序号 | 模型类 | 表名 | 原数据库 | 说明 |
|------|-------|------|---------|------|
| 1 | `Agent` | `agents` | tasks.db | Agent 实体（含统计字段） |
| 2 | `AgentLog` | `agent_logs` | tasks.db | Agent 日志 |
| 3 | `TaskAssignment` | `task_assignments` | tasks.db | 任务分配 |
| 4 | `Task` | `tasks` | tasks.db | 任务 |
| 5 | `Budget` | `budgets` | tasks.db | 预算（主表） |
| 6 | `CostAlert` | `cost_alerts` | tasks.db | 成本告警（保留 tasks.db 版本） |
| 7 | `DailyCost` | `daily_costs` | tasks.db | 日成本统计 |
| 8 | `OrgChartNode` | `org_chart_nodes` | tasks.db | 组织架构节点 |
| 9 | `Department` | `departments` | tasks.db | 部门 |
| 10 | `Role` | `roles` | tasks.db | 角色 |
| 11 | `Member` | `members` | tasks.db | 成员 |
| 12 | `Goal` | `goals` | tasks.db | 目标 |
| 13 | `GoalAlignment` | `goal_alignments` | tasks.db | 目标对齐 |
| 14 | `Approval` | `approvals` | tasks.db | 审批 |
| 15 | `ApprovalHistory` | `approval_history` | tasks.db | 审批历史 |
| 16 | `AuditLog` | `audit_logs` | tasks.db | 审计日志 |
| 17 | `Heartbeat` | `heartbeats` | tasks.db | 心跳配置 |
| 18 | `HeartbeatLog` | `heartbeat_logs` | tasks.db | 心跳日志 |
| 19 | `Workflow` | `workflows` | workflows.db | 工作流定义（需迁移） |
| 20 | `WorkflowTemplate` | `workflow_templates` | workflows.db | 工作流模板（需迁移） |
| 21 | `CostEntry` | `cost_entries` | costs.db | 成本明细（需迁移） |

> **重要**：
> - 迁移前：tasks.db 有 18 个表
> - 迁移后：tasks.db 有 21 个表（新增 3 个：workflows, workflow_templates, cost_entries）
> - `agents.db` 已废弃，4 条数据合并到 tasks.db 的 `agents` 表
> - `costs.db` 中的 `budget_configs` 废弃（已有 tasks.db.budgets）
> - `costs.db` 中的 `cost_alerts` 废弃（已有 tasks.db.cost_alerts）

### 3.2 索引列表

| 表名 | 索引名 | 字段 |
|------|-------|------|
| `roles` | `idx_roles_code` | `code` |
| `members` | `idx_members_email` | `email` |
| `members` | `idx_members_department_id` | `department_id` |
| `goals` | `idx_goals_owner_id` | `owner_id` |
| `goals` | `idx_goals_department_id` | `department_id` |
| `goal_alignments` | `idx_goal_alignments_parent_id` | `parent_id` |
| `goal_alignments` | `idx_goal_alignments_child_id` | `child_id` |
| `approvals` | `idx_approvals_requester_id` | `requester_id` |
| `approvals` | `idx_approvals_status` | `status` |
| `approval_history` | `idx_approval_history_approval_id` | `approval_id` |
| `audit_logs` | `idx_audit_logs_user_id` | `user_id` |
| `audit_logs` | `idx_audit_logs_resource_type` | `resource_type` |
| `audit_logs` | `idx_audit_logs_created_at` | `created_at` |
| `audit_logs` | `idx_audit_logs_resource` | `(resource_type, resource_id)` |
| `heartbeat_logs` | `idx_heartbeat_logs_heartbeat_id` | `heartbeat_id` |
| `heartbeat_logs` | `idx_heartbeat_logs_started_at` | `started_at DESC` |

---

## 四、数据库合并策略

### 4.1 当前数据库状态

| 数据库文件 | 大小 | 表数 | 包含的表 |
|-----------|------|-----|---------|
| `tasks.db` | 245KB | 18 | agents, agent_logs, tasks, task_assignments, budgets, cost_alerts, daily_costs, goals, goal_alignments, roles, members, departments, org_chart_nodes, approvals, approval_history, audit_logs, heartbeats, heartbeat_logs |
| `costs.db` | 28KB | 3 | cost_entries, budget_configs, cost_alerts |
| `workflows.db` | 20KB | 2 | workflows, workflow_templates |
| `agents.db` | 12KB | 1 | agents |

### 4.2 表冲突分析

| 冲突表 | tasks.db 结构 | costs.db 结构 | 处理方式 |
|--------|---------------|---------------|---------|
| `cost_alerts` | 有，关联 `budgets` 表 | 有，关联 `budget_configs` 表 | **保留 tasks.db 版本**，忽略 costs.db 版本 |
| `budgets` vs `budget_configs` | 预算实体，含 `current_cost` | 预算配置，不含 `current_cost` | 保留 `budgets` 作为主表，废弃 `budget_configs` |

### 4.3 合并步骤

1. **备份所有数据库**
   ```bash
   cp tasks.db tasks.db.backup
   cp costs.db costs.db.backup
   cp workflows.db workflows.db.backup
   cp agents.db agents.db.backup
   ```

2. **在 tasks.db 中创建缺失的表**（从其他数据库导入表结构）

3. **附加并导入数据**
   - 将 `costs.db` 的 `cost_entries` 表导入到 `tasks.db`
   - 将 `workflows.db` 的 2 个表导入到 `tasks.db`
   - 将 `agents.db` 的 4 条 agents 数据导入到 `tasks.db`
   - 验证数据完整性

4. **删除旧数据库文件**（在验证通过后）

### 4.4 数据合并脚本

> **注意**：使用 `ATTACH DATABASE` + `CREATE TABLE AS` + `INSERT INTO ... SELECT` 方式。

```python
import sqlite3

def merge_databases():
    """合并所有数据库到 tasks.db"""
    # 主数据库
    main_conn = sqlite3.connect('tasks.db')
    main_cursor = main_conn.cursor()

    # 1. 合并 costs.db（只迁移 cost_entries，跳过 budget_configs 和 cost_alerts）
    print("合并 costs.db...")
    main_cursor.execute("ATTACH DATABASE 'costs.db' AS costs_db")

    # 1.1 创建 cost_entries 表（如果不存在）
    main_cursor.execute("""
        CREATE TABLE IF NOT EXISTS cost_entries (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            total_cost REAL DEFAULT 0,
            currency TEXT DEFAULT 'USD',
            timestamp TEXT,
            metadata TEXT
        )
    """)

    # 1.2 迁移 cost_entries 数据
    main_cursor.execute("""
        INSERT INTO cost_entries
        SELECT * FROM costs_db.cost_entries
        WHERE id NOT IN (SELECT id FROM cost_entries)
    """)

    # 1.3 跳过 budget_configs（使用 tasks.db 中的 budgets 表）
    # 1.4 跳过 cost_alerts（使用 tasks.db 中的 cost_alerts 表）

    main_cursor.execute("DETACH DATABASE costs_db")

    # 2. 合并 workflows.db
    print("合并 workflows.db...")
    main_cursor.execute("ATTACH DATABASE 'workflows.db' AS workflows_db")

    # 2.1 创建 workflows 表（如果不存在）
    main_cursor.execute("""
        CREATE TABLE IF NOT EXISTS workflows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            engine TEXT NOT NULL,
            definition TEXT,
            config TEXT,
            created_by TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """)

    # 2.2 迁移 workflows 数据
    main_cursor.execute("""
        INSERT INTO workflows
        SELECT * FROM workflows_db.workflows
        WHERE id NOT IN (SELECT id FROM workflows)
    """)

    # 2.3 创建 workflow_templates 表（如果不存在）
    main_cursor.execute("""
        CREATE TABLE IF NOT EXISTS workflow_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            engine TEXT NOT NULL,
            category TEXT,
            definition TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """)

    # 2.4 迁移 workflow_templates 数据
    main_cursor.execute("""
        INSERT INTO workflow_templates
        SELECT * FROM workflows_db.workflow_templates
        WHERE id NOT IN (SELECT id FROM workflow_templates)
    """)

    main_cursor.execute("DETACH DATABASE workflows_db")

    # 3. 合并 agents.db（只迁移基础字段，统计字段使用默认值）
    print("合并 agents.db...")
    main_cursor.execute("ATTACH DATABASE 'agents.db' AS agents_db")

    main_cursor.execute("""
        INSERT INTO agents (
            id, name, type, status, model, timeout, skills, capabilities,
            created_at, updated_at, last_seen,
            task_count, completed_tasks, failed_tasks, total_tokens_used,
            total_cost, avg_response_time, avg_task_duration
        )
        SELECT
            id, name, type, status, model, timeout, skills, capabilities,
            created_at, updated_at, last_seen,
            0, 0, 0, 0,  -- 统计字段默认为 0
            0.0, 0.0, 0.0
        FROM agents_db.agents
        WHERE id NOT IN (SELECT id FROM agents)
    """)

    main_cursor.execute("DETACH DATABASE agents_db")

    main_conn.commit()
    main_conn.close()
    print("数据库合并完成！")
```

### 4.5 表冲突处理

| 冲突表 | 处理方式 | 说明 |
|--------|---------|------|
| `cost_alerts` | 保留 `tasks.db` 版本 | 丢弃 `costs.db` 版本（结构不同，且 tasks.db 已有 production 版本） |
| `budgets` vs `budget_configs` | 保留 `budgets`，废弃 `budget_configs` | `budgets` 有更完整的字段（current_cost, is_triggered） |
| `agents` | 迁移 `agents.db` 的 4 条数据到 `tasks.db` | 仅迁移基础字段，统计字段默认为 0 |

---

## 五、模块设计

### 5.1 app/database.py

数据库会话管理模块。

```python
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from typing import Generator
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tasks.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False
)

# SQLite WAL 模式：提升并发性能
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 5.2 app/models/orm_models.py

21 个 ORM 模型类，使用 SQLAlchemy 2.0 声明式映射（`DeclarativeBase` + `Mapped`）。

**关键字段类型：**
- `id`: `Mapped[str] = mapped_column(String, primary_key=True)`
- 时间字段: `Mapped[str] = mapped_column(String)`（存储 ISO 格式字符串）
- JSON 字段: `Mapped[Optional[str]] = mapped_column(Text)`（通过 Property 转换）

**示例模型结构：**

```python
from sqlalchemy import String, Integer, Float, Boolean, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from uuid import uuid4

class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(50), default="claude-code")
    status: Mapped[str] = mapped_column(String(20), default="offline")
    # ... 其他字段

    # 关系
    logs: Mapped[List["AgentLog"]] = relationship("AgentLog", back_populates="agent", cascade="all, delete-orphan")
    assignments: Mapped[List["TaskAssignment"]] = relationship("TaskAssignment", back_populates="agent")

# costs.db 表
class CostEntry(Base):
    __tablename__ = "cost_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    agent_id: Mapped[str] = mapped_column(String)
    task_id: Mapped[str] = mapped_column(String)
    model: Mapped[str] = mapped_column(String)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String, default="USD")
    timestamp: Mapped[Optional[str]] = mapped_column(String)
    metadata: Mapped[Optional[str]] = mapped_column(Text)

# workflows.db 表
class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    engine: Mapped[str] = mapped_column(String(50))
    definition: Mapped[Optional[str]] = mapped_column(Text)
    config: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)
    updated_at: Mapped[str] = mapped_column(String)
```

### 5.3 Service 层重写

**重写规则：**

| 原生 SQL | ORM 替换 |
|---------|---------|
| `SELECT * WHERE id = ?` | `db.execute(select(Model).where(Model.id == id)).scalar_one_or_none()` |
| `SELECT * FROM table` | `db.execute(select(Model)).scalars().all()` |
| `INSERT INTO ...` | `obj = Model(...); db.add(obj); db.commit(); db.refresh(obj)` |
| `UPDATE ... SET` | 找到对象后直接修改属性，`db.commit()` |
| `DELETE` | `db.delete(obj); db.commit()` |
| `LIMIT ? OFFSET ?` | `.offset((page-1)*size).limit(size)` |
| `COUNT(*)` | `db.execute(select(func.count()).select_from(Model)).scalar()` |
| 事务 | `try: ...; db.commit()` / `except: db.rollback()` |
| `COALESCE` | Python 中的 `if new_val is not None: obj.field = new_val` |

**Service 方法签名变更：**

```python
# 之前
class AgentService:
    def __init__(self):
        self.conn = sqlite3.connect('tasks.db', check_same_thread=False)
        self._init_db()

    async def get_agent(self, agent_id: str) -> Optional[Agent]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM agents WHERE id = ?', (agent_id,))
        ...

# 之后
class AgentService:
    def __init__(self, db: Session):
        self.db = db

    def get_agent(self, agent_id: str) -> Optional[Agent]:
        return self.db.execute(
            select(Agent).where(Agent.id == agent_id)
        ).scalar_one_or_none()
```

**Service 文件数据库路径更新：**

| Service | 原数据库 | 新数据库 | 备注 |
|---------|---------|---------|------|
| `agent.py` | `tasks.db` | `tasks.db` (不变) | - |
| `task.py` | `tasks.db` | `tasks.db` (不变) | - |
| `cost.py` | `costs.db` | **`tasks.db`** | 需要更新，表结构不变 |
| `budget_service.py` | `tasks.db` | `tasks.db` (不变) | 使用 `budgets` 表 |
| `workflow.py` | `workflows.db` | **`tasks.db`** | 需要更新，表结构不变 |
| 其他 | `tasks.db` | `tasks.db` (不变) | - |

**Service 依赖处理：**

```python
class TaskService:
    def __init__(self, db: Session):
        self.db = db
        self.agent_service = AgentService(db)  # 共享同一个 Session
```

### 5.4 Router 层更新

```python
from app.database import get_db
from sqlalchemy.orm import Session
from ..services.agent import AgentService

router = APIRouter()

@router.get("/")
async def get_agents(db: Session = Depends(get_db)):
    service = AgentService(db)
    return await service.get_all_agents()
```

### 5.5 Alembic 迁移

**文件结构：**

```
alembic/
├── env.py              # 迁移环境配置
├── script.py.mako      # 迁移脚本模板
└── versions/
    └── 001_merge_databases.py  # 数据库合并 + 初始迁移
```

**迁移脚本包含：**
1. `CREATE TABLE` 语句（21 个表）
2. `CREATE INDEX` 语句
3. 确保无 `DROP TABLE`

**数据保留注意事项：**
- 迁移脚本必须**不包含 DROP TABLE**
- 使用 `alembic revision --autogenerate` 生成，人工审查
- 在开发环境先测试，确认数据完整性后再应用到生产

---

## 六、Service 重写顺序

| 文件 | 原生 SQL 数 | 依赖关系 | 数据库 | 复杂度 |
|------|-----------|---------|-------|-------|
| 1. `task.py` | 6 | 无 | tasks.db | 低 |
| 2. `role.py` | 10 | 无 | tasks.db | 低 |
| 3. `org_chart.py` | 10 | 无 | tasks.db | 低 |
| 4. `member.py` | 13 | 无 | tasks.db | 中 |
| 5. `cost.py` | 10 | 无 | **costs.db → tasks.db** | 中 |
| 6. `budget_service.py` | 17 | 无 | tasks.db | 中 |
| 7. `audit.py` | 14 | 无 | tasks.db | 中 |
| 8. `workflow.py` | 11 | 无 | **workflows.db → tasks.db** | 中 |
| 9. `approval.py` | 15 | 无 | tasks.db | 中 |
| 10. `goal.py` | 16 | 无 | tasks.db | 中 |
| 11. `agent.py` | 17 | 无 | tasks.db | 中 |
| 12. `heartbeat.py` | 8 | 无 | tasks.db | 高 |

**跨数据库迁移标记**：
- `cost.py` - 需要更新数据库路径从 `costs.db` 到 `tasks.db`
- `workflow.py` - 需要更新数据库路径从 `workflows.db` 到 `tasks.db`

---

## 七、测试更新

### 7.1 依赖覆盖

```python
from app.database import Base, SessionLocal, engine, get_db
from fastapi.testclient import TestClient

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
```

---

## 八、验收标准

### 8.1 代码检查

```bash
# 1. 零原生 SQL 残留
grep -rn "cursor.execute\|cursor.fetchall\|cursor.fetchone\|sqlite3.connect\|_get_connection" app/services/
# 期望：返回空

# 2. 无导入 sqlite3
grep -rn "import sqlite3" app/
# 期望：返回空

# 3. 无多数据库连接
grep -rn "costs\.db\|workflows\.db\|agents\.db" app/
# 期望：返回空（全部使用 tasks.db）
```

### 8.2 数据库验证

```bash
# 4. 单一数据库文件
ls backend/*.db
# 期望：只有 tasks.db（其他已删除）

# 5. 所有表存在
sqlite3 backend/tasks.db ".tables"
# 期望：21 个表（新增 workflows, workflow_templates, cost_entries）

# 6. 数据完整性验证（新迁移的表）
sqlite3 backend/tasks.db "SELECT COUNT(*) FROM workflows"
# 期望：与 workflows.db 中的数据一致
sqlite3 backend/tasks.db "SELECT COUNT(*) FROM cost_entries"
# 期望：与 costs.db 中的数据一致

# 7. agents 数据迁移验证
sqlite3 backend/tasks.db "SELECT COUNT(*) FROM agents"
# 期望：12（tasks.db 原有 8 条 + agents.db 迁移 4 条）
```

### 8.3 功能测试

```bash
# 8. 后端测试全部通过
cd backend && python3 -m pytest tests/ -v
# 期望：23/23 通过

# 9. 前端编译检查
cd frontend && npx tsc --noEmit
# 期望：0 error

# 10. 前端构建
cd frontend && npm run build
# 期望：成功

# 11. API 端点测试
curl -H "X-API-Key: dev-api-key-please-change-in-production" http://localhost:8083/api/agents
curl -H "X-API-Key: dev-api-key-please-change-in-production" http://localhost:8083/api/tasks
curl -H "X-API-Key: dev-api-key-please-change-in-production" http://localhost:8083/api/workflows
curl -H "X-API-Key: dev-api-key-please-change-in-production" http://localhost:8083/api/cost
curl -H "X-API-Key: dev-api-key-please-change-in-production" http://localhost:8083/api/heartbeats
# 期望：所有端点返回正确格式
```

---

## 九、注意事项

1. **不要改 API 接口** — URL、请求/响应格式不变，前端依赖这些接口
2. **不要删 Pydantic schema** — 只改数据访问层
3. **保留 JSON 序列化逻辑** — `action_params`、`metadata` 等字段的处理逻辑
4. **数据备份** — 迁移前备份所有数据库文件
5. **每个文件改完就 commit** — 方便 review
6. **先在开发环境测试** — 确认数据完整性后再应用到生产
7. **WAL 模式** — 数据库文件在迁移后自动开启 WAL 模式
8. **删除旧数据库** — 在验证通过后删除 `costs.db`、`workflows.db`、`agents.db`
9. **废弃的表** — `budget_configs`（costs.db）和 `cost_alerts`（costs.db）不迁移，已有 tasks.db 中的对应表替代
