# Gateway WebSocket Server Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a WebSocket Gateway service in the existing FastAPI backend to manage Remote Agent Bridge connections, route tasks to bridges, and track task lifecycle.

**Architecture:** Module-level singletons for WSServer (connection manager), BridgeManager (in-memory state), and TaskRouter (routing logic). GatewayDB is a stateless data access layer receiving db sessions per-call. Router adds prefix in main.py following existing pattern. HTTP endpoints for external task submission; WebSocket endpoint for Bridge connections.

**Tech Stack:** FastAPI WebSocket, SQLAlchemy 2.0 (Mapped[]), Pydantic v2, pytest + httpx + TestClient

**Design Doc:** `docs/superpowers/specs/2026-03-14-gateway-websocket-server-design.md`

**Key Codebase Patterns (MUST follow):**
- Router: `router = APIRouter()` (no prefix), prefix added in `main.py` via `app.include_router(..., prefix="/api/gateway")`
- DB dependency: `db = Depends(get_db)` in route handlers
- Auth: `from ..auth import verify_api_key, is_auth_enabled` with `get_auth_dependency()` pattern
- ORM: `from app.database import Base`, `Mapped[]` annotations, `mapped_column()`
- Pydantic: `model_config = {"from_attributes": True}`
- Tests: `from main import app`, `client = TestClient(app)`, `sys.path.insert(0, ...)` for backend dir
- Timestamps: use **Integer** (Unix epoch) for gateway tables, NOT string ISO format

---

## Chunk 1: Foundation (Schemas + ORM + DB Init)

### Task 1: Create Pydantic Schemas

**Files:**
- Create: `backend/app/models/gateway_schemas.py`

- [ ] **Step 1: Create gateway_schemas.py**

```python
# backend/app/models/gateway_schemas.py

from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional


class AgentType(str, Enum):
    CLI = "cli"
    CODEX = "codex"
    PI = "pi"
    ACP = "acp"
    VSCODE = "vscode"
    CURSOR = "cursor"
    INTELLIJ = "intellij"


class TaskPriority(str, Enum):
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class BridgeStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"


class TaskStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AdapterInfo(BaseModel):
    type: AgentType
    agent_name: str
    version: Optional[str] = None
    executable_path: Optional[str] = None


class BridgeInfo(BaseModel):
    bridge_id: str
    platform: str
    hostname: str
    os_version: Optional[str] = None
    node_version: Optional[str] = None
    bridge_version: Optional[str] = None
    status: BridgeStatus
    last_seen: int
    available_adapters: list[AdapterInfo]
    active_tasks: int
    max_concurrent: int
    created_at: Optional[int] = None
    updated_at: Optional[int] = None


class BridgeFilter(BaseModel):
    status: Optional[BridgeStatus] = None
    platform: Optional[str] = None
    min_active_tasks: Optional[int] = None


class TaskRequest(BaseModel):
    prompt: str
    project_path: str
    agent_type: AgentType = AgentType.CLI
    timeout: int = 300
    priority: TaskPriority = TaskPriority.NORMAL
    preferred_ide: Optional[str] = None
    callback_id: Optional[str] = None
    source: str  # 'http' | 'workflow' | 'openclaw'


class TaskInfo(BaseModel):
    task_id: str
    bridge_id: Optional[str] = None
    prompt: str
    project_path: str
    agent_type: AgentType
    timeout: int
    priority: TaskPriority
    preferred_ide: Optional[str] = None
    source: str
    callback_id: Optional[str] = None
    status: TaskStatus
    output: Optional[str] = None
    error: Optional[str] = None
    exit_code: Optional[int] = None
    changed_files: Optional[list[str]] = None
    duration: Optional[int] = None
    progress: int = 0
    submitted_at: int
    started_at: Optional[int] = None
    completed_at: Optional[int] = None

    model_config = {"from_attributes": True}


# --- HTTP Request/Response Models ---

class SubmitTaskRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    project_path: str = Field(..., min_length=1)
    agent_type: AgentType = AgentType.CLI
    timeout: int = Field(default=300, ge=10, le=3600)
    priority: TaskPriority = TaskPriority.NORMAL
    preferred_ide: Optional[str] = None
    callback_id: Optional[str] = None


class SubmitTaskResponse(BaseModel):
    success: bool
    task_id: Optional[str] = None
    bridge_id: Optional[str] = None
    message: str


class TaskStatusResponse(BaseModel):
    success: bool
    data: Optional[TaskInfo] = None


class TaskListResponse(BaseModel):
    success: bool
    data: list[TaskInfo]
    total: int
    limit: int
    offset: int


class BridgeListResponse(BaseModel):
    success: bool
    data: list[BridgeInfo]
```

- [ ] **Step 2: Verify import**

Run: `cd backend && python -c "from app.models.gateway_schemas import TaskStatus, BridgeStatus, SubmitTaskRequest; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd backend
git add app/models/gateway_schemas.py
git commit -m "feat(gateway): add Pydantic schemas for gateway module"
```

---

### Task 2: Create ORM Models

**Files:**
- Create: `backend/app/models/gateway.py`
- Test: `backend/tests/test_gateway_models.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_gateway_models.py

import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app.models.gateway import BridgeRecord, TaskRecord


@pytest.fixture(scope="function", autouse=True)
def setup_tables():
    """Create gateway tables for tests"""
    BridgeRecord.__table__.create(engine, checkfirst=True)
    TaskRecord.__table__.create(engine, checkfirst=True)
    yield
    TaskRecord.__table__.drop(engine, checkfirst=True)
    BridgeRecord.__table__.drop(engine, checkfirst=True)


def test_create_bridge_record():
    """Test BridgeRecord creation"""
    db = SessionLocal()
    try:
        record = BridgeRecord(
            bridge_id="bridge-001",
            platform="darwin",
            hostname="macbook-pro",
            status="online",
            last_seen=1000000,
            available_adapters=[{"type": "cli", "agent_name": "test"}],
            active_tasks=1,
            max_concurrent=3,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        assert record.id is not None
        assert record.bridge_id == "bridge-001"
        assert record.status == "online"
        assert record.active_tasks == 1
    finally:
        db.rollback()
        db.close()


def test_create_task_record():
    """Test TaskRecord creation with foreign key"""
    db = SessionLocal()
    try:
        # Create bridge first
        bridge = BridgeRecord(
            bridge_id="bridge-002",
            platform="linux",
            hostname="dev-server",
            status="online",
            last_seen=1000000,
            available_adapters=[],
            active_tasks=0,
            max_concurrent=3,
        )
        db.add(bridge)
        db.commit()
        db.refresh(bridge)

        # Create task
        task = TaskRecord(
            task_id="task_1000000_abc12345",
            bridge_id="bridge-002",
            prompt="Write tests",
            project_path="/tmp/project",
            agent_type="cli",
            timeout=300,
            priority="normal",
            source="http",
            status="pending",
            submitted_at=1000000,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        assert task.id is not None
        assert task.task_id == "task_1000000_abc12345"
        assert task.bridge_id == "bridge-002"
        assert task.status == "pending"
    finally:
        db.rollback()
        db.close()


def test_cascade_delete():
    """Test that deleting a bridge cascades to tasks"""
    db = SessionLocal()
    try:
        bridge = BridgeRecord(
            bridge_id="bridge-003",
            platform="win32",
            hostname="windows-pc",
            status="online",
            last_seen=1000000,
            available_adapters=[],
        )
        db.add(bridge)
        db.commit()
        db.refresh(bridge)

        task = TaskRecord(
            task_id="task_1000000_cascade01",
            bridge_id="bridge-003",
            prompt="test",
            project_path="/tmp",
            agent_type="cli",
            source="http",
            status="pending",
            submitted_at=1000000,
        )
        db.add(task)
        db.commit()

        # Delete bridge
        db.delete(bridge)
        db.commit()

        # Task should be deleted too
        from sqlalchemy import select
        result = db.execute(
            select(TaskRecord).where(TaskRecord.task_id == "task_1000000_cascade01")
        ).scalar_one_or_none()
        assert result is None
    finally:
        db.rollback()
        db.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_gateway_models.py -v`
