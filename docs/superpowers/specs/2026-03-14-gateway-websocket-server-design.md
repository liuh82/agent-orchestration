# Gateway WebSocket Server 设计文档

> 日期：2026-03-14
> 版本：v1.0
> 状态：待评审
> 目标：集成到现有 FastAPI 后端的 WebSocket Gateway 服务

---

## 一、设计概述

### 1.1 目标

创建一个集成到现有 FastAPI 后端 (`agent-orchestration`) 的 WebSocket Gateway 服务，实现：

1. **多 Bridge 管理** - 接收和管理多个 Remote Agent Bridge 的 WebSocket 连接
2. **任务路由** - 根据负载和 IDE 偏好选择最佳 Bridge 执行任务
3. **双入口任务提交** - 支持 HTTP API（外部调用）和内部调用（编排系统）
4. **任务状态追踪** - 完整的任务生命周期管理和状态同步

### 1.2 技术选型

| 组件 | 技术 |
|--------|------|
| WebSocket 服务器 | FastAPI WebSocket (`/api/gateway/ws`) |
| 端口 | `:8083`（与 REST API 共用 uvicorn） |
| 数据库 | SQLite (扩展现有) |
| ORM | SQLAlchemy 2.0 (Mapped[] 注解风格) |
| 认证 | 复用现有 API Key (dev-api-key) |

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FastAPI + uvicorn (:8083)                          │
│                                                                     │
│  REST API:     /api/v1/agents, /api/v1/tasks, ...                 │
│  WebSocket:    /api/gateway/ws                                          │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │           Gateway WebSocket Server (新增)                  │      │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │      │
│  │  │ WSServer    │  │BridgeManager │  │TaskRouter   │ │      │
│  │  │ (/api/gateway/ws)│  │             │  │             │ │      │
│  │  └─────────────┘  └──────────────┘  └─────────────┘ │      │
│  └────────────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │  SQLite 数据库 (扩展现有)                               │      │
│  │  gateway_bridges 表 (新增)                               │      │
│  │  gateway_tasks 表 (新增)                                │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Nginx (:443)
                              │ /api/gateway/ws → ws://localhost:8083/api/gateway/ws
```

---

## 三、核心组件设计

### 3.1 WSServer (WebSocket 服务器)

负责处理 WebSocket 连接的生命周期和消息收发：

```python
class WSServer:
    """WebSocket 连接管理器"""

    # 连接管理
    active_connections: Dict[str, WebSocket]  # bridgeId -> WebSocket
    _handlers: Dict[str, Callable]  # 消息类型 -> 处理函数映射

    def __init__(self):
        """初始化消息处理器映射"""
        self._handlers = {
            'auth.request': self.handle_auth_request,
            'bridge.register': self.handle_bridge_register,
            'task.progress': self.handle_task_progress,
            'task.complete': self.handle_task_complete,
            'task.ack': self.handle_task_ack,
            'ping': self.handle_ping,
        }

    # 连接管理
    async def connect(self, websocket: WebSocket, bridge_id: str) -> None
    async def disconnect(self, bridge_id: str) -> None
    async def send_message(self, bridge_id: str, message: dict) -> bool
    async def send_message_with_retry(self, bridge_id: str, message: dict, max_retries: int = 3) -> bool
    async def broadcast(self, message: dict) -> None

    async def handle_message(self, bridge_id: str, message: dict) -> None:
        """分发消息到对应处理器"""
        msg_type = message.get('type')
        handler = self._handlers.get(msg_type)
        if handler:
            await handler(bridge_id, message)

    async def handle_auth_request(self, bridge_id: str, data: dict) -> None
    async def handle_bridge_register(self, bridge_id: str, data: dict) -> None
    async def handle_task_progress(self, bridge_id: str, data: dict) -> None
    async def handle_task_complete(self, bridge_id: str, data: dict) -> None
    async def handle_task_ack(self, bridge_id: str, data: dict) -> None
    async def handle_ping(self, bridge_id: str, data: dict) -> None

    async def register(self, bridge_id: str, websocket: WebSocket) -> None:
        """注册 Bridge 连接"""
        self.active_connections[bridge_id] = websocket
