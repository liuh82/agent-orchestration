# Gateway WebSocket Server Phase 1 实现报告

> 日期：2026-03-14
> 版本：v1.0
> 设计文档：`docs/superpowers/specs/2026-03-14-gateway-websocket-server-design.md`
> 提交：`e2437db` feat: 实现 Gateway WebSocket Server Phase 1

---

## 一、实现概述

基于 Gateway WebSocket Server 设计文档 v1.0，完成了 Phase 1 全部核心功能的实现。Gateway 服务集成到现有 FastAPI 后端 (`:8083`)，与 REST API 共用 uvicorn 进程。

### 1.1 实现范围

| 功能模块 | 状态 | 说明 |
|----------|------|------|
| WSServer 连接管理 | ✅ 完成 | WebSocket 连接注册/断开/消息分发/重试/广播 |
| BridgeManager 状态管理 | ✅ 完成 | 内存缓存 + DB 持久化双写 |
| TaskRouter 任务路由 | ✅ 完成 | 负载最低优先 + IDE 偏好筛选 |
| HTTP API | ✅ 完成 | 6 个端点，含分页/筛选 |
| WebSocket 端点 | ✅ 完成 | `/api/gateway/ws`，握手鉴权 |
| 数据库表 | ✅ 完成 | `gateway_bridges` (14列) + `gateway_tasks` (21列) |
| 认证集成 | ✅ 完成 | 复用现有 API Key |
| 错误处理 | ✅ 完成 | 异常类 + 错误码体系 |
| ack 超时处理 | ✅ 完成 | 5 秒超时，自动标记为 queued |
| Bridge 重连恢复 | ✅ 完成 | 重连时恢复 queued + running 任务 |
| 心跳检测 | ✅ 完成 | 30 秒间隔 ping，检测静默断开 |

### 1.2 新增文件清单

```
backend/app/
├── models/
│   ├── gateway.py              # ORM 模型 (97行)
│   └── gateway_schemas.py      # Pydantic schemas (163行)
├── routers/
│   └── gateway.py              # HTTP API + WebSocket (425行)
└── services/gateway/
    ├── __init__.py             # 包导出 (9行)
    ├── ws_server.py            # WebSocket 服务器 (143行)
    ├── bridge_manager.py       # Bridge 管理器 (143行)
    ├── task_router.py          # 任务路由器 (200行)
    └── db_gateway.py           # 数据访问层 (167行)
```

**总代码量：~1,347 行**

### 1.3 修改文件

| 文件 | 修改内容 |
|------|----------|
| `app/auth.py` | +5行 — `verify_gateway_token()` 函数 |
| `main.py` | +13行 — 路由注册 + 表创建 + 服务初始化 |

---

## 二、API 端点详细说明

### 2.1 HTTP API

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/gateway/tasks` | API Key | 提交任务到 Gateway |
| `GET` | `/api/gateway/tasks/{task_id}` | API Key | 查询任务状态 |
| `GET` | `/api/gateway/tasks` | API Key | 任务列表（分页/筛选/排序） |
| `POST` | `/api/gateway/tasks/{task_id}/cancel` | API Key | 取消任务 |
| `GET` | `/api/gateway/bridges` | API Key | 列出所有 Bridge |
| `POST` | `/api/gateway/bridges/{bridge_id}/disconnect` | API Key | 强制断开 Bridge |

### 2.2 WebSocket 端点

| 路径 | 认证 | 说明 |
|------|------|------|
| `/api/gateway/ws?token=xxx` | Token Query | Bridge 双向通信端点 |

**WebSocket 协议消息类型：**

| 方向 | type | 说明 |
|------|------|------|
| Bridge → Gateway | `bridge.register` | Bridge 注册 |
| Gateway → Bridge | `bridge.registered` | 注册确认 + 恢复任务 |
| Gateway → Bridge | `task.submit` | 任务下发 |
| Bridge → Gateway | `task.ack` | 任务确认 |
| Bridge → Gateway | `task.progress` | 任务进度 |
| Bridge → Gateway | `task.complete` | 任务完成/失败 |
| Gateway → Bridge | `task.cancel` | 任务取消 |
| 双向 | `ping` / `pong` | 心跳检测 |

---

## 三、数据库设计

### 3.1 gateway_bridges 表 (14 列)

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO | 自增主键 |
| bridge_id | VARCHAR(255) | UNIQUE, NOT NULL | Bridge 唯一标识 |
| platform | VARCHAR(50) | NOT NULL | 平台 (darwin/win32/linux) |
| hostname | VARCHAR(255) | NOT NULL | 主机名 |
| os_version | VARCHAR(100) | NULLABLE | 操作系统版本 |
| node_version | VARCHAR(50) | NULLABLE | Node.js 版本 |
| bridge_version | VARCHAR(50) | NULLABLE | Bridge 版本 |
| status | VARCHAR(20) | NOT NULL | 状态 (online/offline) |
| last_seen | INTEGER | NOT NULL | 最后心跳 (Unix 时间戳) |
| available_adapters | JSON | NOT NULL | 可用适配器列表 |
| active_tasks | INTEGER | DEFAULT 0 | 当前活跃任务数 |
| max_concurrent | INTEGER | DEFAULT 3 | 最大并发数 |
| created_at | INTEGER | NOT NULL | 创建时间 |
| updated_at | INTEGER | NOT NULL | 更新时间 |

**索引：** status, last_seen, bridge_id (unique)

### 3.2 gateway_tasks 表 (21 列)

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO | 自增主键 |
| task_id | VARCHAR(255) | UNIQUE, NOT NULL | 任务唯一标识 |
| bridge_id | VARCHAR(255) | FK, NOT NULL | 关联 Bridge |
| prompt | TEXT | NOT NULL | 任务提示词 |
| project_path | TEXT | NOT NULL | 项目路径 |
| agent_type | VARCHAR(50) | NOT NULL | Agent 类型 |
| timeout | INTEGER | DEFAULT 300 | 超时秒数 |
| priority | VARCHAR(20) | DEFAULT 'normal' | 优先级 |
| preferred_ide | VARCHAR(50) | NULLABLE | 偏好 IDE |
| source | VARCHAR(50) | NOT NULL | 来源 (http/workflow/openclaw) |
| callback_id | VARCHAR(255) | NULLABLE | 回调 ID |
| status | VARCHAR(20) | NOT NULL | 状态 |
| output | TEXT | NULLABLE | 任务输出 |
| error | TEXT | NULLABLE | 错误信息 |
| exit_code | INTEGER | NULLABLE | 退出码 |
| changed_files | JSON | NULLABLE | 变更文件列表 |
| duration | INTEGER | NULLABLE | 执行时长(秒) |
| progress | INTEGER | DEFAULT 0 | 进度百分比 |
| submitted_at | INTEGER | NOT NULL | 提交时间 |
| started_at | INTEGER | NULLABLE | 开始时间 |
| completed_at | INTEGER | NULLABLE | 完成时间 |

**索引：** status, bridge_id, submitted_at, task_id (unique)

**外键：** bridge_id → gateway_bridges.bridge_id (CASCADE DELETE)

---

## 四、核心架构

### 4.1 组件依赖关系

```
gateway.py (Router)
    ├── WSServer (WebSocket 连接管理)
    │   └── active_connections: Dict[bridgeId, WebSocket]
    ├── BridgeManager (Bridge 状态管理)
    │   ├── _bridges: Dict[bridgeId, BridgeInfo]  (内存缓存)
    │   └── GatewayDB (持久化)
    └── TaskRouter (任务路由)
        ├── BridgeManager (选择 Bridge)
        ├── WSServer (发送任务)
        └── GatewayDB (任务记录)