Expected: FAIL (ModuleNotFoundError)

- [ ] **Step 3: Write ORM models**

```python
# backend/app/models/gateway.py

from sqlalchemy import String, Integer, ForeignKey, Index, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class BridgeRecord(Base):
    """Bridge 持久化记录"""
    __tablename__ = 'gateway_bridges'

    id: Mapped[int] = mapped_column(primary_key=True)
    bridge_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    os_version: Mapped[str | None] = mapped_column(String(100))
    node_version: Mapped[str | None] = mapped_column(String(50))
    bridge_version: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='offline', index=True)
    last_seen: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    available_adapters: Mapped[dict] = mapped_column(JSON, nullable=False)
    active_tasks: Mapped[int] = mapped_column(Integer, default=0)
    max_concurrent: Mapped[int] = mapped_column(Integer, default=3)
    created_at: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[int] = mapped_column(Integer, default=0)

    # 关系
    tasks: Mapped[list["TaskRecord"]] = relationship(
        'TaskRecord', back_populates='bridge', cascade='all, delete-orphan'
    )

    def __repr__(self):
        return f"<BridgeRecord bridge_id={self.bridge_id} status={self.status}>"


class TaskRecord(Base):
    """任务持久化记录"""
    __tablename__ = 'gateway_tasks'
    __table_args__ = (
        Index('idx_gateway_tasks_status', 'status'),
        Index('idx_gateway_tasks_bridge_id', 'bridge_id'),
        Index('idx_gateway_tasks_submitted_at', 'submitted_at'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    bridge_id: Mapped[str] = mapped_column(
        String(255), ForeignKey('gateway_bridges.bridge_id', ondelete='CASCADE'), nullable=False, index=True
    )

    # 任务内容
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    project_path: Mapped[str] = mapped_column(Text, nullable=False)
    agent_type: Mapped[str] = mapped_column(String(50), nullable=False)
    timeout: Mapped[int] = mapped_column(Integer, default=300)
    priority: Mapped[str] = mapped_column(String(20), default='normal')
    preferred_ide: Mapped[str | None] = mapped_column(String(50))

    # 任务来源
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    callback_id: Mapped[str | None] = mapped_column(String(255))

    # 任务状态
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='pending', index=True)
    output: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    exit_code: Mapped[int | None] = mapped_column(Integer)
    changed_files: Mapped[list | None] = mapped_column(JSON)
    duration: Mapped[int | None] = mapped_column(Integer)
    progress: Mapped[int] = mapped_column(Integer, default=0)

    # 时间戳 (Unix epoch)
    submitted_at: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[int | None] = mapped_column(Integer)
    completed_at: Mapped[int | None] = mapped_column(Integer)

    # 关系
    bridge: Mapped["BridgeRecord"] = relationship('BridgeRecord', back_populates='tasks')

    def __repr__(self):
        return f"<TaskRecord task_id={self.task_id} status={self.status}>"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_gateway_models.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
cd backend
git add app/models/gateway.py tests/test_gateway_models.py
git commit -m "feat(gateway): add ORM models for gateway_bridges and gateway_tasks"
```

---

### Task 3: Database Table Creation in Lifespan

**Files:**
- Modify: `backend/main.py` (add table creation in lifespan + router registration)

- [ ] **Step 1: Modify main.py lifespan to create gateway tables**

Add these imports at the top of `backend/main.py`:
```python
from app.models.gateway import BridgeRecord, TaskRecord
```

Add these lines in the lifespan startup section, after the heartbeat scheduler setup:
```python
    # Create gateway tables
    BridgeRecord.__table__.create(engine, checkfirst=True)
    TaskRecord.__table__.create(engine, checkfirst=True)
    print("Gateway tables created")
```

Also add `engine` import:
```python
from app.database import get_db, engine
```
(Note: `engine` is not currently imported in main.py; we need it for table creation.)

Add router registration:
```python
from app.routers import gateway as gateway_router
app.include_router(gateway_router.router, prefix="/api/gateway", tags=["gateway"])
```

- [ ] **Step 2: Verify server starts**

Run: `cd backend && timeout 5 python -m uvicorn main:app --port 8083 2>&1 || true`
Expected: No import errors, tables created message visible

- [ ] **Step 3: Commit**

```bash
cd backend
git add main.py
git commit -m "feat(gateway): register gateway router and create tables in lifespan"
```

---

## Chunk 2: Data Access Layer

### Task 4: GatewayDB Service