```

### 3.2 BridgeManager (Bridge 状态管理)

```python
# ORM 模型（持久化）
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
    created_at: Mapped[int] = mapped_column(server_default=text("strftime('%s', 'now')"))
    updated_at: Mapped[int] = mapped_column(server_default=text("strftime('%s', 'now')"))

    # 关系
    tasks: Mapped[list["TaskRecord"]] = relationship('TaskRecord', back_populates='bridge', cascade='all, delete-orphan')

    def __repr__(self):
        return f"<BridgeRecord bridge_id={self.bridge_id} status={self.status}>"


# Pydantic Schema（API 返回、内部传递）
class AdapterInfo(BaseModel):
    type: AgentType
    agent_name: str
    version: str | None = None
    executable_path: str | None = None


class BridgeInfo(BaseModel):
    """Bridge 信息 DTO"""
    bridge_id: str
    platform: str
    hostname: str
    os_version: str | None = None
    node_version: str | None = None
    bridge_version: str | None = None
    status: BridgeStatus
    last_seen: int
    available_adapters: list[AdapterInfo]
    active_tasks: int
    max_concurrent: int
    created_at: int | None = None
    updated_at: int | None = None


class BridgeFilter(BaseModel):
    """Bridge 查询过滤器"""
    status: BridgeStatus | None = None
    platform: str | None = None
    min_active_tasks: int | None = None


class BridgeManager:
    """Bridge 状态管理器"""
    def __init__(self, db: Session):
        self.db = db
        self._bridges: Dict[str, BridgeInfo] = {}  # 内存缓存

    # 注册管理
    def register_bridge(self, bridge_info: BridgeInfo) -> None
    def update_last_seen(self, bridge_id: str) -> None
    def set_bridge_offline(self, bridge_id: str) -> None

    # 查询
    def get_bridge(self, bridge_id: str) -> BridgeInfo | None
    def get_available_bridges(self, filters: BridgeFilter | None = None) -> list[BridgeInfo]
    def get_all_bridges(self) -> list[BridgeInfo]

    # 任务计数
    def increment_active_tasks(self, bridge_id: str) -> bool  # False if full
    def decrement_active_tasks(self, bridge_id: str) -> None

    # 定期同步
    async def sync_to_db(self) -> None
```

### 3.3 TaskRouter (任务路由)

```python
class TaskRequest(BaseModel):
    """任务请求"""
    prompt: str
    project_path: str
    agent_type: AgentType = AgentType.CLI
    timeout: int = 300
    priority: TaskPriority = TaskPriority.NORMAL
    preferred_ide: str | None = None
    callback_id: str | None = None
    source: str  # 'http' | 'workflow' | 'openclaw'