```

### 4.2 任务生命周期

```
submitted_at ──► pending ──► running ──► completed
                  │            │
                  │ (ack超时)  │ (失败)
                  ▼            ▼
                queued       failed
                  │
                  │ (Bridge重连)
                  ▼
                pending (重新提交)

任何非终态 ──► cancelled
```

### 4.3 认证机制

Gateway WebSocket 复用现有 API Key 认证体系：

```python
# WebSocket 握手时通过 query param 传递 token
ws://localhost:8083/api/gateway/ws?token=dev-api-key-please-change-in-production

# HTTP API 通过 header 传递
curl -H "X-API-Key: dev-api-key-please-change-in-production" \
     http://localhost:8083/api/gateway/bridges
```

---

## 五、验收结果

### 5.1 测试通过

```
======================= 23 passed, 14 warnings in 0.64s ========================
```

所有 23 个既有测试全部通过，Gateway 实现未破坏任何现有功能。

### 5.2 前端编译

```
npx tsc --noEmit  # 无错误输出
```

### 5.3 路由注册验证

所有 Gateway 路由正确注册到 FastAPI：

```
POST   /api/gateway/tasks
GET    /api/gateway/tasks/{task_id}
GET    /api/gateway/tasks
POST   /api/gateway/tasks/{task_id}/cancel
GET    /api/gateway/bridges
POST   /api/gateway/bridges/{bridge_id}/disconnect
WS     /api/gateway/ws
```

### 5.4 数据库表创建

```
gateway_bridges: 14 columns, 3 indexes
gateway_tasks:   21 columns, 4 indexes, 1 FK
```

---

## 六、Python 3.9 兼容性处理

项目运行在 Python 3.9，无法使用 `str | None` 语法（需要 Python 3.10+）。已做以下处理：

| 文件 | 处理方式 |
|------|----------|
| ORM 模型 (`gateway.py`) | 使用 `Mapped[Optional[str]]` |
| Pydantic schemas (`gateway_schemas.py`) | 使用 `Optional[str]` + `from __future__ import annotations` |
| 服务层 (`services/gateway/*.py`) | 使用 `from __future__ import annotations`（运行时字符串化） |
| Router (`routers/gateway.py`) | 使用 `Optional[str]`（FastAPI 需要运行时评估注解） |
| SQLite `strftime` server_default | 改为 Python 侧 `default=lambda: int(time.time())` |

---

## 七、Phase 2 待实现

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 单元测试 | P0 | 为 Gateway 4 个核心模块编写测试 |
| 集成测试 | P0 | WebSocket 连接 → 任务往返 → 重连恢复 |
| 任务优先级队列 | P1 | 支持 high/normal/low 优先级调度 |
| 任务重试机制 | P1 | 失败任务自动重试 |
| 更多路由策略 | P2 | 轮询/随机/一致性哈希 |
| Bridge 健康检查 | P2 | 定期检查 Bridge 资源使用情况 |
| WebSocket 重连优化 | P2 | 指数退避重连 |

---

## 八、与 Remote Agent Bridge 的对接

Gateway WebSocket Server (后端) 已实现，可与 [remote-agent-bridge/](../remote-agent-bridge/) (Bridge 端) 对接：

- **WebSocket 连接**: Bridge 连接到 `ws://host:8083/api/gateway/ws?token=xxx`
- **协议消息**: 双方使用 JSON 格式通信，消息 type 字段路由
- **任务下发**: Gateway 通过 `task.submit` 消息下发任务到 Bridge
- **结果回传**: Bridge 通过 `task.ack` / `task.progress` / `task.complete` 回传状态