**Files:**
- Create: `backend/app/services/gateway/__init__.py`
- Create: `backend/app/services/gateway/db_gateway.py`
- Test: `backend/tests/test_gateway_db.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_gateway_db.py

import pytest
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine
from app.models.gateway import BridgeRecord, TaskRecord
from app.services.gateway.db_gateway import GatewayDB
from app.models.gateway_schemas import (
    BridgeInfo, BridgeFilter, BridgeStatus, TaskRequest,
    TaskStatus, AgentType, TaskPriority
)


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    """Create/drop tables per test"""
    BridgeRecord.__table__.create(engine, checkfirst=True)
    TaskRecord.__table__.create(engine, checkfirst=True)
    yield
    TaskRecord.__table__.drop(engine, checkfirst=True)
    BridgeRecord.__table__.drop(engine, checkfirst=True)


@pytest.fixture
def db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


@pytest.fixture
def gateway_db(db):
    return GatewayDB(db)


def _make_bridge_info(bridge_id="bridge-001", **kwargs):
    defaults = {
        "bridge_id": bridge_id,
        "platform": "darwin",
        "hostname": "macbook",
        "status": BridgeStatus.ONLINE,
        "last_seen": int(time.time()),
        "available_adapters": [],
        "active_tasks": 0,
        "max_concurrent": 3,
    }
    defaults.update(kwargs)
    return BridgeInfo(**defaults)


def test_create_bridge(gateway_db):
    """Test creating a new bridge"""
    info = _make_bridge_info()
    record = gateway_db.create_bridge(info)
    assert record.bridge_id == "bridge-001"
    assert record.status == "online"


def test_update_bridge(gateway_db):
    """Test updating an existing bridge"""
    info = _make_bridge_info()
    gateway_db.create_bridge(info)

    # Update with new status
    info.active_tasks = 2
    info.last_seen = info.last_seen + 100
    record = gateway_db.create_bridge(info)
    assert record.active_tasks == 2


def test_get_bridge(gateway_db):
    """Test retrieving a bridge"""
    info = _make_bridge_info()
    gateway_db.create_bridge(info)

    record = gateway_db.get_bridge("bridge-001")
    assert record is not None
    assert record.platform == "darwin"


def test_get_all_bridges(gateway_db):
    """Test listing all bridges"""
    for i in range(3):
        gateway_db.create_bridge(_make_bridge_info(f"bridge-{i}"))

    bridges = gateway_db.get_all_bridges()
    assert len(bridges) == 3


def test_get_all_bridges_with_filter(gateway_db):
    """Test filtering bridges"""
    gateway_db.create_bridge(_make_bridge_info("b1", platform="darwin"))
    gateway_db.create_bridge(_make_bridge_info("b2", platform="linux"))

    bridges = gateway_db.get_all_bridges(BridgeFilter(platform="linux"))
    assert len(bridges) == 1
    assert bridges[0].bridge_id == "b2"


def test_update_bridge_status(gateway_db):
    """Test updating bridge status"""
    gateway_db.create_bridge(_make_bridge_info())
    gateway_db.update_bridge_status("bridge-001", "offline")

    record = gateway_db.get_bridge("bridge-001")
    assert record.status == "offline"


def test_increment_active_tasks(gateway_db):
    """Test incrementing active tasks"""
    info = _make_bridge_info(max_concurrent=2)
    gateway_db.create_bridge(info)

    assert gateway_db.increment_active_tasks("bridge-001") is True
    assert gateway_db.increment_active_tasks("bridge-001") is True
    assert gateway_db.increment_active_tasks("bridge-001") is False  # full

    record = gateway_db.get_bridge("bridge-001")
    assert record.active_tasks == 2


def test_decrement_active_tasks(gateway_db):
    """Test decrementing active tasks"""
    info = _make_bridge_info(active_tasks=2)
    gateway_db.create_bridge(info)

    gateway_db.decrement_active_tasks("bridge-001")
    record = gateway_db.get_bridge("bridge-001")
    assert record.active_tasks == 1


def test_create_task(gateway_db):
    """Test creating a task"""
    gateway_db.create_bridge(_make_bridge_info())
    task = TaskRequest(
        prompt="test", project_path="/tmp", source="http"
    )
    record = gateway_db.create_task("task_001", task, "bridge-001")
    assert record.task_id == "task_001"
    assert record.status == "pending"


def test_get_task(gateway_db):
    """Test retrieving a task"""
    gateway_db.create_bridge(_make_bridge_info())
    task = TaskRequest(prompt="test", project_path="/tmp", source="http")
    gateway_db.create_task("task_001", task, "bridge-001")

    record = gateway_db.get_task("task_001")
    assert record is not None
    assert record.bridge_id == "bridge-001"


def test_update_task_status(gateway_db):
    """Test updating task status"""
    gateway_db.create_bridge(_make_bridge_info())
    task = TaskRequest(prompt="test", project_path="/tmp", source="http")
    gateway_db.create_task("task_001", task, "bridge-001")

    gateway_db.update_task_status("task_001", TaskStatus.RUNNING)
    record = gateway_db.get_task("task_001")
    assert record.status == "running"


def test_update_task_status_with_error(gateway_db):
    """Test updating task status with error message"""
    gateway_db.create_bridge(_make_bridge_info())
    task = TaskRequest(prompt="test", project_path="/tmp", source="http")
    gateway_db.create_task("task_001", task, "bridge-001")

    gateway_db.update_task_status("task_001", TaskStatus.FAILED, error="timeout")
    record = gateway_db.get_task("task_001")
    assert record.error == "timeout"


def test_list_tasks(gateway_db):
    """Test listing tasks with pagination"""
    gateway_db.create_bridge(_make_bridge_info())
    for i in range(5):
        task = TaskRequest(prompt=f"test {i}", project_path="/tmp", source="http")
        gateway_db.create_task(f"task_{i:03d}", task, "bridge-001")

    tasks, total = gateway_db.list_tasks(limit=2, offset=0)
    assert total == 5
    assert len(tasks) == 2


def test_list_tasks_with_filter(gateway_db):
    """Test filtering tasks by status"""
    gateway_db.create_bridge(_make_bridge_info())
    task = TaskRequest(prompt="test", project_path="/tmp", source="http")
    gateway_db.create_task("task_001", task, "bridge-001")

    gateway_db.update_task_status("task_001", TaskStatus.RUNNING)

    tasks, total = gateway_db.list_tasks(status=TaskStatus.RUNNING)
    assert total == 1
    assert tasks[0].task_id == "task_001"


def test_get_queued_tasks(gateway_db):
    """Test getting queued tasks for a bridge"""
    gateway_db.create_bridge(_make_bridge_info())
    task = TaskRequest(prompt="test", project_path="/tmp", source="http")
    gateway_db.create_task("task_001", task, "bridge-001")
    gateway_db.update_task_status("task_001", TaskStatus.QUEUED)

    queued = gateway_db.get_queued_tasks("bridge-001")
    assert len(queued) == 1
    assert queued[0].task_id == "task_001"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_gateway_db.py -v`
Expected: FAIL (ModuleNotFoundError)

- [ ] **Step 3: Create `__init__.py`**

```python
# backend/app/services/gateway/__init__.py
```

(empty file for now; singletons will be added in later tasks)

- [ ] **Step 4: Implement GatewayDB**

```python
# backend/app/services/gateway/db_gateway.py

import time
from typing import Optional

from sqlalchemy import select, func, desc, asc
from sqlalchemy.orm import Session

from app.models.gateway import BridgeRecord, TaskRecord
from app.models.gateway_schemas import (
    BridgeInfo, BridgeFilter, TaskRequest, TaskStatus
)


class GatewayDB:
    """Gateway 数据访问层"""

    def __init__(self, db: Session):
        self.db = db

    # ---- Bridge 操作 ----

    def create_bridge(self, bridge_info: BridgeInfo) -> BridgeRecord:
        """创建或更新 Bridge 记录（upsert）"""
        record = self.db.execute(
            select(BridgeRecord).where(BridgeRecord.bridge_id == bridge_info.bridge_id)
        ).scalar_one_or_none()

        now = int(time.time())

        if record:
            record.status = bridge_info.status.value
            record.last_seen = bridge_info.last_seen
            record.available_adapters = [a.model_dump() for a in bridge_info.available_adapters]
            record.active_tasks = bridge_info.active_tasks
            record.max_concurrent = bridge_info.max_concurrent
            record.updated_at = now
        else:
            record = BridgeRecord(
                bridge_id=bridge_info.bridge_id,
                platform=bridge_info.platform,
                hostname=bridge_info.hostname,
                os_version=bridge_info.os_version,
                node_version=bridge_info.node_version,
                bridge_version=bridge_info.bridge_version,
                status=bridge_info.status.value,
                last_seen=bridge_info.last_seen,
                available_adapters=[a.model_dump() for a in bridge_info.available_adapters],
                active_tasks=bridge_info.active_tasks,
                max_concurrent=bridge_info.max_concurrent,
                created_at=now,
                updated_at=now,
            )
            self.db.add(record)

        self.db.commit()
        self.db.refresh(record)
        return record

    def get_bridge(self, bridge_id: str) -> Optional[BridgeRecord]:
        """获取 Bridge 记录"""
        return self.db.execute(
            select(BridgeRecord).where(BridgeRecord.bridge_id == bridge_id)
        ).scalar_one_or_none()

    def get_all_bridges(self, filters: Optional[BridgeFilter] = None) -> list[BridgeRecord]:
        """获取所有 Bridge（支持筛选）"""
        query = select(BridgeRecord)
        if filters:
            if filters.status:
                query = query.where(BridgeRecord.status == filters.status.value)
            if filters.platform:
                query = query.where(BridgeRecord.platform == filters.platform)
            if filters.min_active_tasks is not None:
                query = query.where(BridgeRecord.active_tasks < filters.min_active_tasks)
        return list(self.db.execute(query).scalars().all())

    def update_bridge_status(self, bridge_id: str, status: str) -> None:
        """更新 Bridge 状态"""
        record = self.get_bridge(bridge_id)
        if record:
            record.status = status
            record.last_seen = int(time.time())
            record.updated_at = int(time.time())
            self.db.commit()

    def increment_active_tasks(self, bridge_id: str) -> bool:
        """增加活跃任务数，满载返回 False"""
        record = self.get_bridge(bridge_id)
        if not record:
            return False
        if record.active_tasks >= record.max_concurrent:
            return False
        record.active_tasks += 1
        self.db.commit()
        return True

    def decrement_active_tasks(self, bridge_id: str) -> None:
        """减少活跃任务数"""
        record = self.get_bridge(bridge_id)
        if record and record.active_tasks > 0:
            record.active_tasks -= 1
            self.db.commit()

    # ---- Task 操作 ----

    def create_task(self, task_id: str, task: TaskRequest, bridge_id: str) -> TaskRecord:
        """创建任务记录"""
        record = TaskRecord(
            task_id=task_id,
            bridge_id=bridge_id,
            prompt=task.prompt,
            project_path=task.project_path,
            agent_type=task.agent_type.value,
            timeout=task.timeout,
            priority=task.priority.value,
            preferred_ide=task.preferred_ide,
            source=task.source,
            callback_id=task.callback_id,
            status=TaskStatus.PENDING.value,
            submitted_at=int(time.time()),
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_task(self, task_id: str) -> Optional[TaskRecord]:
        """获取任务记录"""
        return self.db.execute(
            select(TaskRecord).where(TaskRecord.task_id == task_id)
        ).scalar_one_or_none()

    def update_task_status(self, task_id: str, status: TaskStatus, **kwargs) -> None:
        """更新任务状态及可选字段"""
        record = self.get_task(task_id)
        if record:
            record.status = status.value
            for key, value in kwargs.items():
                setattr(record, key, value)
            if status == TaskStatus.RUNNING and not record.started_at:
                record.started_at = int(time.time())
            if status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
                if not record.completed_at:
                    record.completed_at = int(time.time())
            self.db.commit()

    def list_tasks(
        self,
        status: Optional[TaskStatus] = None,
        bridge_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = "submitted_at",
        sort_order: str = "desc",
    ) -> tuple[list[TaskRecord], int]:
        """查询任务列表（筛选 + 分页）"""
        query = select(TaskRecord)
        if status:
            query = query.where(TaskRecord.status == status.value)
        if bridge_id:
            query = query.where(TaskRecord.bridge_id == bridge_id)

        order_col = getattr(TaskRecord, sort_by, TaskRecord.submitted_at)
        query = query.order_by(desc(order_col) if sort_order == "desc" else asc(order_col))

        # 总数
        count_query = select(func.count()).select_from(query.subquery())
        total = self.db.execute(count_query).scalar() or 0

        query = query.offset(offset).limit(limit)
        tasks = list(self.db.execute(query).scalars().all())
        return tasks, total

    def get_queued_tasks(self, bridge_id: str) -> list[TaskRecord]:
        """获取指定 Bridge 的 queued 任务（重连恢复用）"""
        return list(self.db.execute(
            select(TaskRecord).where(
                TaskRecord.bridge_id == bridge_id,
                TaskRecord.status == TaskStatus.QUEUED.value,
            )
        ).scalars().all())
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_gateway_db.py -v`
Expected: 15 passed