class TaskRouter:
    """任务路由器"""
    def __init__(self, bridge_manager: BridgeManager, ws_server: WSServer, db_gateway: GatewayDB):
        self.bridge_manager = bridge_manager
        self.ws_server = ws_server
        self.db_gateway = db_gateway

    async def select_bridge(self, task: TaskRequest) -> BridgeInfo | None:
        """MVP 版本：选择负载最低的 Bridge"""
        candidates = self.bridge_manager.get_available_bridges()
        if not candidates:
            return None

        # Step 1: 按 IDE 偏好筛选
        if task.preferred_ide:
            ide_matches = [
                b for b in candidates
                if task.preferred_ide in [a.type for a in b.available_adapters]
            ]
            # 如果有匹配的 IDE，用这些候选；否则用全部候选（兜底）
            if ide_matches:
                candidates = ide_matches

        # Step 2: 按 active_tasks 排序，取最少
        return min(candidates, key=lambda b: b.active_tasks)

    async def submit_task(self, task: TaskRequest) -> str:
        """提交任务，返回 task_id"""
        bridge = await self.select_bridge(task)
        if not bridge:
            raise NoAvailableBridgeError()

        task_id = self._generate_task_id()  # 格式: task_{timestamp}_{short_uuid}

        # 创建任务记录
        self._create_task_record(task_id, task, bridge.bridge_id)

        # 发送到 Bridge
        try:
            await self.ws_server.send_message(bridge.bridge_id, {
                'type': 'task.submit',
                'taskId': task_id,
                'prompt': task.prompt,
                'projectPath': task.project_path,
                'agentType': task.agent_type,
                'timeout': task.timeout,
                'priority': task.priority,
                'preferredIde': task.preferred_ide,
            })
        except Exception as e:
            # 发送失败，标记任务为 failed 并回滚计数
            self._mark_task_failed(task_id, str(e))
            self.bridge_manager.decrement_active_tasks(bridge.bridge_id)
            raise

        # 更新 Bridge 负载计数
        self.bridge_manager.increment_active_tasks(bridge.bridge_id)

        # 启动超时检测（5秒等 ack）
        self._schedule_ack_timeout(task_id, bridge.bridge_id, timeout=5)

        return task_id

    async def cancel_task(self, task_id: str, reason: str) -> None:
        """取消任务"""
        task = self.db_gateway.get_task(task_id)
        if not task:
            return

        # 发送取消消息
        await self.ws_server.send_message(task.bridge_id, {
            'type': 'task.cancel',
            'taskId': task_id,
            'reason': reason
        })

        # 更新任务状态
        self._mark_task_cancelled(task_id)

    def _generate_task_id(self) -> str:
        """生成任务 ID: task_{timestamp}_{short_uuid}"""
        timestamp = int(time.time())
        short_uuid = uuid.uuid4().hex[:8]
        return f"task_{timestamp}_{short_uuid}"

    def _schedule_ack_timeout(self, task_id: str, bridge_id: str, timeout: int = 5):
        """安排任务 ack 超时处理"""
        async def check_ack():
            await asyncio.sleep(timeout)
            task = self.db_gateway.get_task(task_id)
            if task and task.status == 'pending':
                # 超时未收到 ack，标记为 queued
                self._mark_task_queued(task_id)
                self.bridge_manager.decrement_active_tasks(bridge_id)

        asyncio.create_task(check_ack())

    def get_task_bridge(self, task_id: str) -> BridgeRecord | None:
        """获取任务关联的 Bridge"""
        task = self.db_gateway.get_task(task_id)
        if not task:
            return None
        return self.bridge_manager.get_bridge(task.bridge_id)

    def _create_task_record(self, task_id: str, task: TaskRequest, bridge_id: str) -> None:
        """创建任务记录"""
        self.db_gateway.create_task(task_id, task, bridge_id)

    def _mark_task_failed(self, task_id: str, error: str) -> None:
        """标记任务为 failed"""
        self.db_gateway.update_task_status(task_id, TaskStatus.FAILED, error=error)

    def _mark_task_cancelled(self, task_id: str) -> None:
        """标记任务为 cancelled"""
        self.db_gateway.update_task_status(task_id, TaskStatus.CANCELLED)

    def _mark_task_queued(self, task_id: str) -> None:
        """标记任务为 queued"""
        self.db_gateway.update_task_status(task_id, TaskStatus.QUEUED)
```

---

## 四、数据库设计

### 4.1 gateway_bridges 表

```sql
CREATE TABLE gateway_bridges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bridge_id VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(50) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    os_version VARCHAR(100),
    node_version VARCHAR(50),
    bridge_version VARCHAR(50),
    status VARCHAR(20) NOT NULL CHECK(status IN ('online', 'offline')),
    last_seen INTEGER NOT NULL,
    available_adapters JSON NOT NULL,
    active_tasks INTEGER DEFAULT 0,
    max_concurrent INTEGER DEFAULT 3,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_gateway_bridges_status ON gateway_bridges(status);
CREATE INDEX idx_gateway_bridges_last_seen ON gateway_bridges(last_seen);
```

### 4.2 gateway_tasks 表

```sql
CREATE TABLE gateway_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id VARCHAR(255) UNIQUE NOT NULL,
    bridge_id VARCHAR(255) NOT NULL,

    -- 任务内容
    prompt TEXT NOT NULL,
    project_path TEXT NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    timeout INTEGER DEFAULT 300,
    priority VARCHAR(20) DEFAULT 'normal',
    preferred_ide VARCHAR(50),

    -- 任务来源
    source VARCHAR(50) NOT NULL,
    callback_id VARCHAR(255),

    -- 任务状态
    status VARCHAR(20) NOT NULL CHECK(status IN ('pending','queued','running','completed','failed','cancelled')),
    output TEXT,
    error TEXT,
    exit_code INTEGER,
    changed_files JSON,
    duration INTEGER,
    progress INTEGER DEFAULT 0,

    -- 时间戳
    submitted_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,

    FOREIGN KEY (bridge_id) REFERENCES gateway_bridges(bridge_id) ON DELETE CASCADE
);