- [ ] **Step 6: Commit**

```bash
cd backend
git add app/services/gateway/__init__.py app/services/gateway/db_gateway.py tests/test_gateway_db.py
git commit -m "feat(gateway): add GatewayDB data access layer with tests"
```

---

## Chunk 3: Core Services (BridgeManager + TaskRouter)

### Task 5: BridgeManager

**Files:**
- Create: `backend/app/services/gateway/bridge_manager.py`
- Test: `backend/tests/test_gateway_manager.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_gateway_manager.py

import pytest
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.gateway_schemas import (
    BridgeInfo, BridgeStatus, AdapterInfo, AgentType, BridgeFilter
)
from app.services.gateway.bridge_manager import BridgeManager


def _make_bridge(bridge_id="bridge-001", status=BridgeStatus.ONLINE, active_tasks=0, **kwargs):
    defaults = {
        "bridge_id": bridge_id,
        "platform": "darwin",
        "hostname": "macbook",
        "status": status,
        "last_seen": int(time.time()),
        "available_adapters": [],
        "active_tasks": active_tasks,
        "max_concurrent": 3,
    }
    defaults.update(kwargs)
    return BridgeInfo(**defaults)


@pytest.fixture
def manager():
    return BridgeManager()


def test_register_bridge(manager):
    """Test bridge registration"""
    info = _make_bridge()
    manager.register_bridge(info)
    assert manager.get_bridge("bridge-001") is not None
    assert manager.get_bridge("bridge-001").status == BridgeStatus.ONLINE


def test_update_last_seen(manager):
    """Test updating last_seen"""
    info = _make_bridge()
    manager.register_bridge(info)
    old_seen = manager.get_bridge("bridge-001").last_seen
    time.sleep(0.01)
    manager.update_last_seen("bridge-001")
    assert manager.get_bridge("bridge-001").last_seen > old_seen


def test_set_bridge_offline(manager):
    """Test setting bridge offline"""
    info = _make_bridge()
    manager.register_bridge(info)
    manager.set_bridge_offline("bridge-001")
    assert manager.get_bridge("bridge-001").status == BridgeStatus.OFFLINE


def test_get_available_bridges(manager):
    """Test getting online bridges"""
    manager.register_bridge(_make_bridge("b1", status=BridgeStatus.ONLINE))
    manager.register_bridge(_make_bridge("b2", status=BridgeStatus.OFFLINE))
    available = manager.get_available_bridges()
    assert len(available) == 1
    assert available[0].bridge_id == "b1"


def test_get_available_bridges_with_filter(manager):
    """Test filtering available bridges"""
    manager.register_bridge(_make_bridge("b1", platform="darwin"))
    manager.register_bridge(_make_bridge("b2", platform="linux"))
    filtered = manager.get_available_bridges(BridgeFilter(platform="linux"))
    assert len(filtered) == 1
    assert filtered[0].bridge_id == "b2"


def test_increment_active_tasks(manager):
    """Test incrementing active task count"""
    info = _make_bridge(max_concurrent=2)
    manager.register_bridge(info)

    assert manager.increment_active_tasks("bridge-001") is True
    assert manager.increment_active_tasks("bridge-001") is True
    assert manager.increment_active_tasks("bridge-001") is False  # full
    assert manager.get_bridge("bridge-001").active_tasks == 2


def test_decrement_active_tasks(manager):
    """Test decrementing active task count"""
    info = _make_bridge(active_tasks=1)
    manager.register_bridge(info)
    manager.decrement_active_tasks("bridge-001")
    assert manager.get_bridge("bridge-001").active_tasks == 0


def test_get_all_bridges(manager):
    """Test getting all bridges"""
    manager.register_bridge(_make_bridge("b1"))
    manager.register_bridge(_make_bridge("b2"))
    all_bridges = manager.get_all_bridges()
    assert len(all_bridges) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_gateway_manager.py -v`
Expected: FAIL

- [ ] **Step 3: Implement BridgeManager**

```python
# backend/app/services/gateway/bridge_manager.py

import time
from typing import Optional

from app.models.gateway_schemas import BridgeInfo, BridgeFilter, BridgeStatus


class BridgeManager:
    """Bridge 状态管理器（内存缓存）"""

    def __init__(self):
        self._bridges: dict[str, BridgeInfo] = {}

    def register_bridge(self, bridge_info: BridgeInfo) -> None:
        """注册 Bridge"""
        self._bridges[bridge_info.bridge_id] = bridge_info

    def update_last_seen(self, bridge_id: str) -> None:
        """更新最后活跃时间"""
        bridge = self._bridges.get(bridge_id)
        if bridge:
            bridge.last_seen = int(time.time())

    def set_bridge_offline(self, bridge_id: str) -> None:
        """标记 Bridge 离线"""
        bridge = self._bridges.get(bridge_id)
        if bridge:
            bridge.status = BridgeStatus.OFFLINE
            bridge.last_seen = int(time.time())

    def get_bridge(self, bridge_id: str) -> Optional[BridgeInfo]:
        """获取 Bridge"""
        return self._bridges.get(bridge_id)

    def get_available_bridges(self, filters: Optional[BridgeFilter] = None) -> list[BridgeInfo]:
        """获取在线 Bridge（支持筛选）"""
        bridges = [b for b in self._bridges.values() if b.status == BridgeStatus.ONLINE]
        if filters:
            if filters.platform:
                bridges = [b for b in bridges if b.platform == filters.platform]
            if filters.min_active_tasks is not None:
                bridges = [b for b in bridges if b.active_tasks < filters.min_active_tasks]
        return bridges

    def get_all_bridges(self) -> list[BridgeInfo]:
        """获取所有 Bridge"""
        return list(self._bridges.values())

    def increment_active_tasks(self, bridge_id: str) -> bool:
        """增加活跃任务数，满载返回 False"""
        bridge = self._bridges.get(bridge_id)
        if not bridge:
            return False
        if bridge.active_tasks >= bridge.max_concurrent:
            return False
        bridge.active_tasks += 1
        return True

    def decrement_active_tasks(self, bridge_id: str) -> None:
        """减少活跃任务数"""
        bridge = self._bridges.get(bridge_id)
        if bridge and bridge.active_tasks > 0:
            bridge.active_tasks -= 1

    def clear(self):
        """清空缓存（测试用）"""
        self._bridges.clear()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_gateway_manager.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
cd backend
git add app/services/gateway/bridge_manager.py tests/test_gateway_manager.py
git commit -m "feat(gateway): add BridgeManager with in-memory state management"
```

---

### Task 6: TaskRouter

**Files:**
- Create: `backend/app/services/gateway/task_router.py`
- Test: `backend/tests/test_task_router.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_task_router.py

import pytest
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import AsyncMock, MagicMock, patch
from app.models.gateway_schemas import (
    BridgeInfo, BridgeStatus, AgentType, TaskPriority, TaskRequest, TaskStatus
)
from app.services.gateway.bridge_manager import BridgeManager
from app.services.gateway.task_router import TaskRouter, NoAvailableBridgeError
from app.database import SessionLocal, engine
from app.models.gateway import BridgeRecord, TaskRecord


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    BridgeRecord.__table__.create(engine, checkfirst=True)
    TaskRecord.__table__.create(engine, checkfirst=True)
    yield
    TaskRecord.__table__.drop(engine, checkfirst=True)
    BridgeRecord.__table__.drop(engine, checkfirst=True)


def _make_bridge(bridge_id="bridge-001", active_tasks=0, adapters=None, **kwargs):
    defaults = {
        "bridge_id": bridge_id,
        "platform": "darwin",
        "hostname": "macbook",
        "status": BridgeStatus.ONLINE,
        "last_seen": int(time.time()),
        "available_adapters": adapters or [],
        "active_tasks": active_tasks,
        "max_concurrent": 3,
    }
    defaults.update(kwargs)
    return BridgeInfo(**defaults)


@pytest.fixture
def router():
    bridge_manager = BridgeManager()
    ws_server = MagicMock()
    ws_server.send_message = AsyncMock(return_value=True)
    r = TaskRouter(bridge_manager, ws_server)
    yield r
    bridge_manager.clear()


def _make_task_request(**kwargs):
    defaults = {
        "prompt": "Write tests",
        "project_path": "/tmp/project",
        "agent_type": AgentType.CLI,
        "timeout": 300,
        "priority": TaskPriority.NORMAL,
        "source": "http",
    }
    defaults.update(kwargs)
    return TaskRequest(**defaults)


@pytest.mark.asyncio
async def test_select_bridge_lowest_load(router):
    """Test selecting bridge with lowest active tasks"""
    router.bridge_manager.register_bridge(_make_bridge("b1", active_tasks=2))
    router.bridge_manager.register_bridge(_make_bridge("b2", active_tasks=0))

    task = _make_task_request()
    bridge = await router.select_bridge(task)
    assert bridge is not None
    assert bridge.bridge_id == "b2"


@pytest.mark.asyncio
async def test_select_bridge_with_ide_preference(router):
    """Test IDE preference filtering"""
    from app.models.gateway_schemas import AdapterInfo
    cli_adapter = AdapterInfo(type=AgentType.CLI, agent_name="cli")
    vscode_adapter = AdapterInfo(type=AgentType.VSCODE, agent_name="vscode")

    router.bridge_manager.register_bridge(_make_bridge("b1", adapters=[vscode_adapter], active_tasks=0))
    router.bridge_manager.register_bridge(_make_bridge("b2", adapters=[cli_adapter], active_tasks=0))

    task = _make_task_request(preferred_ide="vscode")
    bridge = await router.select_bridge(task)
    assert bridge.bridge_id == "b1"


@pytest.mark.asyncio
async def test_select_bridge_ide_fallback(router):
    """Test IDE fallback when no match"""
    from app.models.gateway_schemas import AdapterInfo
    cli_adapter = AdapterInfo(type=AgentType.CLI, agent_name="cli")

    router.bridge_manager.register_bridge(_make_bridge("b1", adapters=[cli_adapter], active_tasks=0))

    task = _make_task_request(preferred_ide="cursor")
    bridge = await router.select_bridge(task)
    # Should fallback to any available bridge
    assert bridge is not None
    assert bridge.bridge_id == "b1"


@pytest.mark.asyncio
async def test_select_bridge_no_available(router):
    """Test no bridge available"""
    task = _make_task_request()
    bridge = await router.select_bridge(task)
    assert bridge is None


@pytest.mark.asyncio
async def test_submit_task(router):
    """Test submitting a task"""
    db = SessionLocal()
    try:
        from app.services.gateway.db_gateway import GatewayDB
        router.db_gateway = GatewayDB(db)

        bridge = _make_bridge()
        router.bridge_manager.register_bridge(bridge)

        task = _make_task_request()
        task_id = await router.submit_task(task, gateway_db)

        assert task_id.startswith("task_")
        record = gateway_db.get_task(task_id)
        assert record is not None
        assert record.status == "pending"
    finally:
        db.rollback()
        db.close()


@pytest.mark.asyncio
async def test_submit_task_no_bridge(router):
    """Test submitting when no bridge available"""
    db = SessionLocal()
    try:
        from app.services.gateway.db_gateway import GatewayDB
        gateway_db = GatewayDB(db)

        task = _make_task_request()
        with pytest.raises(NoAvailableBridgeError):
            await router.submit_task(task, gateway_db)
    finally:
        db.rollback()
        db.close()


@pytest.mark.asyncio
async def test_cancel_task(router):
    """Test cancelling a task"""
    db = SessionLocal()
    try:
        from app.services.gateway.db_gateway import GatewayDB
        gateway_db = GatewayDB(db)

        bridge = _make_bridge()
        router.bridge_manager.register_bridge(bridge)

        task = _make_task_request()
        task_id = await router.submit_task(task, gateway_db)
        gateway_db.update_task_status(task_id, TaskStatus.RUNNING)

        await router.cancel_task(task_id, "user_request", gateway_db)
        record = gateway_db.get_task(task_id)
        assert record.status == "cancelled"
    finally:
        db.rollback()
        db.close()


def test_generate_task_id(router):
    """Test task ID format"""
    task_id = router._generate_task_id()
    assert task_id.startswith("task_")
    parts = task_id.split("_")
    assert len(parts) == 3  # task_<timestamp><short_uuid>
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_task_router.py -v`
Expected: FAIL

- [ ] **Step 3: Implement TaskRouter**