CREATE INDEX idx_gateway_tasks_status ON gateway_tasks(status);
CREATE INDEX idx_gateway_tasks_bridge_id ON gateway_tasks(bridge_id);
CREATE INDEX idx_gateway_tasks_submitted_at ON gateway_tasks(submitted_at);
```

### 4.3 ORM 模型（SQLAlchemy 2.0）

```python
# app/models/gateway.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, text, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

class TaskRecord(Base):
    """任务持久化记录"""
    __tablename__ = 'gateway_tasks'

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    bridge_id: Mapped[str] = mapped_column(String(255), ForeignKey('gateway_bridges.bridge_id', ondelete='CASCADE'), nullable=False, index=True)

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
    changed_files: Mapped[list[str] | None] = mapped_column(JSON)
    duration: Mapped[int | None] = mapped_column(Integer)
    progress: Mapped[int] = mapped_column(Integer, default=0)

    # 时间戳
    submitted_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    started_at: Mapped[int | None] = mapped_column(Integer)
    completed_at: Mapped[int | None] = mapped_column(Integer)

    # 关系
    bridge: Mapped[BridgeRecord] = relationship('BridgeRecord', back_populates='tasks')

    def __repr__(self):
        return f"<TaskRecord task_id={self.task_id} status={self.status}>"
```

---

## 五、通信流程

### 5.1 Bridge 连接认证流程

```
Bridge                    Gateway WebSocket Server
   │                              │
   │  1. WebSocket Connect         │
   │  ?token=xxx                │  握手阶段鉴权
   │───────────────────────────────►│  verify_gateway_token(token)
   │                              │
   │  2. 1001 Unauthorized      │  或
   │◄───────────────────────────────│  3. 101 Switching Protocols
   │                              │
   │                              │  await websocket.accept()
   │  4. bridge.register          │
   │───────────────────────────────►│
   │                              │  BridgeManager.register_bridge()
   │                              │  写入 gateway_bridges 表
   │  5. ack + resumedTasks     │  (如果有运行中的任务)
   │◄───────────────────────────────│
   │                              │  状态 = READY
```

### 5.2 任务提交流程

```
外部调用者               TaskRouter              BridgeManager          WSServer              Bridge
   │                         │                      │                    │                    │
   │  submit_task()          │                      │                    │                    │
   │─────────────────────►  │                      │                    │                    │
   │                         │  select_bridge()      │                    │                    │
   │                         │──────────────────────►│                    │                    │
   │                         │◄──────────────────────│                    │                    │
   │                         │  返回 BridgeInfo     │                    │                    │
   │                         │                      │                    │                    │
   │                         │  _create_task_record()│                    │                    │
   │                         │─────────────────────────┐                    │                    │
   │                         │                      ▼                    │                    │
   │                         │              gateway_tasks 表            │                    │
   │                         │                      │                    │                    │
   │                         │  send_message()      │                    │                    │
   │                         │─────────────────────────────────────────►  │                    │
   │                         │                      │  task.submit       │                    │
   │                         │                      │─────────────────────────────────►
   │  返回 task_id         │                      │                    │                    │
   │◄─────────────────────  │                      │                    │                    │
   │                         │                      │  6. task.ack     │                    │
   │                         │                      │◄───────────────────────────────── (5秒内)
   │                         │  handle_ack()       │                    │                    │
   │                         │◄──────────────────────│                    │                    │
   │                         │  status = running    │                    │                    │
   │                         │                      │                    │  7. task.progress
   │                         │                      │                    │◄─────────────────────────────────
   │                         │  handle_progress()   │                    │                    │
   │                         │◄──────────────────────│                    │                    │
   │                         │  更新 gateway_tasks   │                    │                    │
   │                         │                      │                    │                    │
   │                         │                      │  8. task.complete │
   │                         │                      │◄─────────────────────────────────
   │                         │  handle_complete()   │                    │
   │                         │◄──────────────────────│                    │                    │
   │                         │  更新 gateway_tasks   │                    │
   │                         │  decrement_active_tasks()                     │