```python
# backend/app/services/gateway/task_router.py

import asyncio
import time
import uuid

from app.models.gateway_schemas import (
    BridgeInfo, TaskRequest, TaskStatus, BridgeStatus
)


class NoAvailableBridgeError(Exception):
    """没有可用的 Bridge"""
    pass


class TaskRouter:
    """任务路由器"""

    def __init__(self, bridge_manager, ws_server):
        self.bridge_manager = bridge_manager
        self.ws_server = ws_server

    async def select_bridge(self, task: TaskRequest) -> BridgeInfo | None:
        """选择 Bridge：IDE 偏好优先，负载最低"""
        candidates = self.bridge_manager.get_available_bridges()
        if not candidates:
            return None

        # Step 1: 按 IDE 偏好筛选
        if task.preferred_ide:
            ide_matches = [
                b for b in candidates
                if task.preferred_ide in [a.type for a in b.available_adapters]
            ]
            if ide_matches:
                candidates = ide_matches

        # Step 2: 按 active_tasks 排序，取最少
        return min(candidates, key=lambda b: b.active_tasks)

    async def submit_task(self, task: TaskRequest, db_gateway) -> str:
        """提交任务，返回 task_id"""
        bridge = await self.select_bridge(task)
        if not bridge:
            raise NoAvailableBridgeError("No available bridge for this task")

        task_id = self._generate_task_id()

        # 创建任务记录
        db_gateway.create_task(task_id, task, bridge.bridge_id)

        # 发送到 Bridge
        try:
            await self.ws_server.send_message(bridge.bridge_id, {
                'type': 'task.submit',
                'taskId': task_id,
                'prompt': task.prompt,
                'projectPath': task.project_path,
                'agentType': task.agent_type.value,
                'timeout': task.timeout,
                'priority': task.priority.value,
                'preferredIde': task.preferred_ide,
            })
        except Exception as e:
            db_gateway.update_task_status(task_id, TaskStatus.FAILED, error=str(e))
            self.bridge_manager.decrement_active_tasks(bridge.bridge_id)
            raise

        # 更新负载计数
        self.bridge_manager.increment_active_tasks(bridge.bridge_id)

        # 启动 ack 超时检测
        self._schedule_ack_timeout(task_id, bridge.bridge_id, db_gateway, timeout=5)

        return task_id

    async def cancel_task(self, task_id: str, reason: str, db_gateway) -> None:
        """取消任务"""
        task = db_gateway.get_task(task_id)
        if not task:
            return

        # 发送取消消息
        await self.ws_server.send_message(task.bridge_id, {
            'type': 'task.cancel',
            'taskId': task_id,
            'reason': reason,
        })
        db_gateway.update_task_status(task_id, TaskStatus.CANCELLED)

    def get_task_bridge(self, task_id: str, db_gateway) -> BridgeInfo | None:
        """获取任务关联的 Bridge"""
        task = db_gateway.get_task(task_id)
        if not task:
            return None
        return self.bridge_manager.get_bridge(task.bridge_id)

    def _generate_task_id(self) -> str:
        """生成任务 ID: task_{timestamp}_{short_uuid}"""
        timestamp = int(time.time())
        short_uuid = uuid.uuid4().hex[:8]
        return f"task_{timestamp}_{short_uuid}"

    def _schedule_ack_timeout(self, task_id: str, bridge_id: str, db_gateway, timeout: int = 5):
        """安排 ack 超时处理"""
        async def check_ack():
            await asyncio.sleep(timeout)
            task = db_gateway.get_task(task_id)
                if task and task.status == TaskStatus.PENDING.value:
                    db_gateway.update_task_status(task_id, TaskStatus.QUEUED)
                    self.bridge_manager.decrement_active_tasks(bridge_id)

        asyncio.create_task(check_ack())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_task_router.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
cd backend
git add app/services/gateway/task_router.py tests/test_task_router.py
git commit -m "feat(gateway): add TaskRouter with load-balanced bridge selection"
```

---

## Chunk 4: WebSocket Server + HTTP Router

### Task 7: WSServer

**Files:**
- Create: `backend/app/services/gateway/ws_server.py`

- [ ] **Step 1: Implement WSServer**

```python
# backend/app/services/gateway/ws_server.py

import logging
from typing import Callable, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WSServer:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self._handlers: dict[str, Callable] = {}
        self._message_handlers: dict[str, Callable] = {}  # external handlers

    def register_message_handler(self, msg_type: str, handler: Callable) -> None:
        """注册外部消息处理器"""
        self._message_handlers[msg_type] = handler

    async def connect(self, bridge_id: str, websocket: WebSocket) -> None:
        """注册 Bridge WebSocket 连接"""
        self.active_connections[bridge_id] = websocket
        logger.info(f"Bridge connected: {bridge_id}")

    async def disconnect(self, bridge_id: str) -> None:
        """断开 Bridge WebSocket 连接"""
        conn = self.active_connections.pop(bridge_id, None)
        if conn:
            logger.info(f"Bridge disconnected: {bridge_id}")

    async def send_message(self, bridge_id: str, message: dict) -> bool:
        """发送消息到 Bridge"""
        conn = self.active_connections.get(bridge_id)
        if not conn:
            return False
        try:
            await conn.send_json(message)
            return True
        except Exception as e:
            logger.warning(f"Failed to send to {bridge_id}: {e}")
            self.active_connections.pop(bridge_id, None)
            return False

    async def send_message_with_retry(self, bridge_id: str, message: dict, max_retries: int = 3) -> bool:
        """发送消息到 Bridge（带重试）"""
        for attempt in range(max_retries):
            if await self.send_message(bridge_id, message):
                return True
            if attempt < max_retries - 1:
                import asyncio
                await asyncio.sleep(0.1 * (attempt + 1))
        return False

    async def broadcast(self, message: dict) -> None:
        """广播消息到所有连接"""
        for bridge_id in list(self.active_connections.keys()):
            await self.send_message(bridge_id, message)

    async def handle_message(self, bridge_id: str, message: dict) -> None:
        """分发消息到对应处理器"""
        msg_type = message.get('type', '')
        handler = self._message_handlers.get(msg_type)
        if handler:
            await handler(bridge_id, message)
        else:
            logger.warning(f"No handler for message type: {msg_type}")

    def clear(self):
        """清空连接（测试用）"""
        self.active_connections.clear()
```

- [ ] **Step 2: Commit**

```bash
cd backend
git add app/services/gateway/ws_server.py
git commit -m "feat(gateway): add WSServer connection manager"
```

---

### Task 8: Module-Level Singletons

**Files:**
- Modify: `backend/app/services/gateway/__init__.py`

- [ ] **Step 1: Export singletons from `__init__.py`**

```python
# backend/app/services/gateway/__init__.py

from .ws_server import WSServer
from .bridge_manager import BridgeManager
from .task_router import TaskRouter

# Module-level singletons
ws_server = WSServer()
bridge_manager = BridgeManager()
task_router = TaskRouter(bridge_manager, ws_server)
```

- [ ] **Step 2: Commit**

```bash
cd backend
git add app/services/gateway/__init__.py
git commit -m "feat(gateway): export module-level singletons"
```

---

### Task 9: HTTP Router + WebSocket Endpoint

**Files:**
- Create: `backend/app/routers/gateway.py`
- Test: `backend/tests/test_gateway_router.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_gateway_router.py

import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_list_bridges_empty():
    """Test listing bridges when none exist"""
    response = client.get("/api/gateway/bridges")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"] == []


def test_list_tasks_empty():
    """Test listing tasks when none exist"""
    response = client.get("/api/gateway/tasks")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"] == []
    assert data["total"] == 0


def test_get_task_not_found():
    """Test getting a non-existent task"""
    response = client.get("/api/gateway/tasks/nonexistent")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False


def test_submit_task_no_bridge():
    """Test submitting task with no bridge available"""
    response = client.post("/api/gateway/tasks", json={
        "prompt": "Write tests",
        "project_path": "/tmp/project",
    })
    assert response.status_code == 400
    data = response.json()
    assert "No available bridge" in data.get("detail", data.get("error", {}).get("message", ""))


def test_cancel_task_not_found():
    """Test cancelling non-existent task"""
    response = client.post("/api/gateway/tasks/nonexistent/cancel")
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_disconnect_bridge_not_found():
    """Test force disconnecting non-existent bridge"""
    response = client.post("/api/gateway/bridges/nonexistent/disconnect")
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_list_tasks_pagination():
    """Test task list pagination parameters"""
    response = client.get("/api/gateway/tasks?limit=5&offset=0&sort_by=submitted_at&sort_order=desc")
    assert response.status_code == 200
    data = response.json()
    assert data["limit"] == 5
    assert data["offset"] == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_gateway_router.py -v`
Expected: FAIL (404 because router not registered yet, or import error)

- [ ] **Step 3: Implement router**

```python
# backend/app/routers/gateway.py

import logging
import time
import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import JSONResponse

from ..database import get_db
from ..auth import verify_api_key, is_auth_enabled
from ..models.gateway_schemas import (
    SubmitTaskRequest, SubmitTaskResponse, TaskStatusResponse,
    TaskListResponse, BridgeListResponse, TaskRequest, TaskStatus,
    BridgeInfo, AgentType, TaskPriority, TaskInfo
)
from ..services.gateway import ws_server, bridge_manager, task_router
from ..services.gateway.db_gateway import GatewayDB
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter()


def get_auth_dependency():
    """Return auth dependency based on environment"""
    if is_auth_enabled():
        return Depends(verify_api_key)
    return Depends(lambda: None)


# ============ HTTP API ============

@router.post("/tasks", response_model=SubmitTaskResponse)
async def submit_task(
    request: SubmitTaskRequest,
    source: str = Query(default="http"),
    _auth=Depends(get_auth_dependency()),
    db: Session = Depends(get_db),
):
    """提交任务到 Gateway"""
    from app.services.gateway.db_gateway import GatewayDB

    task = TaskRequest(
        prompt=request.prompt,
        project_path=request.project_path,
        agent_type=request.agent_type,
        timeout=request.timeout,
        priority=request.priority,
        preferred_ide=request.preferred_ide,
        callback_id=request.callback_id,
        source=source,
    )

    # Set db for this request
    gateway_db = GatewayDB(db)

    task_id = await task_router.submit_task(task, gateway_db)
    bridge = task_router.get_task_bridge(task_id, gateway_db)

    return SubmitTaskResponse(
        success=True,
        task_id=task_id,
        bridge_id=bridge.bridge_id if bridge else None,
        message="Task submitted successfully",
    )


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    _auth=Depends(get_auth_dependency()),
    db: Session = Depends(get_db),
):
    """查询任务状态"""
    gateway_db = GatewayDB(db)
    record = gateway_db.get_task(task_id)
    if not record:
        return TaskStatusResponse(success=False, data=None)
    return TaskStatusResponse(
        success=True,
        data=TaskInfo(
            task_id=record.task_id,
            bridge_id=record.bridge_id,
            prompt=record.prompt,
            project_path=record.project_path,
            agent_type=record.agent_type,
            timeout=record.timeout,
            priority=record.priority,
            preferred_ide=record.preferred_ide,
            source=record.source,
            callback_id=record.callback_id,
            status=record.status,
            output=record.output,
            error=record.error,
            exit_code=record.exit_code,
            changed_files=record.changed_files,
            duration=record.duration,
            progress=record.progress,
            submitted_at=record.submitted_at,
            started_at=record.started_at,
            completed_at=record.completed_at,
        ),
    )


@router.get("/tasks", response_model=TaskListResponse)
async def list_tasks(
    status: str | None = None,
    bridge_id: str | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    sort_by: str = Query(default="submitted_at", pattern="^(submitted_at|completed_at|status)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    _auth=Depends(get_auth_dependency()),
    db: Session = Depends(get_db),
):
    """查询任务列表"""
    gateway_db = GatewayDB(db)
    task_status = TaskStatus(status) if status else None

    tasks, total = gateway_db.list_tasks(
        status=task_status,
        bridge_id=bridge_id,
        limit=limit,
        offset=offset,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    data = [
        TaskInfo(
            task_id=t.task_id,
            bridge_id=t.bridge_id,
            prompt=t.prompt,
            project_path=t.project_path,
            agent_type=t.agent_type,
            timeout=t.timeout,
            priority=t.priority,
            preferred_ide=t.preferred_ide,
            source=t.source,
            callback_id=t.callback_id,
            status=t.status,
            output=t.output,
            error=t.error,
            exit_code=t.exit_code,
            changed_files=t.changed_files,
            duration=t.duration,
            progress=t.progress,
            submitted_at=t.submitted_at,
            started_at=t.started_at,
            completed_at=t.completed_at,
        )
        for t in tasks
    ]
    return TaskListResponse(success=True, data=data, total=total, limit=limit, offset=offset)


@router.get("/bridges", response_model=BridgeListResponse)
async def list_bridges(
    _auth=Depends(get_auth_dependency()),
):
    """列出所有 Bridge"""
    bridges = bridge_manager.get_all_bridges()
    return BridgeListResponse(success=True, data=bridges)


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    reason: str = Query(default="user_request"),
    _auth=Depends(get_auth_dependency()),
    db: Session = Depends(get_db),
):
    """取消任务"""
    gateway_db = GatewayDB(db)
    await task_router.cancel_task(task_id, reason, gateway_db)
    return {"success": True, "message": "Task cancelled"}


@router.post("/bridges/{bridge_id}/disconnect")
async def force_disconnect_bridge(
    bridge_id: str,
    _auth=Depends(get_auth_dependency()),
):
    """强制断开指定 Bridge"""
    await ws_server.disconnect(bridge_id)
    bridge_manager.set_bridge_offline(bridge_id)
    return {"success": True}


# ============ WebSocket Endpoint ============

@router.websocket("/ws")
async def gateway_ws(
    websocket: WebSocket,
    token: str = Query(..., description="API Key for authentication"),
):
    """Gateway WebSocket 连接端点"""

    # 握手阶段鉴权
    from app.auth import API_KEYS
    if token not in API_KEYS:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()

    bridge_id = None
    heartbeat_task = None
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "bridge.register":
                bridge_id = data["bridgeId"]
                await ws_server.connect(bridge_id, websocket)

                # Persist bridge info
                from app.database import SessionLocal
                from app.services.gateway.db_gateway import GatewayDB
                from app.models.gateway_schemas import BridgeInfo, BridgeStatus, AdapterInfo
                db = SessionLocal()
                try:
                    gateway_db = GatewayDB(db)
                    adapters = [AdapterInfo(**a) for a in data.get("availableAdapters", [])]
                    bridge_info = BridgeInfo(
                        bridge_id=bridge_id,
                        platform=data.get("platform", "unknown"),
                        hostname=data.get("hostname", "unknown"),
                        os_version=data.get("osVersion"),
                        node_version=data.get("nodeVersion"),
                        bridge_version=data.get("bridgeVersion"),
                        status=BridgeStatus.ONLINE,
                        last_seen=int(time.time()),
                        available_adapters=adapters,
                        active_tasks=0,
                        max_concurrent=data.get("maxConcurrent", 3),
                    )
                    gateway_db.create_bridge(bridge_info)
                    bridge_manager.register_bridge(bridge_info)

                    # Return resumed tasks if any
                    queued_tasks = gateway_db.get_queued_tasks(bridge_id)
                    resumed_tasks = [
                        {"taskId": t.task_id, "prompt": t.prompt, "projectPath": t.project_path}
                        for t in queued_tasks
                    ]
                    await websocket.send_json({
                        "type": "bridge.registered",
                        "bridgeId": bridge_id,
                        "resumedTasks": resumed_tasks,
                    })

                    # Register message handlers
                    ws_server.register_message_handler("task.ack", handle_task_ack)
                    ws_server.register_message_handler("task.progress", handle_task_progress)
                    ws_server.register_message_handler("task.complete", handle_task_complete)
                finally:
                    db.close()

                # Start heartbeat checker
                heartbeat_task = asyncio.create_task(_heartbeat_checker(websocket, bridge_id))

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                if bridge_id:
                    bridge_manager.update_last_seen(bridge_id)

            elif bridge_id:
                await ws_server.handle_message(bridge_id, data)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {bridge_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=4000, reason="Internal error")
    finally:
        if bridge_id:
            await ws_server.disconnect(bridge_id)
            bridge_manager.set_bridge_offline(bridge_id)
        if heartbeat_task:
            heartbeat_task.cancel()


async def _heartbeat_checker(websocket: WebSocket, bridge_id: str, interval: int = 30):
    """心跳检测 - 防止静默断开"""
    while True:
        await asyncio.sleep(interval)
        try:
            await websocket.send_json({"type": "ping"})
        except Exception:
            await ws_server.disconnect(bridge_id)
            bridge_manager.set_bridge_offline(bridge_id)
            break


# ============ WebSocket Message Handlers ============

async def handle_task_ack(bridge_id: str, data: dict):
    """处理 task.ack 消息"""
    from app.database import SessionLocal
    from app.services.gateway.db_gateway import GatewayDB
    from app.models.gateway_schemas import TaskStatus

    task_id = data.get("taskId")
    db = SessionLocal()
    try:
        gateway_db = GatewayDB(db)
        gateway_db.update_task_status(task_id, TaskStatus.RUNNING)
    finally:
        db.close()


async def handle_task_progress(bridge_id: str, data: dict):
    """处理 task.progress 消息"""
    from app.database import SessionLocal
    from app.services.gateway.db_gateway import GatewayDB
    from app.models.gateway_schemas import TaskStatus

    task_id = data.get("taskId")
    progress = data.get("progress", 0)
    db = SessionLocal()
    try:
        gateway_db = GatewayDB(db)
        gateway_db.update_task_status(task_id, TaskStatus.RUNNING, progress=progress)
    finally:
        db.close()


async def handle_task_complete(bridge_id: str, data: dict):
    """处理 task.complete 消息"""
    from app.database import SessionLocal
    from app.services.gateway.db_gateway import GatewayDB
    from app.models.gateway_schemas import TaskStatus

    task_id = data.get("taskId")
    success = data.get("success", False)
    db = SessionLocal()
    try:
        gateway_db = GatewayDB(db)
        if success:
            gateway_db.update_task_status(
                task_id, TaskStatus.COMPLETED,
                output=data.get("output"),
                exit_code=data.get("exitCode", 0),
                changed_files=data.get("changedFiles"),
            )
        else:
            gateway_db.update_task_status(
                task_id, TaskStatus.FAILED,
                error=data.get("error", "Unknown error"),
            )
        bridge_manager.decrement_active_tasks(bridge_id)
    finally:
        db.close()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_gateway_router.py -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
cd backend
git add app/routers/gateway.py tests/test_gateway_router.py
git commit -m "feat(gateway): add HTTP router and WebSocket endpoint"
```