```

### 5.3 任务 ack 超时处理

```
时间轴：
  0s   : task.submit 发送
  0s   : status = 'pending'
  5s   : 检查是否收到 ack
  5s   : 未收到 → status = 'queued', decrement_active_tasks()
  重连时 : Bridge 重新连接 → Gateway 查询 queued 任务 → 重新推送
```

### 5.4 Bridge 断线重连处理

```
Bridge                    Gateway WebSocket Server              BridgeManager
   │                              │                              │
   │  连接断开                    │                              │
   │───────────────────────────────►│                              │
   │                              │  WSServer.disconnect()          │
   │                              │──────────────────────────────►│
   │                              │                              │  status = 'offline'
   │                              │                              │  last_seen 更新
   │                              │                              │
   │  重连                        │                              │
   │  WebSocket Connect             │                              │
   │  ?token=xxx                │                              │
   │───────────────────────────────►│                              │
   │  bridge.register          │                              │
   │───────────────────────────────►│                              │
   │                              │  查询该 Bridge 的 running 任务
   │  ack + resumedTasks     │  返回需要恢复的任务列表
   │◄───────────────────────────────│                              │
```

---

## 六、API 设计

### 6.1 认证函数

```python
# app/auth.py

async def verify_gateway_token(token: str) -> bool:
    """验证 Gateway WebSocket Token（复用现有 API Key）"""
    # 方案 A：复用现有 API Key
    from app.main import API_KEYS
    return token in API_KEYS

    # 方案 B：单独的 Gateway Token（可选）
    # gateway_tokens = os.getenv("GATEWAY_TOKENS", "").split(",")
    # return token in gateway_tokens
```

### 6.2 数据访问模块

```python
# app/services/gateway/db_gateway.py

from sqlalchemy import select, and_, desc, asc
from sqlalchemy.orm import Session
from app.models.gateway import BridgeRecord, TaskRecord
from app.models.gateway_schemas import BridgeInfo, TaskInfo, TaskStatus, BridgeFilter