---

## Chunk 5: Integration (Error Handling + Main.py + Integration Tests)

### Task 10: Error Handling

**Files:**
- Modify: `backend/app/main.py` (add exception handler)

- [ ] **Step 1: Add exception handler to main.py**

Add in `backend/main.py` after router registrations:

```python
from app.services.gateway.task_router import NoAvailableBridgeError

@app.exception_handler(NoAvailableBridgeError)
async def no_bridge_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": {"code": "GATEWAY_202", "message": str(exc)}
        }
    )
```

Also add `from fastapi.responses import JSONResponse` import if not already present.

- [ ] **Step 2: Verify error handling works**

Run: `cd backend && python -m pytest tests/test_gateway_router.py::test_submit_task_no_bridge -v`
Expected: PASS (returns 400 with error message)

- [ ] **Step 3: Commit**

```bash
cd backend
git add main.py
git commit -m "feat(gateway): add NoAvailableBridgeError exception handler"
```

---

### Task 11: Full Integration Test

**Files:**
- Test: `backend/tests/test_gateway_integration.py`

- [ ] **Step 1: Write integration tests**

```python
# backend/tests/test_gateway_integration.py

import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from app.services.gateway import ws_server, bridge_manager, task_router

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_gateway_state():
    """Reset gateway singletons between tests"""
    ws_server.clear()
    bridge_manager.clear()
    yield
    ws_server.clear()
    bridge_manager.clear()


def test_health_check():
    """Verify server is running"""
    response = client.get("/health")
    assert response.status_code == 200


def test_gateway_bridges_endpoint():
    """Test /api/gateway/bridges returns correct structure"""
    response = client.get("/api/gateway/bridges")
    assert response.status_code == 200
    assert "success" in response.json()
    assert "data" in response.json()


def test_gateway_tasks_endpoint():
    """Test /api/gateway/tasks returns correct structure"""
    response = client.get("/api/gateway/tasks")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "data" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data


def test_gateway_task_status_not_found():
    """Test /api/gateway/tasks/{id} for non-existent task"""
    response = client.get("/api/gateway/tasks/nonexistent_task")
    assert response.status_code == 200
    assert response.json()["success"] is False


def test_gateway_cancel_nonexistent_task():
    """Test cancelling non-existent task doesn't error"""
    response = client.post("/api/gateway/tasks/nonexistent_task/cancel")
    assert response.status_code == 200


def test_gateway_disconnect_nonexistent_bridge():
    """Test disconnecting non-existent bridge doesn't error"""
    response = client.post("/api/gateway/bridges/nonexistent/disconnect")
    assert response.status_code == 200


def test_gateway_tasks_with_sort_params():
    """Test task list with various sort parameters"""
    for sort_by in ["submitted_at", "completed_at", "status"]:
        for sort_order in ["asc", "desc"]:
            response = client.get(
                f"/api/gateway/tasks?sort_by={sort_by}&sort_order={sort_order}"
            )
            assert response.status_code == 200


def test_gateway_tasks_pagination():
    """Test task list pagination"""
    response = client.get("/api/gateway/tasks?limit=5&offset=10")
    assert response.status_code == 200
    data = response.json()
    assert data["limit"] == 5
    assert data["offset"] == 10


def test_gateway_submit_validation():
    """Test submit task input validation"""
    # Missing prompt
    response = client.post("/api/gateway/tasks", json={
        "project_path": "/tmp/project",
    })
    assert response.status_code == 422

    # Missing project_path
    response = client.post("/api/gateway/tasks", json={
        "prompt": "test",
    })
    assert response.status_code == 422

    # Invalid timeout
    response = client.post("/api/gateway/tasks", json={
        "prompt": "test",
        "project_path": "/tmp/project",
        "timeout": 0,
    })
    assert response.status_code == 422
```

- [ ] **Step 2: Run integration tests**

Run: `cd backend && python -m pytest tests/test_gateway_integration.py -v`
Expected: 9 passed

- [ ] **Step 3: Run ALL tests to ensure no regressions**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All existing tests + new gateway tests pass

- [ ] **Step 4: Commit**

```bash
cd backend
git add tests/test_gateway_integration.py
git commit -m "test(gateway): add integration tests for gateway module"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd backend && python -m pytest tests/ -v --tb=short`
Expected: All tests pass

- [ ] **Step 2: Verify no native SQL in gateway code**

Run: `grep -rn "cursor.execute\|sqlite3.connect\|_get_connection" backend/app/services/gateway/ backend/app/routers/gateway.py`
Expected: No matches

- [ ] **Step 3: Verify server starts cleanly**

Run: `cd backend && timeout 5 python -m uvicorn main:app --port 8083 2>&1 || true`
Expected: No import errors, all tables created

- [ ] **Step 4: Commit final state (if any cleanup needed)**

```bash
cd backend
git add -A
git diff --cached --stat  # verify what's being committed
# Only commit if there are actual changes
```

---

## Summary

| File | Action | Purpose |
|------|--------|---------|
| `app/models/gateway_schemas.py` | Create | Pydantic enums + schemas |
| `app/models/gateway.py` | Create | BridgeRecord + TaskRecord ORM |
| `app/services/gateway/__init__.py` | Create | Module-level singletons |
| `app/services/gateway/db_gateway.py` | Create | GatewayDB data access |
| `app/services/gateway/bridge_manager.py` | Create | Bridge state management |
| `app/services/gateway/task_router.py` | Create | Task routing + ack timeout |
| `app/services/gateway/ws_server.py` | Create | WebSocket connection manager |
| `app/routers/gateway.py` | Create | HTTP API + WebSocket endpoint |
| `main.py` | Modify | Router registration + table creation + error handler |
| `tests/test_gateway_models.py` | Create | ORM model tests (3 tests) |
| `tests/test_gateway_db.py` | Create | GatewayDB tests (16 tests) |
| `tests/test_gateway_manager.py` | Create | BridgeManager tests (8 tests) |
| `tests/test_task_router.py` | Create | TaskRouter tests (8 tests) |
| `tests/test_gateway_router.py` | Create | HTTP endpoint tests (7 tests) |
| `tests/test_gateway_integration.py` | Create | Integration tests (9 tests) |

**Total: 51 new tests across 6 test files**