class GatewayDB:
    """Gateway 数据访问层"""

    def __init__(self, db: Session):
        self.db = db

    # Bridge 操作
    def create_bridge(self, bridge_info: BridgeInfo) -> BridgeRecord:
        """创建/更新 Bridge 记录"""
        record = self.db.execute(
            select(BridgeRecord).where(BridgeRecord.bridge_id == bridge_info.bridge_id)
        ).scalar_one_or_none()

        if record:
            # 更新现有记录
            record.status = bridge_info.status
            record.last_seen = bridge_info.last_seen
            record.available_adapters = bridge_info.available_adapters
            record.active_tasks = bridge_info.active_tasks
            record.max_concurrent = bridge_info.max_concurrent
        else:
            # 创建新记录
            record = BridgeRecord(
                bridge_id=bridge_info.bridge_id,
                platform=bridge_info.platform,
                hostname=bridge_info.hostname,
                os_version=bridge_info.os_version,
                node_version=bridge_info.node_version,
                bridge_version=bridge_info.bridge_version,
                status=bridge_info.status,
                last_seen=bridge_info.last_seen,
                available_adapters=bridge_info.available_adapters,
                active_tasks=bridge_info.active_tasks,
                max_concurrent=bridge_info.max_concurrent,
            )
            self.db.add(record)

        self.db.commit()
        self.db.refresh(record)
        return record

    def get_bridge(self, bridge_id: str) -> BridgeRecord | None:
        """获取 Bridge 记录"""
        return self.db.execute(
            select(BridgeRecord).where(BridgeRecord.bridge_id == bridge_id)
        ).scalar_one_or_none()

    def get_all_bridges(self, filters: BridgeFilter | None = None) -> list[BridgeRecord]:
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
            self.db.commit()

    def increment_active_tasks(self, bridge_id: str) -> bool:
        """增加 Bridge 活跃任务数（返回 False 如果满载）"""
        record = self.get_bridge(bridge_id)
        if not record:
            return False
        if record.active_tasks >= record.max_concurrent:
            return False
        record.active_tasks += 1
        self.db.commit()
        return True

    def decrement_active_tasks(self, bridge_id: str) -> None:
        """减少 Bridge 活跃任务数"""
        record = self.get_bridge(bridge_id)
        if record and record.active_tasks > 0:
            record.active_tasks -= 1
            self.db.commit()

    # Task 操作
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
            status='pending',
            submitted_at=int(time.time()),
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_task(self, task_id: str) -> TaskRecord | None:
        """获取任务记录"""
        return self.db.execute(
            select(TaskRecord).where(TaskRecord.task_id == task_id)
        ).scalar_one_or_none()

    def update_task_status(self, task_id: str, status: TaskStatus, **kwargs) -> None:
        """更新任务状态"""
        record = self.get_task(task_id)
        if record:
            record.status = status.value
            for key, value in kwargs.items():
                setattr(record, key, value)
            self.db.commit()

    def list_tasks(
        self,
        status: TaskStatus | None = None,
        bridge_id: str | None = None,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = "submitted_at",
        sort_order: str = "desc"
    ) -> tuple[list[TaskRecord], int]:
        """查询任务列表（支持筛选和分页）"""
        query = select(TaskRecord)

        if status:
            query = query.where(TaskRecord.status == status.value)
        if bridge_id:
            query = query.where(TaskRecord.bridge_id == bridge_id)

        # 排序
        order_col = getattr(TaskRecord, sort_by, TaskRecord.submitted_at)
        query = query.order_by(desc(order_col) if sort_order == "desc" else asc(order_col))

        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total = self.db.execute(count_query).scalar()

        # 分页
        query = query.offset(offset).limit(limit)

        tasks = list(self.db.execute(query).scalars().all())
        return tasks, total

    def get_queued_tasks(self, bridge_id: str) -> list[TaskRecord]:
        """获取指定 Bridge 的 queued 任务（用于重连恢复）"""
        return self.db.execute(
            select(TaskRecord).where(
                and_(
                    TaskRecord.bridge_id == bridge_id,
                    TaskRecord.status == 'queued'
                )
            )
        ).scalars().all()
```

### 6.3 HTTP API 端点

```python
# app/routers/gateway.py

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/gateway", tags=["Gateway"])

# ============ HTTP API ============

class SubmitTaskRequest(BaseModel):
    prompt: str
    project_path: str
    agent_type: AgentType = AgentType.CLI
    timeout: int = 300
    priority: TaskPriority = TaskPriority.NORMAL
    preferred_ide: str | None = None
    callback_id: str | None = None

class SubmitTaskResponse(BaseModel):
    success: bool
    task_id: str | None = None
    bridge_id: str | None = None
    message: str

class TaskStatusResponse(BaseModel):
    success: bool
    data: TaskInfo | None

class BridgeListResponse(BaseModel):
    success: bool
    data: list[BridgeInfo]

@router.post("/tasks", response_model=SubmitTaskResponse)
async def submit_task(
    request: SubmitTaskRequest,
    source: str = Query(default="http", description="Task source")
):
    """提交任务到 Gateway"""
    task = TaskRequest(
        prompt=request.prompt,
        project_path=request.project_path,
        agent_type=request.agent_type,
        timeout=request.timeout,
        priority=request.priority,
        preferred_ide=request.preferred_ide,
        callback_id=request.callback_id,
        source=source
    )

    task_id = await task_router.submit_task(task)
    bridge = await task_router.get_task_bridge(task_id)

    return SubmitTaskResponse(
        success=True,
        task_id=task_id,
        bridge_id=bridge.bridge_id if bridge else None,
        message="Task submitted successfully"
    )

@router.get("/gateway/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """查询任务状态"""
    task = db_gateway.get_task(task_id)
    return TaskStatusResponse(
        success=task is not None,
        data=task
    )

@router.get("/gateway/bridges", response_model=BridgeListResponse)
async def list_bridges():
    """列出所有 Bridge"""
    bridges = bridge_manager.get_all_bridges()
    return BridgeListResponse(
        success=True,
        data=bridges
    )

@router.get("/gateway/tasks", response_model=TaskListResponse)
async def list_tasks(
    status: TaskStatus | None = None,
    bridge_id: str | None = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    sort_by: str = Query(default="submitted_at", pattern="^(submitted_at|completed_at|status)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$")
):
    """查询任务列表（支持筛选和分页）"""
    tasks, total = db_gateway.list_tasks(
        status=status,
        bridge_id=bridge_id,
        limit=limit,
        offset=offset,
        sort_by=sort_by,
        sort_order=sort_order
    )
    return TaskListResponse(
        success=True,
        data=tasks,
        total=total,
        limit=limit,
        offset=offset
    )

@router.post("/gateway/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, reason: str = Query(default="user_request")):
    """取消任务"""
    await task_router.cancel_task(task_id, reason)
    return {"success": True, "message": "Task cancelled"}

@router.post("/gateway/bridges/{bridge_id}/disconnect")
async def force_disconnect_bridge(bridge_id: str):
    """强制断开指定 Bridge（管理用途）"""
    ws_server.disconnect(bridge_id)
    return {"success": True}
```

### 6.2 WebSocket 端点

```python
# WebSocket 连接
@router.websocket("/gateway/ws")
async def gateway_ws(
    websocket: WebSocket,
    token: str = Query(..., description="API Key for authentication")
):
    """Gateway WebSocket 连接端点"""

    # 握手阶段鉴权
    if not verify_gateway_token(token):
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
                await ws_server.register(bridge_id, websocket)
                # 启动心跳检测
                heartbeat_task = asyncio.create_task(_heartbeat_checker(websocket, bridge_id))
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif bridge_id:
                await ws_server.handle_message(bridge_id, data)
    except WebSocketDisconnect:
        if bridge_id:
            await ws_server.disconnect(bridge_id)
        if heartbeat_task:
            heartbeat_task.cancel()
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=4000, reason="Internal error")
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
            break
```

### 6.3 Pydantic 模型

```python
# app/models/gateway_schemas.py

from pydantic import BaseModel, Field
from enum import Enum

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
    version: str | None = None
    executable_path: str | None = None

class BridgeInfo(BaseModel):
    bridge_id: str
    platform: str
    hostname: str
    os_version: str | None = None
    node_version: str | None = None
    bridge_version: str | None = None
    status: BridgeStatus
    last_seen: int
    available_adapters: list[AdapterInfo]
    active_tasks: int
    max_concurrent: int
    created_at: int | None = None
    updated_at: int | None = None

class TaskInfo(BaseModel):
    task_id: str
    bridge_id: str | None = None
    prompt: str
    project_path: str
    agent_type: AgentType
    timeout: int
    priority: TaskPriority
    preferred_ide: str | None = None
    source: str
    callback_id: str | None = None
    status: TaskStatus
    output: str | None = None
    error: str | None = None
    exit_code: int | None = None
    changed_files: list[str] | None = None
    duration: int | None = None
    progress: int = 0
    submitted_at: int
    started_at: int | None = None
    completed_at: int | None = None

class TaskListResponse(BaseModel):
    success: bool
    data: list[TaskInfo]
    total: int
    limit: int
    offset: int
```

---

## 七、错误处理

### 7.1 错误码定义

```python
class GatewayErrorCode(str, Enum):
    # 认证错误
    UNAUTHORIZED = "GATEWAY_001"
    INVALID_TOKEN = "GATEWAY_002"

    # Bridge 错误
    BRIDGE_NOT_FOUND = "GATEWAY_101"
    BRIDGE_OFFLINE = "GATEWAY_102"
    BRIDGE_CAPACITY_FULL = "GATEWAY_103"

    # 任务错误
    TASK_NOT_FOUND = "GATEWAY_201"
    NO_AVAILABLE_BRIDGE = "GATEWAY_202"
    TASK_SUBMIT_FAILED = "GATEWAY_203"
    TASK_TIMEOUT = "GATEWAY_204"
```

### 7.2 异常类

```python
class GatewayError(Exception):
    """Gateway 基础异常"""
    def __init__(self, code: str, message: str, details: dict | None = None):
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


class UnauthorizedError(GatewayError):
    def __init__(self):
        super().__init__(GatewayErrorCode.UNAUTHORIZED, "Unauthorized")


class BridgeNotFoundError(GatewayError):
    def __init__(self, bridge_id: str):
        super().__init__(
            GatewayErrorCode.BRIDGE_NOT_FOUND,
            f"Bridge not found: {bridge_id}",
            {"bridge_id": bridge_id}
        )


class NoAvailableBridgeError(GatewayError):
    def __init__(self):
        super().__init__(
            GatewayErrorCode.NO_AVAILABLE_BRIDGE,
            "No available bridge for this task"
        )
```

### 7.3 异常处理器

```python
# app/main.py

@app.exception_handler(GatewayError)
async def gateway_exception_handler(request: Request, exc: GatewayError):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )
```

---

## 八、测试策略

### 8.1 单元测试

```python
# tests/test_gateway_manager.py

def test_register_bridge():
    """测试 Bridge 注册"""
    ...

def test_select_bridge_with_ide_preference():
    """测试按 IDE 偏好选择 Bridge"""
    ...

def test_select_bridge_load_balancing():
    """测试负载均衡选择"""
    ...

def test_increment_active_tasks_full():
    """测试任务计数满载场景"""
    ...

# tests/test_task_router.py

def test_submit_task_success():
    """测试任务提交流程"""
    ...

def test_submit_task_no_bridge_available():
    """测试无可用 Bridge 场景"""
    ...

def test_task_ack_timeout():
    """测试 ack 超时处理"""
    ...

def test_cancel_task():
    """测试任务取消"""
    ...
```

### 8.2 集成测试

```python
# tests/test_gateway_integration.py

async def test_bridge_connection_flow():
    """测试 Bridge 完整连接流程"""
    # 连接 → 认证 → 注册 → 发送任务 → 接收结果

async def test_task_round_trip():
    """测试任务完整往返"""
    # 提交任务 → Bridge 执行 → 返回结果

async def test_bridge_reconnect():
    """测试 Bridge 断线重连"""
    # 断开 → 重连 → 恢复任务

async def test_multiple_bridges():
    """测试多 Bridge 场景"""
    # 多个 Bridge 连接 → 任务路由 → 负载均衡
```

---

## 九、文件结构

```
backend/
├── app/
│   ├── main.py                      # 添加 gateway router
│   ├── routers/
│   │   ├── gateway.py              # [新增] HTTP API + WebSocket
│   ├── models/
│   │   ├── gateway.py              # [新增] ORM 模型
│   │   └── gateway_schemas.py      # [新增] Pydantic schemas
│   ├── services/
│   │   ├── gateway/
│   │   │   ├── ws_server.py        # [新增] WebSocket 服务器
│   │   │   ├── bridge_manager.py   # [新增] Bridge 管理
│   │   │   ├── task_router.py     # [新增] 任务路由
│   │   │   └── db_gateway.py      # [新增] Gateway 数据访问
│   └── auth.py                     # 添加 verify_gateway_token()
└── tests/
    ├── test_gateway_manager.py      # [新增]
    ├── test_task_router.py         # [新增]
    └── test_gateway_integration.py  # [新增]
```

---

## 十、MVP 实现范围

### Phase 1：核心功能

- [ ] WSServer - WebSocket 连接管理和消息处理
- [ ] BridgeManager - Bridge 注册、状态管理、查询
- [ ] TaskRouter - 任务路由（MVP 版本：负载最低优先）
- [ ] HTTP API - `/api/v1/gateway/tasks` 等
- [ ] WebSocket 端点 - `/api/gateway/ws`（握手鉴权）
- [ ] 数据库表 - gateway_bridges、gateway_tasks
- [ ] 基础错误处理

### Phase 2：增强功能

- [ ] 任务 ack 超时处理 + queued 任务恢复
- [ ] Bridge 重连 + 任务恢复机制
- [ ] IDE 偏好筛选逻辑
- [ ] 任务进度追踪
- [ ] 单元测试 + 集成测试

### 后续扩展

- [ ] 任务优先级队列
- [ ] 任务重试机制
- [ ] 更多路由策略
- [ ] WebSocket 心跳检测
- [ ] Bridge 健康检查 API
