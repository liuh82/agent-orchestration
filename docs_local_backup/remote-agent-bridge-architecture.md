# Remote Agent Bridge 架构设计文档 v2.0

> **项目名称**: agent-orchestration — Remote Agent Bridge
> **版本**: v2.0
> **日期**: 2026-03-13
> **作者**: 小白（Architect Agent）
> **状态**: 待评审
> **GitHub**: https://github.com/liuh82/agent-orchestration.git

---

## 第1章 项目概述

### 1.1 项目背景

agent-orchestration 是一个多 Agent 编排平台（FastAPI + React），当前存在以下核心能力缺口：

1. **Agent 调用局限**：`lobster_engine.py` 仅通过 `subprocess.run()` 调用服务器本地 CLI，无法调度远端开发环境
2. **IDE 集成缺失**：VS Code MCP/ACP 协议因 `protocolVersion: "2025-11-25"` 不兼容无法直连 Gateway
3. **单向通信**：acpx 只支持 Mac→服务器单向通信，服务器无法主动推任务到开发机
4. **无任务队列**：缺乏异步调度、重试、超时管理机制

### 1.2 项目目标

构建 **Remote Agent Bridge** 系统，实现：

| 目标 | 描述 | 验收标准 |
|------|------|---------|
| 双向通信 | Gateway 可主动推送任务到任意开发机 | 延迟 < 500ms |
| 跨平台 | 支持 macOS / Windows / Linux | 三平台 CI 通过 |
| 多 IDE | 架构支持 VS Code / Cursor / IntelliJ 等 | Adapter 模式可扩展 |
| 编排集成 | Workflow 可调度远端 Agent | Workflow 节点类型 `remote-agent` |
| 自愈能力 | 断线重连、任务恢复、故障转移 | MTTR < 30s |

### 1.3 范围定义

**包含（In Scope）**：
- Bridge 服务（Node.js 跨平台应用）
- WebSocket 双向通信协议
- CLI Agent Adapter（codex / pi / openclaw acp）
- Gateway 多 Bridge 管理与路由
- 编排系统 RemoteAgentEngine 集成
- Bridge HTTP API（供编排系统调用）
- 安全认证与审计
- 跨平台安装与配置

**不包含（Out of Scope，后续 Phase）**：
- VS Code / Cursor 原生扩展（Phase 2）
- JetBrains 原生插件（Phase 3）
- 多人协作任务隔离（Phase 4）
- 费用追踪仪表板（Phase 4）
- Bridge 自动更新（Phase 4）

### 1.4 术语表

| 术语 | 全称 | 定义 |
|------|------|------|
| **Bridge** | Remote Agent Bridge | 运行在开发机上的 Node.js 常驻服务，接收并执行来自 Gateway 的开发任务 |
| **Gateway** | OpenClaw Gateway | 运行在服务器上的 OpenClaw 核心服务（:18789），管理 Agent 会话和路由 |
| **Adapter** | Agent Adapter | Bridge 内部的 Agent 执行适配器，封装不同 Agent（codex/pi/IDE）的调用方式 |
| **CLI Agent** | Command-Line Agent | 通过命令行执行的 AI 编码工具（codex, pi, openclaw acp 等） |
| **IDE Agent** | IDE-Integrated Agent | 集成在 IDE 内的 AI 编码工具（VS Code + Claude Code 等） |
| **ACP** | Agent Client Protocol | AI Agent 间通信的标准协议 |
| **Task** | 开发任务 | Gateway 推送给 Bridge 的一个可执行开发单元 |
| **Session** | 会话 | WebSocket 连接建立后的一次 Bridge 注册生命周期 |
| **CPM** | Checkpoint Manager | Bridge 崩溃恢复用的检查点管理器 |

### 1.5 参考系统

| 系统 | 参考点 | 借鉴内容 |
|------|--------|---------|
| MCP (Model Context Protocol) | 协议设计 | JSON-RPC 消息格式、工具注册模式 |
| ACP (Agent Client Protocol) | Agent 通信 | Session 管理、能力声明 |
| LSP (Language Server Protocol) | 跨进程通信 | 进程管理、stdio 适配 |
| Celery | 任务队列 | 任务状态机、重试策略 |
| Kubernetes | 容错设计 | 健康检查、优雅退出、探针 |

---

## 第2章 系统架构

### 2.1 架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         服务器集群 (81.70.98.45)                           │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────────┐│
│  │ OpenClaw         │    │ 编排系统          │    │ Nginx :443           ││
│  │ Gateway :18789   │    │ FastAPI :8083   │    │ (SSL + WS Proxy)     ││
│  │                  │    │                  │    │                       ││
│  │ ┌──────────────┐ │    │ ┌──────────────┐ │    │ /acp-ws → :18789     ││
│  │ │Bridge Manager│◄├────┤ │Remote Engine │ │    │ /api/v1 → :8083      ││
│  │ │(多Bridge管理) │ │    │ └──────┬───────┘ │    │ /bridge → :18790     ││
│  │ └──────┬───────┘ │    │        │         │    └──────────┬───────────┘│
│  │        │         │    │        │         │               │            │
│  │ ┌──────▼───────┐ │    │        │         │               │            │
│  │ │WS Server     │◄├────┼────────┼─────────┼───────────────┘            │
│  │ │(双向通信)     │ │    │        │         │                            │
│  │ └──────────────┘ │    │        │         │                            │
│  └─────────────────┘    │        │         │                            │
│                          │        │         │                            │
│                    HTTP API    HTTP API   WSS                              │
└──────────────────────────┼────────┼─────────┼────────────────────────────┘
                           │        │         │
          ┌────────────────┘        │         └────────────────┐
          │                         │                          │
          ▼                         ▼                          ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│  Bridge (Mac)    │   │  Bridge (Win)    │   │  Bridge (Linux)      │
│  :18790          │   │  :18790          │   │  :18790               │
│                  │   │                  │   │                       │
│  ┌────────────┐  │   │  ┌────────────┐  │   │  ┌────────────┐       │
│  │WS Client   │  │   │  │WS Client   │  │   │  │WS Client   │       │
│  │+ HTTP API  │  │   │  │+ HTTP API  │  │   │  │+ HTTP API  │       │
│  └─────┬──────┘  │   │  └─────┬──────┘  │   │  └─────┬──────┘       │
│        │         │   │        │         │   │        │               │
│  ┌─────▼──────┐  │   │  ┌─────▼──────┐  │   │  ┌─────▼──────┐       │
│  │Task Runner │  │   │  │Task Runner │  │   │  │Task Runner │       │
│  └─────┬──────┘  │   │  └─────┬──────┘  │   │  └─────┬──────┘       │
│        │         │   │        │         │   │        │               │
│  ┌─────▼──────┐  │   │  ┌─────▼──────┐  │   │  ┌─────▼──────┐       │
│  │CLI Adapter │  │   │  │CLI Adapter │  │   │  │CLI Adapter │       │
│  │(codex/pi)  │  │   │  │(codex/pi)  │  │   │  │(codex/pi)  │       │
│  └────────────┘  │   │  └────────────┘  │   │  └────────────┘       │
│                  │   │                  │   │                       │
│  ┌────────────┐  │   │  ┌────────────┐  │   │  ┌────────────┐       │
│  │codex / pi  │  │   │  │codex / pi  │  │   │  │codex / pi  │       │
│  │(subprocess)│  │   │  │(subprocess)│  │   │  │(subprocess)│       │
│  └────────────┘  │   │  └────────────┘  │   │  └────────────┘       │
└──────────────────┘   └──────────────────┘   └──────────────────────┘
```

### 2.2 组件职责

| 组件 | 运行位置 | 语言 | 职责 |
|------|---------|------|------|
| **Gateway** | 服务器 | Node.js | Agent 会话管理、WebSocket 服务器、Bridge 注册与路由 |
| **Bridge Manager** | Gateway 内部 | TypeScript | 管理多个 Bridge 实例的生命周期、状态跟踪、任务分发 |
| **WS Server** | Gateway 内部 | TypeScript | 接受 Bridge WebSocket 连接，消息编解码 |
| **Remote Engine** | 编排系统 | Python | 编排系统的远端任务执行引擎，通过 HTTP 调用 Bridge |
| **Nginx** | 服务器 | - | SSL 终止、WebSocket 反代、路径路由 |
| **Bridge** | 开发机 | Node.js/TypeScript | WebSocket 客户端、任务队列、Agent Runner、HTTP API |
| **Adapter** | Bridge 内部 | TypeScript | 封装不同 Agent 的调用方式（CLI / IDE / ACP） |
| **CLI Agent** | 开发机 | 多种 | 实际执行开发任务的 AI 编码工具 |

### 2.3 数据流

**任务提交流程**：
```
用户/Workflow
    │
    ▼
Gateway (Bridge Manager)
    │ 选择最佳 Bridge（负载 + IDE 偏好 + 平台匹配）
    │
    ▼
WS Server ──WS──► Bridge (WS Client)
                      │
                      ▼
                  Task Queue（内存 + 磁盘持久化）
                      │
                      ▼
                  Task Runner
                      │
                      ▼
                  Adapter（CLI subprocess spawn）
                      │
                      ▼
                  CLI Agent（codex / pi / ...）
                      │
                      ▼ stdout/stderr
                  Adapter（输出捕获）
                      │
                      ▼
                  Task Runner（组装结果）
                      │
                      ▼
Bridge ──WS──► WS Server ──► Bridge Manager ──► 用户/Workflow
```

### 2.4 技术选型与理由

| 选型 | 理由 | 替代方案及排除原因 |
|------|------|------------------|
| **Node.js 18+** | 跨平台零修改；`child_process`、`fs.watch`、WebSocket 生态成熟；Gateway 本身也是 Node.js，技术栈统一 | Python：Windows 下子进程管理复杂；Go：对 AI 开发者不友好 |
| **TypeScript 5.x** | 类型安全；JSON Schema 可直接从 TS 类型生成；工程可维护性 | JavaScript：缺乏类型约束，大型项目维护成本高 |
| **ws (npm)** | 轻量、高性能 WebSocket 库；Gateway 已使用；社区最活跃 | uWebSockets：性能更好但 C++ native 模块跨平台编译困难 |
| **commander.js** | CLI 参数解析标准库；Bridge 需要提供 CLI 工具 | yargs：功能更多但更重 |
| **zod** | 运行时 JSON Schema 验证；可从 TypeScript 类型推导 schema | ajv：性能更好但需要手写 schema，与 TS 类型脱节 |
| **better-sqlite3** | Bridge 本地持久化（任务 checkpoint）；无服务器依赖、嵌入式；跨平台 | SQLite3：异步 API 但回调复杂；lowdb：JSON 文件，不适合并发 |
| **winston** | 日志库；支持文件/控制台/自定义 transport | pino：性能更好但 API 不够直观 |

---

## 第3章 数据模型设计

### 3.1 ERD 图

```
┌──────────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│     bridges      │       │      tasks           │       │   task_logs      │
├──────────────────┤       ├──────────────────────┤       ├──────────────────┤
│ id (PK)          │──┐    │ id (PK)              │──┐    │ id (PK)          │
│ bridge_id        │  │    │ task_id (UQ)         │  │    │ task_id (FK)     │
│ platform         │  └───►│ bridge_id (FK)       │  └───►│ timestamp        │
│ hostname         │       │ status               │       │ level            │
│ os_version       │       │ agent_type           │       │ message          │
│ node_version     │       │ prompt               │       │ source           │
│ bridge_version   │       │ project_path         │       └──────────────────┘
│ status           │       │ priority             │
│ last_heartbeat   │       │ timeout              │
│ max_concurrent   │       │ exit_code            │
│ created_at       │       │ result               │
│ updated_at       │       │ error_message        │
└──────────────────┘       │ output               │       ┌──────────────────┐
                           │ started_at           │       │  audit_logs      │
                           │ completed_at         │       ├──────────────────┤
                           │ created_at           │       │ id (PK)          │
                           │ updated_at           │       │ bridge_id        │
                           └──────────────────────┘       │ task_id          │
                                   │                      │ action           │
                           ┌───────┴───────┐              │ actor            │
                           │ task_outputs  │              │ timestamp        │
                           ├───────────────┤              │ details (JSON)   │
                           │ id (PK)       │              │ ip_address       │
                           │ task_id (FK)  │              └──────────────────┘
                           │ file_path     │
                           │ change_type   │
                           │ size_bytes    │
                           │ created_at    │
                           └───────────────┘
```

### 3.2 表结构定义（Bridge 本地 SQLite）

#### 3.2.1 bridges 表

存储 Bridge 注册信息。Gateway 侧用内存 Map，Bridge 本地用 SQLite 持久化自己的注册信息。

**Gateway 侧（内存 Map，不需要持久化表）**：
```typescript
interface ManagedBridge {
  bridgeId: string;          // UUID，首次注册时由 Gateway 分配
  platform: 'darwin' | 'win32' | 'linux';
  hostname: string;
  osVersion: string;
  nodeVersion: string;
  bridgeVersion: string;
  status: 'online' | 'offline' | 'suspended';
  lastHeartbeat: number;     // Unix timestamp (ms)
  maxConcurrent: number;     // 默认 2
  activeTaskCount: number;
  availableAdapters: AdapterInfo[];
  activeIDEs: IDEInfo[];
  ipAddress: string;         // Nginx X-Forwarded-For
  metadata: Record<string, string>; // 扩展字段
}
```

#### 3.2.2 tasks 表（Bridge 本地 SQLite）

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         TEXT NOT NULL UNIQUE,         -- UUID，Gateway 生成
    bridge_id       TEXT NOT NULL,                 -- 本 Bridge 的 ID
    status          TEXT NOT NULL DEFAULT 'pending',
                    -- CHECK(status IN ('pending','queued','running','completed','failed','cancelled','timed_out'))
    agent_type      TEXT NOT NULL,                 -- 'codex' | 'pi' | 'acp' | 'vscode-cc' | ...
    prompt          TEXT NOT NULL,                 -- 开发任务描述
    project_path    TEXT NOT NULL,                 -- 项目绝对路径（Bridge 所在平台格式）
    priority        TEXT NOT NULL DEFAULT 'normal',-- 'high' | 'normal' | 'low'
    timeout         INTEGER NOT NULL DEFAULT 300,  -- 秒
    exit_code       INTEGER,                       -- 子进程退出码
    result          TEXT,                           -- JSON: ExecuteResult
    error_message   TEXT,                           -- 失败原因
    output          TEXT,                           -- 完整输出（截断到 1MB）
    preferred_ide   TEXT,                           -- 首选 IDE
    callback_id     TEXT,                           -- 编排系统回调 ID
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 3,
    started_at      TEXT,                           -- ISO 8601
    completed_at    TEXT,                           -- ISO 8601
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_bridge_id ON tasks(bridge_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_task_id ON tasks(task_id);
```

**索引设计理由**：
- `idx_tasks_status`：Task Runner 需要频繁查询 `status = 'queued'` 的任务
- `idx_tasks_bridge_id`：按 Bridge 过滤任务（多 Bridge 场景）
- `idx_tasks_created_at`：历史任务列表分页查询
- `idx_tasks_task_id`：UNIQUE 索引，Gateway 通过 task_id 查询任务状态

#### 3.2.3 task_outputs 表

```sql
CREATE TABLE IF NOT EXISTS task_outputs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         TEXT NOT NULL,
    file_path       TEXT NOT NULL,                  -- 变更文件的绝对路径
    change_type     TEXT NOT NULL,                  -- 'created' | 'modified' | 'deleted'
    size_bytes      INTEGER NOT NULL DEFAULT 0,
    hash_before     TEXT,                           -- SHA-256 (修改前)
    hash_after      TEXT,                           -- SHA-256 (修改后)
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_outputs_task_id ON task_outputs(task_id);
```

#### 3.2.4 task_logs 表

```sql
CREATE TABLE IF NOT EXISTS task_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         TEXT NOT NULL,
    timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
    level           TEXT NOT NULL DEFAULT 'info',
                    -- CHECK(level IN ('debug','info','warn','error','fatal'))
    message         TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'runner',
                    -- 'runner' | 'adapter' | 'agent' | 'system'
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_timestamp ON task_logs(timestamp);
```

#### 3.2.5 audit_logs 表

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bridge_id       TEXT NOT NULL,
    task_id         TEXT,                           -- 可为空（非任务类操作）
    action          TEXT NOT NULL,                  -- 'task.submit' | 'task.complete' | 'auth.login' | ...
    actor           TEXT NOT NULL,                  -- 'gateway' | 'bridge' | 'system'
    timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
    details         TEXT,                           -- JSON: 扩展信息
    ip_address      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_bridge_id ON audit_logs(bridge_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
```

### 3.3 数据关系

| 关系 | 类型 | 说明 |
|------|------|------|
| bridges → tasks | 1:N | 一个 Bridge 可执行多个任务 |
| tasks → task_outputs | 1:N | 一个任务可修改多个文件 |
| tasks → task_logs | 1:N | 一个任务有多条日志 |
| audit_logs → tasks | N:1 | 审计日志可选关联任务 |

---

## 第4章 通信协议设计

### 4.1 协议概述

- **传输层**：WebSocket over TLS 1.2+（wss://）
- **消息格式**：JSON，UTF-8 编码
- **消息模型**：类 JSON-RPC 2.0，但简化为单向推送 + ACK 机制
- **每条消息必须包含**：`msgId`（UUID）、`type`、`timestamp`

### 4.2 消息基础结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BridgeMessage",
  "type": "object",
  "required": ["msgId", "type", "ts"],
  "properties": {
    "msgId": {
      "type": "string",
      "format": "uuid",
      "description": "消息唯一 ID，用于 ACK 关联"
    },
    "type": {
      "type": "string",
      "description": "消息类型",
      "enum": [
        "auth.request", "auth.response",
        "bridge.register", "bridge.ack", "bridge.deregister",
        "task.submit", "task.progress", "task.complete", "task.cancel",
        "ack", "ping", "pong", "error"
      ]
    },
    "ts": {
      "type": "number",
      "description": "Unix timestamp (ms)"
    },
    "payload": {
      "type": "object",
      "description": "消息负载，结构因 type 而异"
    }
  }
}
```

### 4.3 消息类型详细定义

#### 4.3.1 认证消息

**auth.request**（Bridge → Gateway）：

```json
{
  "msgId": "uuid-v4",
  "type": "auth.request",
  "ts": 1710000000000,
  "payload": {
    "token": "85a87cc4...",      // Gateway token
    "bridgeVersion": "1.0.0",
    "platform": "darwin",
    "hostname": "MacBook-Pro.local"
  }
}
```

**auth.response**（Gateway → Bridge）：

```json
{
  "msgId": "uuid-v4",
  "type": "auth.response",
  "ts": 1710000000100,
  "payload": {
    "success": true,
    "bridgeId": "bridge-mac-001",  // Gateway 分配的 Bridge ID
    "gatewayVersion": "2026.3.12",
    "heartbeatInterval": 30000,    // ms
    "serverTime": 1710000000100
  }
}
```

**auth.response (失败)**：

```json
{
  "msgId": "uuid-v4",
  "type": "auth.response",
  "ts": 1710000000100,
  "payload": {
    "success": false,
    "errorCode": "AUTH_INVALID_TOKEN",
    "errorMessage": "Token 已过期或无效",
    "retryAfter": 0
  }
}
```

#### 4.3.2 Bridge 注册消息

**bridge.register**（Bridge → Gateway，认证成功后立即发送）：

```json
{
  "msgId": "uuid-v4",
  "type": "bridge.register",
  "ts": 1710000000200,
  "payload": {
    "bridgeId": "bridge-mac-001",
    "platform": "darwin",
    "hostname": "MacBook-Pro.local",
    "osVersion": "Darwin 23.4.0",
    "nodeVersion": "v22.22.0",
    "bridgeVersion": "1.0.0",
    "maxConcurrent": 2,
    "capabilities": {
      "adapters": [
        {
          "type": "cli",
          "agentName": "codex",
          "version": "0.114.0",
          "executablePath": "/usr/local/bin/codex",
          "supportedFeatures": ["approval-mode", "quiet", "cwd"]
        },
        {
          "type": "cli",
          "agentName": "pi",
          "version": "1.2.0",
          "executablePath": "/usr/local/bin/pi"
        }
      ],
      "activeIDEs": [
        {
          "name": "vscode",
          "version": "1.96.0",
          "workspace": "/Users/liuh/projects/agent-orchestration"
        },
        {
          "name": "cursor",
          "version": "0.42.0",
          "workspace": "/Users/liuh/projects/agent-orchestration"
        }
      ],
      "platformPaths": {
        "configDir": "/Users/liuh/.oc-bridge",
        "taskDir": "/tmp/oc-tasks"
      }
    }
  }
}
```

**bridge.ack**（Gateway → Bridge，确认注册）：

```json
{
  "msgId": "uuid-v4",
  "type": "bridge.ack",
  "ts": 1710000000300,
  "payload": {
    "bridgeId": "bridge-mac-001",
    "registered": true,
    "assignedAdapters": ["cli:codex", "cli:pi"],
    "message": "Bridge 注册成功"
  }
}
```

#### 4.3.3 任务消息

**task.submit**（Gateway → Bridge）：

```json
{
  "msgId": "uuid-v4",
  "type": "task.submit",
  "ts": 1710000001000,
  "payload": {
    "taskId": "task-uuid-001",
    "prompt": "将 backend/app/services/task.py 迁移到 SQLAlchemy 2.0 ORM",
    "projectPath": "/Users/liuh/projects/agent-orchestration",
    "agentType": "codex",
    "timeout": 300,
    "priority": "normal",
    "preferredIde": "cursor",
    "callbackId": "workflow-step-001",
    "metadata": {
      "workflowId": "wf-001",
      "stepId": "step-dev-01",
      "caller": "openclaw"
    }
  }
}
```

**字段验证规则**：

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| taskId | string | ✅ | UUID v4 格式 | Gateway 生成，全局唯一 |
| prompt | string | ✅ | 1-10000 字符 | 开发任务描述 |
| projectPath | string | ✅ | 绝对路径，平台格式 | Bridge 所在平台的路径 |
| agentType | string | ✅ | 见 Adapter 注册列表 | 指定执行 Agent |
| timeout | number | ✅ | 30-3600 秒 | 任务超时 |
| priority | string | ✅ | high/normal/low | 优先级 |
| preferredIde | string | ❌ | IDE name | 首选 IDE（hint） |
| callbackId | string | ❌ | max 256 字符 | 编排系统回调标识 |
| metadata | object | ❌ | max 4KB | 扩展信息 |

**task.progress**（Bridge → Gateway，实时状态更新）：

```json
{
  "msgId": "uuid-v4",
  "type": "task.progress",
  "ts": 1710000005000,
  "payload": {
    "taskId": "task-uuid-001",
    "status": "running",
    "progress": 45,
    "output": "正在迁移 task.py 的 query 方法...",
    "adapterType": "cli",
    "agentName": "codex",
    "pid": 12345
  }
}
```

**task.complete**（Bridge → Gateway，任务完成）：

```json
{
  "msgId": "uuid-v4",
  "type": "task.complete",
  "ts": 1710000020000,
  "payload": {
    "taskId": "task-uuid-001",
    "status": "completed",
    "result": {
      "exitCode": 0,
      "output": "迁移完成。修改了以下文件：\n1. task.py - 替换 raw SQL 为 ORM\n2. models.py - 添加 Task ORM 模型",
      "changedFiles": [
        {
          "path": "backend/app/services/task.py",
          "changeType": "modified",
          "sizeBytes": 12345,
          "hashBefore": "sha256:abc...",
          "hashAfter": "sha256:def..."
        }
      ],
      "duration": 15000,
      "agentName": "codex",
      "adapterType": "cli"
    }
  }
}
```

**task.cancel**（Gateway → Bridge）：

```json
{
  "msgId": "uuid-v4",
  "type": "task.cancel",
  "ts": 1710000015000,
  "payload": {
    "taskId": "task-uuid-001",
    "reason": "用户取消",
    "graceful": true
  }
}
```

#### 4.3.4 心跳消息

**ping**（Gateway → Bridge，每 30 秒）：

```json
{
  "msgId": "uuid-v4",
  "type": "ping",
  "ts": 1710000030000,
  "payload": {
    "serverTime": 1710000030000
  }
}
```

**pong**（Bridge → Gateway）：

```json
{
  "msgId": "uuid-v4",
  "type": "pong",
  "ts": 1710000030050,
  "payload": {
    "activeTasks": 1,
    "availableAdapters": ["cli:codex", "cli:pi"],
    "memoryUsage": { "rss": 85400000, "heapTotal": 67108864 },
    "cpuUsage": 12.5,
    "queueLength": 0
  }
}
```

#### 4.3.5 ACK 消息

所有需要确认的消息（task.submit, task.cancel, bridge.register）都需要接收方回复 ACK：

```json
{
  "msgId": "uuid-v4",
  "type": "ack",
  "ts": 1710000000600,
  "payload": {
    "ackedMsgId": "task.submit的msgId",
    "status": "received",
    "details": {}
  }
}
```

#### 4.3.6 错误消息

```json
{
  "msgId": "uuid-v4",
  "type": "error",
  "ts": 1710000000700,
  "payload": {
    "code": "TASK_REJECTED",
    "message": "Agent 'codex' 不可用",
    "relatedMsgId": "task.submit的msgId",
    "retryable": true,
    "details": {
      "availableAgents": ["pi"],
      "reason": "codex executable not found"
    }
  }
}
```

### 4.4 ACK 机制

```
Gateway                    Bridge
  │── task.submit ────────►│
  │                        │ (写入磁盘 + 入队)
  │◄── ack(received) ──────│
  │                        │
  │    ... (任务执行中)     │
  │                        │
  │◄── task.complete ──────│
  │── ack(received) ──────►│
  │                        │
  │  [如果 5s 内没收到 ACK]  │
  │── task.submit ────────►│ (重发，幂等)
  │                        │
  │  [重试 3 次后]          │
  │── error ──────────────►│ (标记 Bridge 不可达)
```

**ACK 超时规则**：
- 等待 ACK：5 秒
- 重试次数：3 次
- 重试间隔：1s, 2s, 4s（线性退避）
- 超时后标记消息为 `delivery_failed`，不自动重发

### 4.5 消息幂等性

所有消息通过 `msgId` 保证幂等：
- Bridge 收到重复 `task.submit`（相同 taskId）：忽略，返回 ACK + 当前状态
- Gateway 收到重复 `task.complete`：忽略

### 4.6 时序图

#### 4.6.1 Bridge 注册与首次连接

```
 Bridge                          Gateway
   │                                │
   │── TCP CONNECT ────────────────►│
   │◄── TLS HANDSHAKE ────────────►│
   │                                │
   │── auth.request {token} ───────►│
   │    │                           │
   │    │  验证 token                │
   │    │  生成/查找 bridgeId        │
   │    │                           │
   │◄── auth.response {bridgeId} ──│
   │                                │
   │── bridge.register {caps} ─────►│
   │    │                           │
   │    │  存储能力信息              │
   │    │  计算路由权重              │
   │    │                           │
   │◄── bridge.ack ────────────────│
   │                                │
   │  ◄── 连接建立，开始心跳 ──────►│
   │                                │
   │◄── ping ──────────────────────│ (每 30s)
   │── pong {stats} ───────────────►│
   │                                │
```

#### 4.6.2 任务提交与执行

```
 用户/Workflow    Gateway(BridgeMgr)    WS Server    Bridge        Adapter      CLI Agent
       │                 │                 │            │             │             │
       │── 提交任务 ────►│                 │            │             │             │
       │                 │                 │            │             │             │
       │                 │ 选择最佳 Bridge  │            │             │             │
       │                 │ (负载+IDE+平台)  │            │             │             │
       │                 │                 │            │             │             │
       │                 │── task.submit ──►│            │             │             │
       │                 │                 │── WS ─────►│             │             │
       │                 │                 │            │             │             │
       │                 │                 │            │ 写入 SQLite │             │
       │                 │                 │            │ 入队        │             │
       │                 │                 │            │             │             │
       │                 │                 │◄── ack ────│             │             │
       │                 │◄── ack ──────────│            │             │             │
       │◄── taskId ──────│                 │            │             │             │
       │                 │                 │            │             │             │
       │                 │                 │            │ Task Runner │             │
       │                 │                 │            │ 取出任务    │             │
       │                 │                 │            │── execute ─►│             │
       │                 │                 │            │             │             │
       │                 │                 │            │             │ spawn ─────►│
       │                 │                 │            │             │             │
       │                 │◄── task.progress(running) ◄──│◄── output ──│◄── stdout ──│
       │                 │                 │            │             │             │
       │                 │                 │            │             │             │
       │                 │◄── task.progress(50%) ◄─────│◄── output ──│◄── stdout ──│
       │                 │                 │            │             │             │
       │                 │                 │            │             │◄── exit(0) ──│
       │                 │                 │            │◄── result ──│             │
       │                 │                 │            │             │             │
       │                 │                 │            │ 更新 SQLite │             │
       │                 │                 │            │ 写入变更文件│             │
       │                 │                 │            │             │             │
       │                 │◄── task.complete ◄──────────│             │             │
       │                 │                 │            │             │             │
       │◄── 任务结果 ────│                 │            │             │             │
       │                 │                 │            │             │             │
```

#### 4.6.3 断线重连与任务恢复

```
 Bridge                          Gateway
   │                                │
   │    ╳ 网络断开 ╳               │
   │                                │
   │                 [Gateway 侧]
   │                 - 标记 Bridge offline
   │                 - 进行中的任务标记 interrupted
   │                 - 等待重连 (不重新分配)
   │                 - 心跳超时 3 次后: 重分配待执行任务
   │                                │
   │    [Bridge 侧]
   │    - 检测断连
   │    - 内存中 running 的任务 → 写入磁盘 (checkpoint)
   │    - 指数退避重连
   │    - 第1次: 1s, 第2次: 2s, 第3次: 4s ... 最大 60s
   │                                │
   │── TCP CONNECT ────────────────►│ (重连成功)
   │── auth.request ───────────────►│
   │◄── auth.response ─────────────│
   │                                │
   │── bridge.register ────────────►│
   │    payload: {                  │
   │      recoveringTasks: [        │
   │        { taskId, status,       │
   │          lastOutput, pid }     │
   │      ]                         │
   │    }                           │
   │                                │
   │    [Gateway 侧]
   │    - 对比状态:
   │      Bridge says running, Gateway says interrupted
   │      → 以 Bridge 侧为准 (子进程可能还在跑)
   │      Bridge says queued, Gateway says interrupted
   │      → 重新入队
   │                                │
   │◄── bridge.recovery.ack ───────│
   │    payload: {                  │
   │      confirmed: [...],         │  -- 确认恢复
   │      requeued: [...],          │  -- 需要重新执行
   │      cancelled: [...]          │  -- 已超时/被替代
   │    }                           │
   │                                │
   │  ◄── 恢复完成，继续心跳 ──────►│
   │                                │
```

#### 4.6.4 多 Bridge 故障转移

```
 用户           Gateway                Bridge A (Mac)         Bridge B (Win)
   │               │                        │                      │
   │── 提交任务 ──►│                        │                      │
   │               │                        │                      │
   │               │ 选择 Bridge A           │                      │
   │               │ (优先级: A > B)         │                      │
   │               │── task.submit ────────►│                      │
   │               │◄── ack ────────────────│                      │
   │◄── taskId ────│                        │                      │
   │               │                        │                      │
   │               │          ╳ Bridge A 断连 ╳                    │
   │               │                        │                      │
   │               │ [等待重连 90s]          │                      │
   │               │ (3次心跳超时)           │                      │
   │               │                        │                      │
   │               │ Bridge A → offline     │                      │
   │               │ Bridge A 的 running 任务→ interrupted        │
   │               │                        │                      │
   │               │ 重新分配到 Bridge B     │                      │
   │               │── task.submit ────────►──────────────────────►│
   │               │◄── ack ───────────────────────────────────────│
   │               │                        │                      │
   │               │                        │          Bridge A 重连
   │               │                        │◄── bridge.register ──│
   │               │                        │── recovery.ack ──────►│
   │               │                        │  (cancelled 任务 A 在 B 已完成)
   │               │                        │                      │
```

---

## 第5章 Bridge 服务设计

### 5.1 文件结构

```
remote-agent-bridge/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .eslintrc.json
├── .prettierrc
├── jest.config.ts
├── src/
│   ├── index.ts                        # CLI 入口 (commander.js)
│   ├── bridge.ts                       # Bridge 主类 (生命周期管理)
│   ├── ws-client.ts                    # WebSocket 客户端 (连接/重连/心跳)
│   ├── task-queue.ts                   # 任务队列 (优先级 + 并发控制)
│   ├── task-runner.ts                  # 任务执行调度器
│   ├── checkpoint.ts                   # Checkpoint Manager (崩溃恢复)
│   ├── database.ts                     # SQLite 数据库管理 (better-sqlite3)
│   ├── http-server.ts                  # HTTP API 服务 (本地)
│   ├── adapters/
│   │   ├── types.ts                    # Adapter 接口定义
│   │   ├── registry.ts                 # Adapter 注册表
│   │   ├── base.ts                     # Adapter 基类 (抽象)
│   │   ├── cli-adapter.ts             # CLI Agent (codex / pi / acp)
│   │   ├── vscode-adapter.ts          # VS Code 文件队列 (Phase 2)
│   │   ├── cursor-adapter.ts          # Cursor 文件队列 (Phase 2)
│   │   └── intellij-adapter.ts        # IntelliJ (Phase 3)
│   ├── protocol/
│   │   ├── types.ts                    # 消息类型定义 (TypeScript)
│   │   ├── schemas.ts                  # Zod 验证 schemas
│   │   ├── encoder.ts                  # 消息编码器
│   │   └── decoder.ts                  # 消息解码器 + 验证
│   ├── config/
│   │   ├── types.ts                    # 配置类型定义
│   │   ├── defaults.ts                 # 默认配置
│   │   ├── loader.ts                   # 配置加载器 (文件 + 环境变量)
│   │   └── validator.ts               # 配置验证 (Zod)
│   ├── platform/
│   │   ├── index.ts                    # 平台检测
│   │   ├── paths.ts                    # 跨平台路径
│   │   └── editors.ts                 # 编辑器检测与路径
│   ├── security/
│   │   ├── token.ts                    # Token 管理
│   │   └── sandbox.ts                 # 任务沙箱
│   ├── audit/
│   │   └── logger.ts                   # 审计日志
│   └── utils/
│       ├── logger.ts                   # 应用日志 (winston)
│       ├── retry.ts                    # 重试逻辑
│       ├── pid-monitor.ts              # 子进程监控
│       └── graceful-shutdown.ts        # 优雅退出
├── scripts/
│   ├── install.sh                      # Mac/Linux 安装
│   ├── install.ps1                     # Windows 安装 (PowerShell)
│   ├── setup.ts                        # 交互式配置向导
│   └── db-migrate.ts                   # 数据库迁移
├── tests/
│   ├── unit/
│   │   ├── task-queue.test.ts
│   │   ├── task-runner.test.ts
│   │   ├── checkpoint.test.ts
│   │   ├── ws-client.test.ts
│   │   └── adapters/
│   │       ├── cli-adapter.test.ts
│   │       └── registry.test.ts
│   ├── integration/
│   │   ├── bridge-lifecycle.test.ts
│   │   ├── task-e2e.test.ts
│   │   └── reconnection.test.ts
│   └── fixtures/
│       └── mock-gateway.ts
├── .github/
│   └── workflows/
│       ├── ci.yml                      # GitHub Actions CI
│       ├── release.yml                 # 发布
│       └── matrix-test.yml             # 跨平台测试矩阵
└── README.md
```

### 5.2 Bridge 主类生命周期

```typescript
// bridge.ts

import { EventEmitter } from 'events';
import { WSClient } from './ws-client';
import { TaskQueue } from './task-queue';
import { TaskRunner } from './task-runner';
import { CheckpointManager } from './checkpoint';
import { Database } from './database';
import { HttpServer } from './http-server';
import { AdapterRegistry } from './adapters/registry';
import { Config } from './config/types';
import { Logger } from './utils/logger';

export enum BridgeState {
  INITIALIZING = 'initializing',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  REGISTERING = 'registering',
  READY = 'ready',
  RECONNECTING = 'reconnecting',
  RECOVERING = 'recovering',
  SUSPENDED = 'suspended',
  SHUTTING_DOWN = 'shutting_down',
  TERMINATED = 'terminated',
}

export class Bridge extends EventEmitter {
  private state: BridgeState = BridgeState.INITIALIZING;
  private wsClient: WSClient;
  private taskQueue: TaskQueue;
  private taskRunner: TaskRunner;
  private checkpoint: CheckpointManager;
  private database: Database;
  private httpServer: HttpServer;
  private adapters: AdapterRegistry;
  private config: Config;
  private logger: Logger;
  private shutdownTimer?: NodeJS.Timeout;

  constructor(config: Config) {
    super();
    this.config = config;
    this.logger = new Logger('Bridge', config.logging);
    this.database = new Database(config.database);
    this.adapters = new AdapterRegistry(config.adapters);
    this.taskQueue = new TaskQueue(config.tasks.maxConcurrent);
    this.taskRunner = new TaskRunner(this.adapters, this.taskQueue);
    this.checkpoint = new CheckpointManager(this.database);
    this.wsClient = new WSClient(config.gateway, this.checkpoint);
    this.httpServer = new HttpServer(config.http, this.taskRunner, this.adapters);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // WebSocket 事件
    this.wsClient.on('task.submit', this.handleTaskSubmit.bind(this));
    this.wsClient.on('task.cancel', this.handleTaskCancel.bind(this));
    this.wsClient.on('ping', this.handlePing.bind(this));
    this.wsClient.on('connected', this.handleConnected.bind(this));
    this.wsClient.on('disconnected', this.handleDisconnected.bind(this));
    this.wsClient.on('error', this.handleError.bind(this));

    // Task Runner 事件
    this.taskRunner.on('progress', (task) => {
      this.wsClient.sendProgress(task);
    });
    this.taskRunner.on('complete', (task) => {
      this.wsClient.sendComplete(task);
      this.checkpoint.clear(task.taskId);
    });
    this.taskRunner.on('failed', (task, error) => {
      this.wsClient.sendComplete({ ...task, status: 'failed', error_message: error.message });
      this.checkpoint.clear(task.taskId);
    });

    // 进程信号
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => this.reloadConfig());
  }

  async start(): Promise<void> {
    this.setState(BridgeState.INITIALIZING);

    // 1. 初始化数据库
    await this.database.initialize();
    this.logger.info('数据库初始化完成');

    // 2. 初始化 Adapter（检测可用性）
    const availableAdapters = await this.adapters.detectAvailable();
    this.logger.info(`可用 Adapter: ${availableAdapters.map(a => a.type).join(', ')}`);

    // 3. 恢复未完成任务（从 checkpoint）
    this.setState(BridgeState.RECOVERING);
    const recovered = await this.checkpoint.recover();
    for (const task of recovered) {
      if (task.status === 'running') {
        // 检查子进程是否还活着
        const alive = await this.taskRunner.checkProcessAlive(task.pid);
        if (alive) {
          this.taskQueue.enqueue(task);
          this.logger.info(`恢复运行中任务: ${task.taskId} (PID: ${task.pid})`);
        } else {
          this.logger.warn(`任务 ${task.taskId} 的子进程已死亡，标记为失败`);
          await this.database.updateTask(task.taskId, { status: 'failed', error_message: 'Process died during recovery' });
        }
      } else if (task.status === 'queued') {
        this.taskQueue.enqueue(task);
        this.logger.info(`恢复排队任务: ${task.taskId}`);
      }
    }

    // 4. 启动 Task Runner
    this.taskRunner.start();
    this.logger.info('Task Runner 已启动');

    // 5. 启动 HTTP API
    this.httpServer.start();
    this.logger.info(`HTTP API 已启动: http://localhost:${this.config.http.port}`);

    // 6. 连接 Gateway
    await this.connectToGateway();
  }

  private async connectToGateway(): Promise<void> {
    this.setState(BridgeState.CONNECTING);

    try {
      await this.wsClient.connect();
      // WSClient 内部处理 auth + register
      this.setState(BridgeState.READY);
      this.logger.info('Bridge 已就绪');
    } catch (error) {
      this.logger.error(`连接 Gateway 失败: ${error.message}`);
      this.setState(BridgeState.RECONNECTING);
      // WSClient 内部处理指数退避重连
    }
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    this.logger.info(`收到 ${signal}，开始优雅退出...`);
    this.setState(BridgeState.SHUTTING_DOWN);

    // 1. 停止接收新任务（通知 Gateway）
    await this.wsClient.sendDeregister('shutting_down');

    // 2. 等待运行中任务完成（最多 shutdownTimeout 秒）
    const shutdownTimeout = this.config.bridge.shutdownTimeout || 30;
    const runningTasks = this.taskRunner.getRunningTasks();

    if (runningTasks.length > 0) {
      this.logger.info(`等待 ${runningTasks.length} 个任务完成 (timeout: ${shutdownTimeout}s)...`);

      await Promise.race([
        Promise.all(runningTasks.map(t => this.taskRunner.waitForTask(t.taskId))),
        new Promise(resolve => setTimeout(resolve, shutdownTimeout * 1000)),
      ]);
    }

    // 3. 保存 checkpoint
    await this.checkpoint.saveAll();

    // 4. Kill 残留子进程
    await this.taskRunner.killAll();

    // 5. 关闭 HTTP Server
    await this.httpServer.stop();

    // 6. 关闭 WebSocket
    this.wsClient.disconnect();

    // 7. 关闭数据库
    this.database.close();

    this.setState(BridgeState.TERMINATED);
    this.logger.info('Bridge 已退出');
    process.exit(0);
  }

  private setState(newState: BridgeState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChange', { from: oldState, to: newState });
    this.logger.info(`状态变更: ${oldState} → ${newState}`);
  }
}
```

### 5.3 优雅退出详解

```
SIGTERM/SIGINT
    │
    ▼
1. 设置状态为 SHUTTING_DOWN
2. 通知 Gateway: bridge.deregister { reason: "shutting_down" }
3. 拒绝新任务 (task.submit 返回 error: BRIDGE_SHUTTING_DOWN)
    │
    ▼
4. 等待运行中任务完成 (默认 30s 超时)
    │
    ├── [所有任务完成]     │
    ├── [超时]            │
    │                     │
    ▼                     ▼
5. SIGTERM 发送给所有子进程 (graceful kill)
   等待 5s
6. SIGKILL 发送给未退出的子进程 (force kill)
    │
    ▼
7. 保存 checkpoint (未完成任务 → SQLite)
8. 关闭 HTTP Server
9. 关闭 WebSocket 连接
10. 关闭数据库连接
11. process.exit(0)
```

**为什么不用 `process.on('exit')`？**
- `exit` 事件中不能执行异步操作（数据库写入、网络请求等）
- 必须在信号处理器中主动关闭所有资源

### 5.4 配置管理

#### 5.4.1 配置优先级

```
环境变量 (最高) > 配置文件 > 默认值 (最低)
```

**环境变量命名规则**：`OC_BRIDGE_{SECTION}_{KEY}`，例如：
- `OC_BRIDGE_GATEWAY_URL` → `gateway.url`
- `OC_BRIDGE_TASKS_MAX_CONCURRENT` → `tasks.maxConcurrent`
- `OC_BRIDGE_LOGGING_LEVEL` → `logging.level`

#### 5.4.2 配置文件位置（跨平台）

| 平台 | 路径 |
|------|------|
| macOS | `~/.oc-bridge/config.json` |
| Windows | `%APPDATA%\oc-bridge\config.json` |
| Linux | `~/.oc-bridge/config.json` |

#### 5.4.3 完整配置项列表

```typescript
// config/types.ts

export interface BridgeConfig {
  bridge: {
    id?: string;                    // 自动生成或由 Gateway 分配
    version: string;                // 从 package.json 读取
    shutdownTimeout: number;        // 优雅退出等待时间（秒），默认 30
    healthCheckInterval: number;    // 健康检查间隔（秒），默认 10
  };

  gateway: {
    url: string;                    // wss://81.70.98.45
    tokenFile: string;              // ~/.openclaw/gateway.token
    reconnect: {
      enabled: boolean;             // 默认 true
      maxRetries: number;           // 默认 Infinity (永不放弃)
      baseDelay: number;            // 默认 1000ms
      maxDelay: number;             // 默认 60000ms
      jitter: number;               // 默认 1000ms
    };
  };

  tasks: {
    maxConcurrent: number;          // 默认 2
    defaultTimeout: number;         // 默认 300s
    maxRetries: number;             // 默认 3
    outputBufferSize: number;       // 输出缓冲行数，默认 100
    maxOutputSize: number;          // 最大输出存储 (bytes)，默认 1048576 (1MB)
    queuePriority: {                // 优先级权重
      high: number;                 // 默认 3
      normal: number;               // 默认 2
      low: number;                  // 默认 1
    };
  };

  adapters: {
    autoDetect: boolean;            // 启动时自动检测可用 Adapter，默认 true
    cli: {
      codex: {
        command: string;            // 'codex'
        args: string[];             // ['--approval-mode', 'suggest', '--quiet']
        timeout: number;            // 默认 300
        env: Record<string, string>; // 环境变量，默认 {}
        maxOutputBytes: number;     // 默认 1MB
      };
      pi: {
        command: string;            // 'pi'
        args: string[];             // []
        timeout: number;
        env: Record<string, string>;
        maxOutputBytes: number;
      };
      acp: {
        command: string;            // 'openclaw'
        args: string[];             // ['acp', '--url', '...']
        timeout: number;
        env: Record<string, string>;
        maxOutputBytes: number;
      };
    };
  };

  http: {
    enabled: boolean;               // 默认 true
    port: number;                   // 默认 18790
    host: string;                   // 默认 '127.0.0.1'
    cors: {
      origins: string[];            // 默认 ['*']
      methods: string[];            // 默认 ['GET', 'POST', 'DELETE']
    };
    auth: {
      enabled: boolean;             // 默认 true
      token: string;                // 如果不设置，使用 Gateway token
    };
  };

  database: {
    path: string;                   // {configDir}/bridge.db
    walEnabled: boolean;            // 默认 true (WAL 模式，提高并发读写)
    busyTimeout: number;            // 默认 5000ms
    journalMode: string;            // 默认 'wal'
  };

  checkpoint: {
    enabled: boolean;               // 默认 true
    saveInterval: number;           // 自动保存间隔（秒），默认 5
    directory: string;              // 默认 {configDir}/checkpoints
  };

  logging: {
    level: string;                  // 'debug' | 'info' | 'warn' | 'error'，默认 'info'
    file: string;                   // 默认 {configDir}/bridge.log
    maxFiles: number;               // 日志轮转文件数，默认 5
    maxSize: string;                // 单文件最大大小，默认 '10m'
    console: boolean;               // 是否输出到控制台，默认 true
  };

  security: {
    allowedCommands: string[];      // 允许的 CLI 命令，默认 ['codex', 'pi', 'openclaw']
    allowedPaths: string[];         // 允许的项目路径前缀，默认 [] (不限制)
    blockedPatterns: string[];      // 阻止的 prompt 模式，默认 ['rm -rf /', 'sudo ', 'format ']
    requireApprovalFor: string[];   // 需要确认的 Agent 类型，默认 []
  };
}
```

#### 5.4.4 配置热更新

```typescript
// config/loader.ts

import { watch } from 'fs';

export class ConfigWatcher {
  private watcher?: FSWatcher;

  startWatch(configPath: string, onReload: (config: BridgeConfig) => void): void {
    this.watcher = watch(configPath, { persistent: false }, (eventType) => {
      if (eventType === 'change') {
        try {
          const newConfig = loadConfig(configPath);
          onReload(newConfig);
          logger.info('配置已热更新');
        } catch (error) {
          logger.error(`配置热更新失败: ${error.message}`);
          // 不影响当前运行，使用旧配置继续
        }
      }
    });
  }
}
```

**可热更新的配置**：logging.level、tasks.maxConcurrent、adapters 配置
**不可热更新（需重启）**：gateway.url、database.path、http.port

---

## 第6章 Adapter 设计

### 6.1 接口定义

```typescript
// adapters/types.ts

export interface AgentAdapter {
  /** Adapter 类型标识（如 'cli:codex'） */
  readonly type: string;

  /** Agent 名称（如 'codex'） */
  readonly agentName: string;

  /** 检测当前 Adapter 是否可用 */
  isAvailable(): Promise<AdapterAvailability>;

  /** 获取版本信息 */
  getVersion(): Promise<string | null>;

  /** 执行任务 */
  execute(request: ExecuteRequest): Promise<ExecuteResult>;

  /** 取消正在执行的任务 */
  cancel(taskId: string): Promise<void>;

  /** 清理资源 */
  dispose(): Promise<void>;
}

export interface AdapterAvailability {
  available: boolean;
  reason?: string;              // 不可用原因
  executablePath?: string;      // 可执行文件路径
  version?: string;             // 版本
}

export interface ExecuteRequest {
  taskId: string;
  prompt: string;
  cwd: string;                  // 工作目录（绝对路径）
  timeout: number;              // 秒
  signal: AbortSignal;
  onOutput?: (chunk: string) => void;
  onProgress?: (percent: number) => void;
  metadata?: Record<string, string>;
}

export interface ExecuteResult {
  taskId: string;
  exitCode: number;
  output: string;               // 完整输出
  changedFiles: ChangedFile[];
  duration: number;             // ms
  agentName: string;
  adapterType: string;
  pid?: number;                 // 子进程 PID
}

export interface ChangedFile {
  path: string;
  changeType: 'created' | 'modified' | 'deleted';
  sizeBytes: number;
  hashBefore?: string;          // SHA-256
  hashAfter?: string;           // SHA-256
}
```

### 6.2 CLI Adapter 详细实现

CLI Adapter 是 MVP 阶段的核心 Adapter，通过 `child_process.spawn` 启动 AI 编码工具。

#### 6.2.1 选型理由

**为什么选择 subprocess 而不是其他方案？**
1. **通用性**：所有 AI 编码工具（codex、pi、openclaw acp）都支持 CLI
2. **跨平台**：Node.js 的 `child_process` 在 macOS/Windows/Linux 行为一致
3. **零 IDE 依赖**：不需要安装任何 IDE 扩展
4. **可观测性**：可以直接捕获 stdout/stderr，实时输出回传
5. **资源控制**：通过 signal、timeout 可以精确控制子进程生命周期

#### 6.2.2 子进程管理

```typescript
// adapters/cli-adapter.ts

import { spawn, ChildProcess, SignalConstants } from 'child_process';
import { createHash } from 'crypto';
import { stat } from 'fs/promises';
import { resolve, join } from 'path';
import { EventEmitter } from 'events';
import { AgentAdapter, ExecuteRequest, ExecuteResult, ChangedFile } from './types';
import { Logger } from '../utils/logger';
import { findExecutable } from '../platform/editors';

interface AgentConfig {
  command: string;
  args: string[];
  timeout: number;
  env: Record<string, string>;
  maxOutputBytes: number;
}

export class CLIAdapter extends EventEmitter implements AgentAdapter {
  readonly type: string;
  readonly agentName: string;
  private config: AgentConfig;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private logger: Logger;

  constructor(agentName: string, config: AgentConfig) {
    super();
    this.agentName = agentName;
    this.type = `cli:${agentName}`;
    this.config = config;
    this.logger = new Logger(`CLIAdapter:${agentName}`);
  }

  async isAvailable(): Promise<AdapterAvailability> {
    try {
      const execPath = await findExecutable(this.config.command);
      const version = await this.getVersion();
      return { available: true, executablePath: execPath, version };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const execPath = await findExecutable(this.config.command);
      const { execSync } = require('child_process');
      const output = execSync(`${execPath} --version`, {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      return output;
    } catch {
      return null;
    }
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResult> {
    const startTime = Date.now();
    const outputChunks: Buffer[] = [];
    let totalBytes = 0;

    // 1. 快照当前文件状态（用于检测变更）
    const fileSnapshot = await this.snapshotFiles(request.cwd);

    // 2. 构建命令参数
    const args = this.buildArgs(request);

    // 3. 启动子进程
    const child = spawn(this.config.command, args, {
      cwd: request.cwd,
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      // Windows 特殊处理：不创建新窗口
      windowsHide: true,
      shell: process.platform === 'win32',
    });

    this.activeProcesses.set(request.taskId, child);
    const pid = child.pid!;

    this.logger.info(`子进程启动: PID=${pid}, cmd=${this.config.command} ${args.join(' ')}`);

    // 4. 设置超时
    const timeoutHandle = setTimeout(() => {
      this.logger.warn(`任务 ${request.taskId} 超时 (${request.timeout}s)，发送 SIGTERM`);
      child.kill('SIGTERM');

      // 5 秒后如果还没退出，SIGKILL
      setTimeout(() => {
        if (child.exitCode === null) {
          this.logger.warn(`任务 ${request.taskId} 子进程未响应 SIGTERM，发送 SIGKILL`);
          child.kill('SIGKILL');
        }
      }, 5000);
    }, request.timeout * 1000);

    // 5. 捕获输出
    child.stdout?.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes <= this.config.maxOutputBytes) {
        outputChunks.push(chunk);
      }
      request.onOutput?.(chunk.toString());
      this.emit('output', request.taskId, chunk.toString());
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes <= this.config.maxOutputBytes) {
        outputChunks.push(chunk);
      }
      this.logger.warn(`[stderr] ${chunk.toString()}`);
    });

    // 6. 等待退出
    const exitCode = await new Promise<number>((resolve) => {
      child.on('close', (code) => resolve(code ?? 1));
      child.on('error', (error) => {
        this.logger.error(`子进程错误: ${error.message}`);
        resolve(1);
      });

      // 支持 abort signal
      request.signal.addEventListener('abort', () => {
        this.logger.info(`任务 ${request.taskId} 被 abort`);
        child.kill('SIGTERM');
      }, { once: true });
    });

    clearTimeout(timeoutHandle);
    this.activeProcesses.delete(request.taskId);

    const duration = Date.now() - startTime;
    const output = Buffer.concat(outputChunks).toString('utf-8');

    // 7. 检测文件变更
    const changedFiles = await this.detectChanges(request.cwd, fileSnapshot);

    const result: ExecuteResult = {
      taskId: request.taskId,
      exitCode,
      output,
      changedFiles,
      duration,
      agentName: this.agentName,
      adapterType: this.type,
      pid,
    };

    this.logger.info(`任务完成: ${request.taskId}, exitCode=${exitCode}, duration=${duration}ms, files=${changedFiles.length}`);
    return result;
  }

  async cancel(taskId: string): Promise<void> {
    const child = this.activeProcesses.get(taskId);
    if (!child) {
      this.logger.warn(`cancel: 任务 ${taskId} 没有活跃的子进程`);
      return;
    }

    this.logger.info(`取消任务 ${taskId} (PID: ${child.pid})`);
    child.kill('SIGTERM');

    // 等待 5 秒
    await new Promise(resolve => setTimeout(resolve, 5000));
    if (child.exitCode === null) {
      child.kill('SIGKILL');
    }

    this.activeProcesses.delete(taskId);
  }

  private buildArgs(request: ExecuteRequest): string[] {
    const baseArgs = [...this.config.args];

    switch (this.agentName) {
      case 'codex':
        // codex 接受 prompt 作为位置参数
        return [...baseArgs, request.prompt];
      case 'pi':
        // pi 接受 prompt 作为位置参数
        return [...baseArgs, request.prompt];
      case 'acp':
        // openclaw acp 是交互式的，通过 stdin 发送 prompt
        return baseArgs;
      default:
        return [...baseArgs, request.prompt];
    }
  }

  private async snapshotFiles(cwd: string): Promise<Map<string, string>> {
    // 递归扫描项目目录，记录文件 hash
    // 注意：排除 node_modules, .git, dist 等目录
    const snapshot = new Map<string, string>();
    const excludeDirs = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', '.venv']);

    async function walk(dir: string): Promise<void> {
      const { readdir, readFile } = await import('fs/promises');
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!excludeDirs.has(entry.name)) {
            await walk(join(dir, entry.name));
          }
        } else {
          const fullPath = join(dir, entry.name);
          try {
            const content = await readFile(fullPath);
            const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
            snapshot.set(fullPath, hash);
          } catch {
            // 跳过无法读取的文件
          }
        }
      }
    }

    try {
      await walk(cwd);
    } catch {
      // 部分目录可能无权限
    }

    return snapshot;
  }

  private async detectChanges(cwd: string, before: Map<string, string>): Promise<ChangedFile[]> {
    const after = await this.snapshotFiles(cwd);
    const changes: ChangedFile[] = [];

    // 检测修改和删除
    for (const [path, hash] of before) {
      const afterHash = after.get(path);
      if (!afterHash) {
        changes.push({ path, changeType: 'deleted', sizeBytes: 0, hashBefore: hash });
      } else if (hash !== afterHash) {
        try {
          const statResult = await stat(path);
          changes.push({
            path,
            changeType: 'modified',
            sizeBytes: statResult.size,
            hashBefore: hash,
            hashAfter: afterHash,
          });
        } catch {
          changes.push({ path, changeType: 'modified', sizeBytes: 0, hashBefore: hash, hashAfter: afterHash });
        }
      }
    }

    // 检测新增
    for (const [path, hash] of after) {
      if (!before.has(path)) {
        try {
          const statResult = await stat(path);
          changes.push({ path, changeType: 'created', sizeBytes: statResult.size, hashAfter: hash });
        } catch {
          changes.push({ path, changeType: 'created', sizeBytes: 0, hashAfter: hash });
        }
      }
    }

    return changes;
  }

  async dispose(): Promise<void> {
    // Kill 所有活跃子进程
    for (const [taskId, child] of this.activeProcesses) {
      this.logger.warn(`dispose: 杀死活跃进程 ${taskId} (PID: ${child.pid})`);
      child.kill('SIGTERM');
    }
    this.activeProcesses.clear();
  }
}
```

#### 6.2.3 文件变更检测的性能考量

**问题**：`snapshotFiles` 递归扫描大项目可能很慢（数千文件）。

**优化策略**：
1. **排除大目录**：`node_modules`、`.git`、`dist`、`__pycache__`、`.venv`、`target`（Rust）
2. **只扫描代码文件**：通过扩展名白名单过滤（`.py`、`.ts`、`.tsx`、`.js`、`.jsx`、`.go`、`.rs`、`.java` 等）
3. **增量快照**：维护一个全局 file index，只扫描有变更的目录
4. **超时控制**：快照操作本身设置 10 秒超时

```typescript
// 文件扩展名白名单
const CODE_EXTENSIONS = new Set([
  '.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.go', '.rs', '.java', '.kt', '.scala', '.c', '.cpp', '.h',
  '.sql', '.sh', '.bash', '.ps1',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.mdx', '.txt',
  '.html', '.css', '.scss', '.less', '.sass',
  '.vue', '.svelte',
]);

function shouldTrackFile(path: string): boolean {
  return CODE_EXTENSIONS.has(path.slice(path.lastIndexOf('.')));
}
```

### 6.3 Adapter 注册表

```typescript
// adapters/registry.ts

export class AdapterRegistry {
  private adapters: Map<string, AgentAdapter> = new Map();
  private logger: Logger;

  constructor(adaptersConfig: BridgeConfig['adapters']) {
    this.logger = new Logger('AdapterRegistry');

    // 注册 CLI Adapters
    if (adaptersConfig.cli?.codex) {
      this.register(new CLIAdapter('codex', adaptersConfig.cli.codex));
    }
    if (adaptersConfig.cli?.pi) {
      this.register(new CLIAdapter('pi', adaptersConfig.cli.pi));
    }
    if (adaptersConfig.cli?.acp) {
      this.register(new CLIAdapter('acp', adaptersConfig.cli.acp));
    }

    // Phase 2: 注册 IDE Adapters
    // this.register(new VSCodeAdapter(adaptersConfig.vscode));
    // this.register(new CursorAdapter(adaptersConfig.cursor));
  }

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.type, adapter);
    this.logger.info(`注册 Adapter: ${adapter.type} (${adapter.agentName})`);
  }

  get(type: string): AgentAdapter | undefined {
    return this.adapters.get(type);
  }

  getByAgentName(name: string): AgentAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.agentName === name) return adapter;
    }
    return undefined;
  }

  async detectAvailable(): Promise<AgentAdapter[]> {
    const results = await Promise.allSettled(
      Array.from(this.adapters.values()).map(async (adapter) => ({
        adapter,
        availability: await adapter.isAvailable(),
      }))
    );

    const available: AgentAdapter[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.availability.available) {
        available.push(result.value.adapter);
      } else if (result.status === 'rejected') {
        this.logger.warn(`检测 Adapter 失败: ${result.reason}`);
      } else if (result.status === 'fulfilled' && !result.value.availability.available) {
        this.logger.info(`Adapter 不可用: ${result.value.adapter.type} - ${result.value.availability.reason}`);
      }
    }

    return available;
  }

  async resolve(agentType: string): Promise<AgentAdapter> {
    // 1. 精确匹配
    let adapter = this.get(agentType);
    if (adapter) {
      const avail = await adapter.isAvailable();
      if (avail.available) return adapter;
      throw new Error(`Agent '${agentType}' 不可用: ${avail.reason}`);
    }

    // 2. 按 agentName 匹配
    adapter = this.getByAgentName(agentType);
    if (adapter) {
      const avail = await adapter.isAvailable();
      if (avail.available) return adapter;
      throw new Error(`Agent '${agentType}' 不可用: ${avail.reason}`);
    }

    // 3. 返回所有可用 Adapter（让 Gateway 重新选择）
    const available = await this.detectAvailable();
    const names = available.map(a => a.type).join(', ');
    throw new Error(`Agent '${agentType}' 未注册。可用: ${names}`);
  }

  async dispose(): Promise<void> {
    await Promise.all(
      Array.from(this.adapters.values()).map(a => a.dispose())
    );
    this.adapters.clear();
  }
}
```

### 6.4 IDE Adapter 预留设计（Phase 2/3）

#### 6.4.1 VS Code / Cursor 集成方案（选定：文件队列）

**选型理由**：
- 不依赖 VS Code MCP 协议（已确认不兼容）
- 不依赖任何 VS Code 扩展 API 的内部接口（版本不稳定）
- 利用文件系统 + VS Code 原生文件监听能力，最稳定
- Mac/Windows/Linux 文件系统事件 API 均可覆盖

**实现规格**：

**任务文件格式**（`{taskDir}/incoming/{taskId}.json`）：

```json
{
  "taskId": "task-uuid-001",
  "status": "pending",
  "prompt": "修复 approval.py 的 SQL 注入问题",
  "projectPath": "/Users/liuh/projects/agent-orchestration",
  "agentType": "vscode-cc",
  "createdAt": "2026-03-13T23:00:00.000Z",
  "timeout": 600
}
```

**结果文件格式**（`{taskDir}/outgoing/{taskId}.result.json`）：

```json
{
  "taskId": "task-uuid-001",
  "status": "completed",
  "exitCode": 0,
  "output": "已修复...",
  "changedFiles": ["backend/app/services/approval.py"],
  "duration": 45000,
  "completedAt": "2026-03-13T23:00:45.000Z"
}
```

**文件目录结构**：

```
/tmp/oc-tasks/                    # Mac/Linux
%TEMP%/oc-tasks/                  # Windows
├── incoming/                     # Bridge 写入，VS Code 扩展读取
│   ├── task-001.json
│   └── task-002.json
├── outgoing/                     # VS Code 扩展写入，Bridge 读取
│   ├── task-001.result.json
│   └── task-002.result.json
└── lock/                         # 文件锁（防止并发读写）
    └── task-001.lock
```

**VS Code 扩展行为**：
1. 启动时创建 `FileSystemWatcher` 监听 `incoming/` 目录
2. 检测到新文件 → 读取任务 → 在 VS Code 终端执行命令
3. 命令执行完毕 → 写入 `outgoing/{taskId}.result.json`
4. 删除 `incoming/{taskId}.json`

**Bridge 行为**：
1. 写入 `incoming/{taskId}.json`
2. 启动 `FileSystemWatcher` 监听 `outgoing/` 目录
3. 检测到结果文件 → 读取 → 删除 → 回传 Gateway

#### 6.4.2 JetBrains IDE 集成方案（Phase 3 预留）

JetBrains IDE 提供内置 HTTP API（通过 Registry port），可以无需扩展直接集成：

```
Bridge → HTTP POST http://localhost:63342/api/ai/execute
          body: { "prompt": "...", "projectPath": "..." }
          ↓
IntelliJ IDEA 内部 AI Assistant 执行
          ↓
Bridge ← HTTP Response (异步，通过 polling 或 callback)
```

**优势**：不需要开发 Kotlin 插件，利用 JetBrains 内置 API
**风险**：HTTP API 可能因版本变化而不同，需要版本检测和适配

---

## 第7章 Gateway 集成设计

### 7.1 Bridge Manager

Gateway 侧新增 `BridgeManager` 模块，管理所有注册的 Bridge 实例。

```typescript
// gateway/bridge-manager.ts

interface BridgeManagerConfig {
  heartbeatTimeout: number;       // 心跳超时（秒），默认 90（3次心跳未响应）
  taskReassignDelay: number;      // 断线后多久重新分配任务（秒），默认 90
  maxBridges: number;             // 最大 Bridge 数，默认 20
}

class BridgeManager {
  private bridges: Map<string, ManagedBridge> = new Map();
  private taskToBridge: Map<string, string> = new Map(); // taskId → bridgeId
  private config: BridgeManagerConfig;

  /** 注册 Bridge */
  register(bridge: ManagedBridge): void {
    this.bridges.set(bridge.bridgeId, bridge);
  }

  /** 更新心跳 */
  heartbeat(bridgeId: string, stats: BridgeStats): void {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) return;
    bridge.lastHeartbeat = Date.now();
    bridge.status = 'online';
    bridge.activeTaskCount = stats.activeTasks;
    bridge.memoryUsage = stats.memoryUsage;
  }

  /** 检测超时 Bridge */
  checkTimeouts(): string[] {
    const now = Date.now();
    const timedOut: string[] = [];

    for (const [id, bridge] of this.bridges) {
      if (bridge.status !== 'online') continue;
      if (now - bridge.lastHeartbeat > this.config.heartbeatTimeout * 1000) {
        bridge.status = 'offline';
        timedOut.push(id);

        // 标记该 Bridge 的运行中任务为 interrupted
        for (const [taskId, bId] of this.taskToBridge) {
          if (bId === id) {
            this.updateTaskStatus(taskId, 'interrupted');
          }
        }
      }
    }

    return timedOut;
  }

  /** 选择最佳 Bridge 执行任务 */
  selectBridge(task: TaskSubmit): ManagedBridge | null {
    const candidates = Array.from(this.bridges.values()).filter(b =>
      b.status === 'online' &&
      b.activeTaskCount < b.maxConcurrent &&
      b.availableAdapters.some(a => a.agentName === task.agentType || a.type === task.agentType)
    );

    if (candidates.length === 0) return null;

    // 排序：负载最低 → 平台匹配 → 最后注册（最新的最可能活跃）
    candidates.sort((a, b) => {
      if (a.activeTaskCount !== b.activeTaskCount) return a.activeTaskCount - b.activeTaskCount;

      // IDE 偏好匹配
      if (task.preferredIde) {
        const aHasIDE = a.activeIDEs?.some(ide => ide.name === task.preferredIde);
        const bHasIDE = b.activeIDEs?.some(ide => ide.name === task.preferredIde);
        if (aHasIDE !== bHasIDE) return aHasIDE ? -1 : 1;
      }

      return 0;
    });

    return candidates[0];
  }

  /** 提交任务到选定 Bridge */
  async submitTask(task: TaskSubmit): Promise<{ bridgeId: string; taskId: string }> {
    const bridge = this.selectBridge(task);
    if (!bridge) {
      throw new Error('NO_AVAILABLE_BRIDGE');
    }

    const taskId = this.generateTaskId();
    task.taskId = taskId;

    await this.wsServer.sendToBridge(bridge.bridgeId, {
      type: 'task.submit',
      payload: task,
    });

    this.taskToBridge.set(taskId, bridge.bridgeId);
    bridge.activeTaskCount++;

    return { bridgeId: bridge.bridgeId, taskId };
  }

  /** Bridge 重连时的状态恢复 */
  async handleReconnect(bridgeId: string, recoveringTasks: RecoveredTask[]): Promise<RecoveryResult> {
    const confirmed: string[] = [];
    const requeued: string[] = [];
    const cancelled: string[] = [];

    for (const task of recoveringTasks) {
      const currentStatus = this.getTaskStatus(task.taskId);

      if (currentStatus === 'interrupted' || currentStatus === 'pending') {
        if (task.status === 'running' && task.pid) {
          // Bridge 说在跑，Gateway 说中断了 → 以 Bridge 为准（子进程可能还活着）
          confirmed.push(task.taskId);
          this.updateTaskStatus(task.taskId, 'running');
        } else {
          requeued.push(task.taskId);
        }
      } else if (currentStatus === 'completed' || currentStatus === 'failed') {
        // 任务已在其他 Bridge 上完成
        cancelled.push(task.taskId);
      } else {
        confirmed.push(task.taskId);
      }
    }

    return { confirmed, requeued, cancelled };
  }
}
```

### 7.2 编排系统 RemoteAgentEngine

```python
# backend/app/services/remote_agent_engine.py

import aiohttp
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class RemoteAgentEngine:
    """
    远端 Agent 执行引擎。
    
    通过 HTTP API 调用本地 Bridge 服务，Bridge 再通过 WebSocket 调度到远端 Agent。
    
    架构：
        编排系统 (FastAPI) → HTTP → Bridge (本地/远端) → CLI Agent / IDE Agent
    
    为什么通过 HTTP 而不是直接 WebSocket？
    - 编排系统是 Python/FastAPI，Bridge 是 Node.js
    - HTTP 更简单，不需要维护长连接状态
    - Bridge 的 HTTP API 是 Bridge 自身提供的，不依赖 Gateway
    """

    def __init__(
        self,
        bridge_url: str = "http://127.0.0.1:18790",
        timeout: int = 300,
        api_key: Optional[str] = None,
    ):
        self.bridge_url = bridge_url.rstrip("/")
        self.timeout = timeout
        self.api_key = api_key

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def submit_task(
        self,
        prompt: str,
        project_path: str,
        agent_type: str = "codex",
        timeout: Optional[int] = None,
        priority: str = "normal",
        preferred_ide: Optional[str] = None,
        callback_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """提交开发任务到 Bridge"""
        payload = {
            "prompt": prompt,
            "projectPath": project_path,
            "agentType": agent_type,
            "timeout": timeout or self.timeout,
            "priority": priority,
        }
        if preferred_ide:
            payload["preferredIde"] = preferred_ide
        if callback_id:
            payload["callbackId"] = callback_id

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.bridge_url}/api/v1/tasks",
                json=payload,
                headers=self._headers(),
                timeout=aiohttp.ClientTimeout(total=30),  # HTTP 超时，不是任务超时
            ) as resp:
                if resp.status != 201:
                    body = await resp.text()
                    raise RemoteAgentError(
                        f"Bridge 返回错误: {resp.status} - {body}"
                    )
                result = await resp.json()

        logger.info(f"任务已提交: taskId={result['taskId']}, bridge={result.get('bridgeId', 'local')}")
        return result

    async def get_task(self, task_id: str) -> Dict[str, Any]:
        """查询任务状态"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.bridge_url}/api/v1/tasks/{task_id}",
                headers=self._headers(),
            ) as resp:
                if resp.status == 404:
                    raise RemoteAgentError(f"任务不存在: {task_id}")
                return await resp.json()

    async def cancel_task(self, task_id: str, reason: str = "用户取消") -> Dict[str, Any]:
        """取消任务"""
        async with aiohttp.ClientSession() as session:
            async with session.delete(
                f"{self.bridge_url}/api/v1/tasks/{task_id}",
                json={"reason": reason},
                headers=self._headers(),
            ) as resp:
                return await resp.json()

    async def list_agents(self) -> List[Dict[str, Any]]:
        """列出可用 Agent"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.bridge_url}/api/v1/agents",
                headers=self._headers(),
            ) as resp:
                return await resp.json()

    async def wait_for_task(
        self, task_id: str, poll_interval: float = 2.0, timeout: float = 3600.0
    ) -> Dict[str, Any]:
        """等待任务完成（轮询）"""
        elapsed = 0.0
        while elapsed < timeout:
            task = await self.get_task(task_id)
            if task["status"] in ("completed", "failed", "cancelled", "timed_out"):
                return task
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        raise RemoteAgentError(f"等待任务超时: {task_id}")


class RemoteAgentError(Exception):
    """远端 Agent 执行错误"""
    pass
```

### 7.3 Workflow 集成

在 `lobster_engine.py` 中添加 `remote-agent` 执行模式：

```python
# lobster_engine.py 新增

class LobsterEngine:
    def __init__(self):
        # ... 现有初始化 ...
        self.remote_engine = RemoteAgentEngine()

    async def execute_step(self, step, context):
        execution_mode = step.config.get("mode", "local")

        if execution_mode == "remote-agent":
            return await self.remote_engine.submit_task(
                prompt=step.config.get("prompt", context.get("prompt", "")),
                project_path=step.config.get("project_path", ""),
                agent_type=step.config.get("agent_type", "codex"),
                timeout=step.config.get("timeout", 300),
                preferred_ide=step.config.get("preferred_ide"),
            )
        else:
            # 现有的 subprocess.run() 逻辑
            return await self.execute_local(step, context)
```

**Workflow 定义示例**：

```json
{
  "name": "ORM 迁移开发",
  "version": "1.0",
  "steps": [
    {
      "id": "arch-review",
      "type": "agent",
      "mode": "remote-agent",
      "agent": "codex",
      "prompt": "分析当前 ORM 迁移方案，检查 SQLAlchemy 2.0 兼容性",
      "projectPath": "/Users/liuh/projects/agent-orchestration",
      "preferredIde": "cursor",
      "timeout": 120
    },
    {
      "id": "dev-migrate",
      "type": "agent",
      "mode": "remote-agent",
      "agent": "codex",
      "prompt": "将 backend/app/services/task.py 迁移到 SQLAlchemy 2.0 ORM，使用 select()/insert()/update() 风格",
      "projectPath": "/Users/liuh/projects/agent-orchestration",
      "dependsOn": ["arch-review"],
      "timeout": 300
    },
    {
      "id": "test",
      "type": "agent",
      "mode": "remote-agent",
      "agent": "cli",
      "prompt": "运行 pytest backend/tests/ -v",
      "projectPath": "/Users/liuh/projects/agent-orchestration",
      "dependsOn": ["dev-migrate"],
      "timeout": 120
    }
  ]
}
```

---

## 第8章 API 接口规范

### 8.1 Bridge HTTP API

Bridge 在本地暴露 RESTful HTTP API（默认 `127.0.0.1:18790`），供编排系统和本地工具调用。

#### 8.1.1 提交任务

```
POST /api/v1/tasks
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "prompt": "修复 SQL 注入问题",
  "projectPath": "/Users/liuh/projects/agent-orchestration",
  "agentType": "codex",
  "timeout": 300,
  "priority": "normal",
  "preferredIde": "cursor",
  "callbackId": "wf-001-step-01"
}

Response (201 Created):
{
  "taskId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "queued",
  "bridgeId": "bridge-mac-001",
  "createdAt": "2026-03-13T23:00:00.000Z",
  "estimatedStart": "2026-03-13T23:00:01.000Z"
}

Response (429 Too Many Requests):
{
  "error": {
    "code": "QUEUE_FULL",
    "message": "任务队列已满 (max: 2 concurrent, 5 queued)",
    "retryAfter": 30
  }
}

Response (503 Service Unavailable):
{
  "error": {
    "code": "AGENT_UNAVAILABLE",
    "message": "Agent 'codex' 不可用: executable not found",
    "availableAgents": ["pi"]
  }
}
```

#### 8.1.2 查询任务状态

```
GET /api/v1/tasks/{taskId}

Response (200 OK):
{
  "taskId": "a1b2c3d4-...",
  "status": "running",
  "agentType": "codex",
  "agentName": "codex",
  "adapterType": "cli",
  "prompt": "修复 SQL 注入问题",
  "projectPath": "/Users/liuh/projects/agent-orchestration",
  "progress": 65,
  "output": "正在修改 approval.py...",
  "exitCode": null,
  "startedAt": "2026-03-13T23:00:01.000Z",
  "completedAt": null,
  "duration": 45000,
  "changedFiles": [],
  "retryCount": 0
}

Response (404 Not Found):
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "任务 a1b2c3d4-... 不存在"
  }
}
```

#### 8.1.3 取消任务

```
DELETE /api/v1/tasks/{taskId}
Content-Type: application/json

Request:
{
  "reason": "用户取消"
}

Response (200 OK):
{
  "taskId": "a1b2c3d4-...",
  "status": "cancelled",
  "reason": "用户取消",
  "cancelledAt": "2026-03-13T23:00:30.000Z"
}
```

#### 8.1.4 列出任务

```
GET /api/v1/tasks?status=running&limit=10&offset=0

Response (200 OK):
{
  "tasks": [...],
  "total": 25,
  "limit": 10,
  "offset": 0
}
```

#### 8.1.5 列出可用 Agent

```
GET /api/v1/agents

Response (200 OK):
{
  "agents": [
    {
      "type": "cli:codex",
      "agentName": "codex",
      "available": true,
      "version": "0.114.0",
      "executablePath": "/usr/local/bin/codex"
    },
    {
      "type": "cli:pi",
      "agentName": "pi",
      "available": true,
      "version": "1.2.0",
      "executablePath": "/usr/local/bin/pi"
    }
  ]
}
```

#### 8.1.6 健康检查

```
GET /api/v1/health

Response (200 OK):
{
  "status": "healthy",
  "bridgeId": "bridge-mac-001",
  "gatewayConnected": true,
  "uptime": 86400,
  "activeTasks": 1,
  "queuedTasks": 2,
  "memoryUsage": { "rss": 85400000, "heapTotal": 67108864 },
  "availableAgents": ["cli:codex", "cli:pi"]
}
```

#### 8.1.7 Bridge 状态

```
GET /api/v1/status

Response (200 OK):
{
  "bridgeId": "bridge-mac-001",
  "state": "ready",
  "platform": "darwin",
  "hostname": "MacBook-Pro.local",
  "version": "1.0.0",
  "gateway": {
    "connected": true,
    "url": "wss://81.70.98.45",
    "lastHeartbeat": "2026-03-13T23:00:00.000Z"
  },
  "tasks": {
    "active": 1,
    "queued": 2,
    "completed": 150,
    "failed": 5
  },
  "adapters": {
    "available": ["cli:codex", "cli:pi"],
    "unavailable": []
  }
}
```

### 8.2 错误码体系

#### 8.2.1 错误响应格式

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "任务 a1b2c3d4-... 不存在",
    "details": {},
    "timestamp": "2026-03-13T23:00:00.000Z",
    "requestId": "req-uuid-001"
  }
}
```

#### 8.2.2 错误码分类

| 类别 | 错误码 | HTTP 状态码 | 含义 | 处理建议 |
|------|--------|------------|------|---------|
| **认证** | `AUTH_REQUIRED` | 401 | 缺少 Authorization header | 添加 Bearer token |
| | `AUTH_INVALID_TOKEN` | 401 | Token 无效或过期 | 刷新 token |
| | `AUTH_FORBIDDEN` | 403 | 无权执行此操作 | 检查权限 |
| **任务** | `TASK_NOT_FOUND` | 404 | 任务不存在 | 检查 taskId |
| | `TASK_ALREADY_COMPLETED` | 409 | 任务已完成，不能重复操作 | 不需要处理 |
| | `TASK_REJECTED` | 422 | Agent 不可用或参数无效 | 检查 agentType |
| | `TASK_TIMEOUT` | 504 | 任务执行超时 | 增大 timeout 或重试 |
| **队列** | `QUEUE_FULL` | 429 | 任务队列已满 | 等待后重试 |
| **Agent** | `AGENT_UNAVAILABLE` | 503 | Agent 不可用 | 切换到其他 Agent |
| | `AGENT_CRASHED` | 500 | Agent 进程崩溃 | 检查日志，重试 |
| **Bridge** | `BRIDGE_OFFLINE` | 503 | Bridge 未连接 Gateway | 等待重连 |
| | `BRIDGE_SHUTTING_DOWN` | 503 | Bridge 正在关闭 | 等待重启 |
| **系统** | `INTERNAL_ERROR` | 500 | 内部错误 | 查看日志 |
| | `DATABASE_ERROR` | 500 | 数据库错误 | 检查磁盘空间 |
| | `CONFIG_ERROR` | 500 | 配置错误 | 检查配置文件 |

### 8.3 API 版本管理

- URL 路径前缀：`/api/v1/`
- 版本策略：主版本号递增（v1 → v2），不兼容变更时才升级
- 兼容变更（新增字段、新增 endpoint）不升级版本
- 废弃 API 保留 2 个大版本
- 响应 header 包含：`X-API-Version: v1`

---

## 第9章 安全设计

### 9.1 Token 认证

#### 9.1.1 认证流程

```
Bridge 启动
    │
    ▼
读取 token 文件
{configDir}/gateway.token     (默认)
OC_BRIDGE_GATEWAY_TOKEN      (环境变量覆盖)
    │
    ▼
WebSocket 连接建立
    │
    ▼
发送 auth.request { token }
    │
    ▼
Gateway 验证 token
    │
    ├── token 有效 ──► auth.response { success: true, bridgeId }
    │
    └── token 无效 ──► auth.response { success: false, errorCode }
                       关闭连接
```

#### 9.1.2 Token 安全要求

| 要求 | 实现 |
|------|------|
| 文件权限 | 600（仅 owner 可读写） |
| 不在命令行 | 通过 `--token-file` 参数传递文件路径，不传递 token 值 |
| 不在日志中 | 日志中 token 显示为 `***` |
| 不在代码中 | 不硬编码在源码中 |
| 传输安全 | 通过 TLS 1.2+ 传输，不暴露明文 |

#### 9.1.3 Token 刷新机制（Phase 4 预留）

当前版本使用静态 token。后续支持：
- Token 有效期（默认 90 天）
- Token 轮换（新 token 生效后，旧 token 在 24 小时内失效）
- Bridge 收到 `token.expiring` 通知后主动刷新

### 9.2 传输加密

#### 9.2.1 TLS 配置

| 参数 | 值 | 说明 |
|------|-----|------|
| 最低 TLS 版本 | 1.2 | 排除 TLS 1.0/1.1 的已知漏洞 |
| 证书类型 | 自签名（当前） | 后续替换为 Let's Encrypt |
| 自签名证书处理 | Bridge 设置 `NODE_TLS_REJECT_UNAUTHORIZED=0` | 仅限开发环境 |
| 证书固定 | 不启用 | 开发环境不方便，生产环境可开启 |
| 加密套件 | 默认 | Node.js 默认套件已足够安全 |

#### 9.2.2 自签名证书安全风险

- **中间人攻击**：无 CA 验证，攻击者可以伪造证书
- **缓解**：Token 认证提供第二层保护（即使证书被伪造，没有 token 也无法认证）
- **生产建议**：替换为 Let's Encrypt 证书，使用 DNS 验证

### 9.3 任务沙箱

#### 9.3.1 安全策略

```typescript
// security/sandbox.ts

interface SecurityPolicy {
  /** 允许执行的 CLI 命令 */
  allowedCommands: string[];

  /** 允许的项目路径前缀（空数组表示不限制） */
  allowedPaths: string[];

  /** Prompt 中被阻止的关键词 */
  blockedPatterns: RegExp[];

  /** 需要人工确认的 Agent 类型 */
  requireApprovalFor: string[];
}

const DEFAULT_POLICY: SecurityPolicy = {
  allowedCommands: ['codex', 'pi', 'openclaw', 'npx', 'node', 'python3', 'pip'],
  allowedPaths: [],  // 开发阶段不限制
  blockedPatterns: [
    /rm\s+-rf\s+\//,           // 删除根目录
    /sudo\s+/,                 // 提权
    /mkfs\./,                  // 格式化磁盘
    /:\s*>\s*\/dev\//,         // 写入设备文件
    /curl.*\|\s*bash/,         // 远程代码执行
    /wget.*\|\s*sh/,           // 远程代码执行
    /eval\s*\(/,               // eval 注入
  ],
  requireApprovalFor: [],
};

class TaskSandbox {
  constructor(private policy: SecurityPolicy = DEFAULT_POLICY) {}

  validate(task: TaskSubmit): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 检查 Agent 命令是否在白名单
    if (!this.policy.allowedCommands.some(cmd => task.agentType.includes(cmd))) {
      errors.push(`Agent '${task.agentType}' 不在允许列表中: ${this.policy.allowedCommands.join(', ')}`);
    }

    // 2. 检查项目路径
    if (this.policy.allowedPaths.length > 0) {
      const pathAllowed = this.policy.allowedPaths.some(prefix =>
        task.projectPath.startsWith(prefix)
      );
      if (!pathAllowed) {
        errors.push(`项目路径 '${task.projectPath}' 不在允许范围内`);
      }
    }

    // 3. 检查 prompt 中的危险关键词
    for (const pattern of this.policy.blockedPatterns) {
      if (pattern.test(task.prompt)) {
        errors.push(`Prompt 包含被阻止的模式: ${pattern.source}`);
      }
    }

    // 4. 检查是否需要审批
    if (this.policy.requireApprovalFor.includes(task.agentType)) {
      warnings.push(`Agent '${task.agentType}' 需要人工确认`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

### 9.4 审计日志

#### 9.4.1 日志 Schema

```json
{
  "id": 1,
  "bridgeId": "bridge-mac-001",
  "taskId": "task-uuid-001",
  "action": "task.submit",
  "actor": "gateway",
  "timestamp": "2026-03-13T23:00:00.000Z",
  "details": {
    "agentType": "codex",
    "prompt": "修复 SQL 注入...",
    "callerIp": "81.70.98.45"
  },
  "ipAddress": "81.70.98.45"
}
```

#### 9.4.2 审计事件类型

| action | 记录内容 |
|--------|---------|
| `auth.login` | Bridge 认证成功/失败 |
| `bridge.register` | Bridge 注册（含平台、IDE 信息） |
| `bridge.deregister` | Bridge 下线 |
| `task.submit` | 任务提交（含 prompt、Agent、路径） |
| `task.start` | 任务开始执行 |
| `task.progress` | 任务进度更新 |
| `task.complete` | 任务完成（含 exit code、变更文件） |
| `task.cancel` | 任务取消（含取消原因） |
| `task.fail` | 任务失败（含错误信息） |
| `task.timeout` | 任务超时 |
| `config.change` | 配置变更 |
| `security.violation` | 安全策略违规 |

---

## 第10章 容错与可靠性

### 10.1 断线重连

```typescript
// ws-client.ts

class WSClient {
  private reconnectConfig = {
    enabled: true,
    maxRetries: Infinity,
    baseDelay: 1000,
    maxDelay: 60000,
    jitter: 1000,
  };

  private currentRetry = 0;

  async connect(): Promise<void> {
    while (this.reconnectConfig.enabled && this.currentRetry < this.reconnectConfig.maxRetries) {
      try {
        const ws = await this.createConnection();
        this.currentRetry = 0; // 重置计数
        return ws;
      } catch (error) {
        this.currentRetry++;
        const delay = this.calculateDelay(this.currentRetry);
        this.logger.warn(`重连 ${this.currentRetry}/${this.reconnectConfig.maxRetries}, ${delay}ms 后重试`);
        await this.sleep(delay);
      }
    }
    throw new Error(`重连失败: 已达最大重试次数 ${this.reconnectConfig.maxRetries}`);
  }

  private calculateDelay(retry: number): number {
    const exponential = Math.min(
      this.reconnectConfig.baseDelay * Math.pow(2, retry - 1),
      this.reconnectConfig.maxDelay
    );
    const jitter = Math.random() * this.reconnectConfig.jitter;
    return exponential + jitter;
  }
}
```

### 10.2 Checkpoint 策略

Bridge 崩溃后需要恢复的状态：

| 状态 | 保存内容 | 恢复策略 |
|------|---------|---------|
| **running** | taskId, agentType, prompt, projectPath, pid | 检查 PID 是否存活 → 恢复或标记失败 |
| **queued** | taskId, agentType, prompt, projectPath | 重新入队 |
| **completed/failed** | taskId, result | 不需要恢复 |

**Checkpoint 保存时机**：
1. 任务状态变更时（queued → running → completed/failed）
2. 定时保存（默认 5 秒）
3. 优雅退出时

**幂等性保证**：
- 任务通过 `taskId` 唯一标识
- 重复提交相同 taskId 的任务 → 返回当前状态
- Gateway ACK 机制确保消息不丢失

### 10.3 任务重试策略

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  retryableStatuses: ['failed', 'timed_out'],
  retryableErrors: ['TIMEOUT', 'PROCESS_CRASH', 'CONNECTION_LOST'],
  backoff: [5000, 15000, 45000], // 5s, 15s, 45s
  jitter: 1000,
};

async function maybeRetry(task: Task, retryCount: number): Promise<RetryDecision> {
  if (retryCount >= RETRY_CONFIG.maxRetries) {
    return { retry: false, reason: 'Max retries reached' };
  }
  if (!RETRY_CONFIG.retryableStatuses.includes(task.status)) {
    return { retry: false, reason: `Status ${task.status} is not retryable` };
  }
  if (task.error_message && !RETRY_CONFIG.retryableErrors.some(e =>
    task.error_message.toUpperCase().includes(e)
  )) {
    return { retry: false, reason: `Error ${task.error_message} is not retryable` };
  }

  const delay = RETRY_CONFIG.backoff[retryCount] + Math.random() * RETRY_CONFIG.jitter;
  return { retry: true, delay };
}
```

### 10.4 网络分区处理

```
场景：Gateway 与 Bridge 之间网络断开

Gateway 侧：
1. 心跳超时（3次 × 30s = 90s）→ 标记 Bridge offline
2. Bridge 的 running 任务 → 标记 interrupted
3. Bridge 的 queued 任务 → 标记 pending（可分配给其他 Bridge）
4. 不立即删除 Bridge 注册（保留 24 小时）

Bridge 侧：
1. 检测断连 → 保存 checkpoint → 指数退避重连
2. 内存中 running 的任务 → 写入 SQLite（status=running）
3. 子进程继续运行（不杀）

恢复后：
1. Bridge 重连 → 发送 bridge.register（含 recoveringTasks）
2. Gateway 对比状态 → 确认/重排/取消
3. 如果 Bridge 的任务已被其他 Bridge 完成 → 取消
4. 如果任务还在 Bridge 的子进程中 → 确认恢复
```

---

## 第11章 性能与监控

### 11.1 性能指标基线

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| **任务提交延迟** | < 500ms（Gateway → Bridge → 入队） | 端到端时间戳差 |
| **心跳延迟** | < 100ms（ping → pong） | WebSocket RTT |
| **Bridge 启动时间** | < 3s（含 Adapter 检测） | 进程启动到 READY 状态 |
| **单 Bridge 并发** | 2 个任务同时运行 | 配置 `maxConcurrent` |
| **任务队列容量** | 100 个排队任务 | 内存限制 |
| **Checkpoint 保存** | < 100ms（单任务） | SQLite 写入时间 |
| **文件快照** | < 5s（1000 文件项目） | 递归扫描时间 |
| **内存占用** | < 128MB（空闲） | RSS |
| **CPU 占用** | < 5%（空闲，心跳期间） | process.cpuUsage() |

### 11.2 性能瓶颈分析

| 瓶颈 | 原因 | 影响 | 缓解 |
|------|------|------|------|
| 文件快照 | 递归扫描 + SHA-256 | 任务开始前 2-5s 延迟 | 增量扫描、排除大目录 |
| SQLite 写入 | WAL 模式下并发写入受限 | 高并发时写入延迟增加 | 批量写入、内存缓冲 |
| WebSocket 消息 | 大量 progress 消息 | Gateway 消息堆积 | 节流（每 2s 最多 1 条 progress） |
| 日志写入 | 同步写磁盘 | 影响任务执行速度 | 异步日志 + 缓冲 |

### 11.3 监控指标

```typescript
// Bridge 暴露的 Prometheus 格式指标

// 可通过 GET /metrics 获取

/*
# HELP oc_bridge_tasks_total Total number of tasks
# TYPE oc_bridge_tasks_total counter
oc_bridge_tasks_total{status="completed"} 150
oc_bridge_tasks_total{status="failed"} 5
oc_bridge_tasks_total{status="cancelled"} 3

# HELP oc_bridge_tasks_duration_seconds Task execution duration
# TYPE oc_bridge_tasks_duration_seconds histogram
oc_bridge_tasks_duration_seconds_bucket{le="10"} 10
oc_bridge_tasks_duration_seconds_bucket{le="30"} 45
oc_bridge_tasks_duration_seconds_bucket{le="60"} 80
oc_bridge_tasks_duration_seconds_bucket{le="300"} 155

# HELP oc_bridge_active_tasks Current active tasks
# TYPE oc_bridge_active_tasks gauge
oc_bridge_active_tasks 2

# HELP oc_bridge_queued_tasks Current queued tasks
# TYPE oc_bridge_queued_tasks gauge
oc_bridge_queued_tasks 1

# HELP oc_bridge_memory_bytes Memory usage
# TYPE oc_bridge_memory_bytes gauge
oc_bridge_memory_bytes{type="rss"} 85400000
oc_bridge_memory_bytes{type="heap"} 42100000

# HELP oc_bridge_ws_messages_total WebSocket messages
# TYPE oc_bridge_ws_messages_total counter
oc_bridge_ws_messages_total{direction="in"} 500
oc_bridge_ws_messages_total{direction="out"} 800

# HELP oc_bridge_uptime_seconds Bridge uptime
# TYPE oc_bridge_uptime_seconds gauge
oc_bridge_uptime_seconds 86400
*/
```

### 11.4 告警规则

| 告警 | 条件 | 级别 | 通知方式 |
|------|------|------|---------|
| Bridge 离线 | 心跳超时 3 次 | Critical | 飞书通知 |
| 任务失败率 > 20% | 1 小时内失败/总数 > 20% | Warning | 飞书通知 |
| 内存 > 512MB | RSS 持续超过 512MB | Warning | 日志 |
| 队列积压 | 排队任务 > 10 | Warning | 日志 |
| 子进程僵死 | running 状态 > timeout × 2 | Critical | 飞书通知 |

---

## 第12章 部署方案

### 12.1 安装方式

#### 12.1.1 npm 全局安装（推荐）

```bash
# Mac / Linux
npm install -g @liuh82/oc-bridge
oc-bridge setup    # 交互式配置向导
oc-bridge start    # 启动

# Windows (PowerShell)
npm install -g @liuh82/oc-bridge
oc-bridge setup
oc-bridge start
```

#### 12.1.2 安装脚本

```bash
# Mac / Linux
curl -fsSL https://raw.githubusercontent.com/liuh82/agent-orchestration/main/scripts/install.sh | bash

# Windows
irm https://raw.githubusercontent.com/liuh82/agent-orchestration/main/scripts/install.ps1 | iex
```

#### 12.1.3 配置向导

```bash
$ oc-bridge setup

🦞 Remote Agent Bridge 配置向导

? Gateway URL: wss://81.70.98.45
? Token 文件路径: ~/.openclaw/gateway.token
  ✓ Token 文件已找到
? 最大并发任务数 (默认 2): 2
? HTTP API 端口 (默认 18790): 18790
? 日志级别 (info/debug/warn/error): info

检测可用 Agent...
  ✓ codex (v0.114.0) - /usr/local/bin/codex
  ✓ pi (v1.2.0) - /usr/local/bin/pi
  ✗ openclaw acp - 未找到

检测活跃 IDE...
  ✓ VS Code (v1.96.0) - workspace: /Users/liuh/projects/agent-orchestration
  ✓ Cursor (v0.42.0) - workspace: /Users/liuh/projects/agent-orchestration

配置已保存到 ~/.oc-bridge/config.json

使用 'oc-bridge start' 启动 Bridge
```

### 12.2 进程管理

#### 12.2.1 前台运行（开发模式）

```bash
oc-bridge start --verbose
```

#### 12.2.2 后台运行（生产模式）

```bash
# systemd (Linux)
sudo cp scripts/oc-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable oc-bridge
sudo systemctl start oc-bridge

# launchd (macOS)
cp scripts/com.liuh82.oc-bridge.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.liuh82.oc-bridge.plist

# pm2 (跨平台)
npm install -g pm2
pm2 start oc-bridge --name oc-bridge
pm2 save
pm2 startup
```

#### 12.2.3 systemd service 文件

```ini
# /etc/systemd/system/oc-bridge.service
[Unit]
Description=Remote Agent Bridge
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/oc-bridge start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

# 资源限制
LimitNOFILE=65536
MemoryMax=512M

# 优雅退出
TimeoutStopSec=30
KillSignal=SIGTERM
KillMode=mixed

[Install]
WantedBy=multi-user.target
```

### 12.3 升级

```bash
npm update -g @liuh82/oc-bridge
oc-bridge start  # 自动检测新版本，平滑重启
```

升级流程：
1. npm 下载新版本
2. `oc-bridge start` 检测到版本变化
3. 等待当前任务完成（最多 shutdownTimeout 秒）
4. 保存 checkpoint
5. 退出
6. 新版本启动
7. 恢复 checkpoint

---

## 第13章 开发路线图

### Phase 1：MVP — CLI Agent 跨平台调度（1-1.5 周）

**目标**：Gateway 能调度任意平台上 Mac/Windows/Linux 的 CLI Agent

- [ ] Bridge 核心服务框架（index.ts, bridge.ts）
- [ ] WebSocket 客户端 + 认证 + 心跳 + ACK
- [ ] CLI Adapter（codex / pi / openclaw acp）
- [ ] Task Queue + Task Runner
- [ ] Checkpoint Manager（SQLite 持久化）
- [ ] Bridge HTTP API（RESTful）
- [ ] 跨平台路径适配（platform.ts）
- [ ] 安全沙箱（命令白名单 + prompt 检测）
- [ ] 审计日志
- [ ] 配置管理（文件 + 环境变量 + 热更新）
- [ ] 安装脚本（install.sh / install.ps1）
- [ ] 交互式配置向导（setup.ts）
- [ ] 单元测试 + 集成测试
- [ ] Gateway BridgeManager 模块
- [ ] 编排系统 RemoteAgentEngine（Python）
- [ ] 端到端测试（Mac + Windows）

**交付物**：`@liuh82/oc-bridge@1.0.0` npm 包

**验收标准**：
1. Mac/Windows/Linux 三平台 CI 通过
2. 从 Gateway 提交任务 → Bridge 接收 → CLI Agent 执行 → 结果回传 < 5 分钟
3. 断线重连 < 30 秒
4. 任务崩溃后恢复成功

### Phase 2：IDE 集成 — VS Code / Cursor（1 周）

**目标**：VS Code 和 Cursor 内执行任务

- [ ] 文件队列机制（incoming / outgoing 目录 + FileSystemWatcher）
- [ ] VS Code 扩展（监听任务 + 注入终端 + 捕获结果）
- [ ] Cursor 扩展（复用 VS Code 方案）
- [ ] IDE 状态检测（当前打开的项目、活跃状态）
- [ ] 多任务并发控制（按项目锁定）
- [ ] 扩展发布到 marketplace

**交付物**：VS Code + Cursor 扩展

### Phase 3：JetBrains + 编排系统集成（1.5 周）

**目标**：支持 JetBrains IDE，编排系统 Workflow 可调用远端 Agent

- [ ] IntelliJ IDEA 集成（HTTP API + 文件队列）
- [ ] WebStorm / PyCharm 支持
- [ ] 编排系统 RemoteAgentEngine 完善
- [ ] Workflow 节点类型 `remote-agent`
- [ ] 前端看板显示远端任务状态
- [ ] 飞书通知集成
- [ ] Git 自动 commit/push（任务完成后）

**交付物**：JetBrains 插件 + 编排系统集成

### Phase 4：生产加固 + 多人协作（1 周）

- [ ] 多用户任务隔离
- [ ] 费用追踪仪表板
- [ ] 结果缓存
- [ ] HTTP 长轮询 fallback
- [ ] Bridge 自动更新
- [ ] Token 轮换
- [ ] Let's Encrypt 证书
- [ ] 完善文档（用户指南 + API 文档）
- [ ] 性能测试 + 压测

---

## 附录 A：错误码速查表

| 错误码 | HTTP | 类别 | 含义 | 可重试 |
|--------|------|------|------|--------|
| `AUTH_REQUIRED` | 401 | 认证 | 缺少 token | ❌ |
| `AUTH_INVALID_TOKEN` | 401 | 认证 | Token 无效 | ❌ |
| `AUTH_EXPIRED` | 401 | 认证 | Token 过期 | ❌ |
| `AUTH_FORBIDDEN` | 403 | 认证 | 权限不足 | ❌ |
| `TASK_NOT_FOUND` | 404 | 任务 | 任务不存在 | ❌ |
| `TASK_ALREADY_COMPLETED` | 409 | 任务 | 任务已完成 | ❌ |
| `TASK_REJECTED` | 422 | 任务 | Agent 不可用 | ✅ |
| `TASK_TIMEOUT` | 504 | 任务 | 执行超时 | ✅ |
| `TASK_CANCELLED` | 200 | 任务 | 任务被取消 | ❌ |
| `QUEUE_FULL` | 429 | 队列 | 队列已满 | ✅ |
| `AGENT_UNAVAILABLE` | 503 | Agent | Agent 不可用 | ✅ |
| `AGENT_CRASHED` | 500 | Agent | Agent 崩溃 | ✅ |
| `BRIDGE_OFFLINE` | 503 | Bridge | Bridge 离线 | ✅ |
| `BRIDGE_SHUTTING_DOWN` | 503 | Bridge | Bridge 关闭中 | ✅ |
| `WS_CONNECTION_LOST` | 503 | 网络 | WebSocket 断开 | ✅ |
| `INTERNAL_ERROR` | 500 | 系统 | 内部错误 | ❌ |
| `DATABASE_ERROR` | 500 | 系统 | 数据库错误 | ✅ |
| `CONFIG_ERROR` | 500 | 系统 | 配置错误 | ❌ |
| `SANDBOX_VIOLATION` | 403 | 安全 | 安全策略违规 | ❌ |

## 附录 B：配置项完整列表

| 配置路径 | 类型 | 默认值 | 环境变量 | 说明 |
|---------|------|--------|---------|------|
| `bridge.id` | string | auto | `OC_BRIDGE_ID` | Bridge ID |
| `bridge.shutdownTimeout` | number | 30 | `OC_BRIDGE_SHUTDOWN_TIMEOUT` | 优雅退出超时(秒) |
| `bridge.healthCheckInterval` | number | 10 | `OC_BRIDGE_HEALTH_CHECK_INTERVAL` | 健康检查间隔(秒) |
| `gateway.url` | string | required | `OC_BRIDGE_GATEWAY_URL` | Gateway WSS URL |
| `gateway.tokenFile` | string | `~/.openclaw/gateway.token` | `OC_BRIDGE_GATEWAY_TOKEN_FILE` | Token 文件路径 |
| `gateway.reconnect.enabled` | boolean | true | - | 启用断线重连 |
| `gateway.reconnect.maxRetries` | number | Infinity | - | 最大重连次数 |
| `gateway.reconnect.baseDelay` | number | 1000 | - | 重连基础延迟(ms) |
| `gateway.reconnect.maxDelay` | number | 60000 | - | 重连最大延迟(ms) |
| `gateway.reconnect.jitter` | number | 1000 | - | 重连随机抖动(ms) |
| `tasks.maxConcurrent` | number | 2 | `OC_BRIDGE_TASKS_MAX_CONCURRENT` | 最大并发任务 |
| `tasks.defaultTimeout` | number | 300 | `OC_BRIDGE_TASKS_DEFAULT_TIMEOUT` | 默认超时(秒) |
| `tasks.maxRetries` | number | 3 | `OC_BRIDGE_TASKS_MAX_RETRIES` | 最大重试次数 |
| `tasks.outputBufferSize` | number | 100 | - | 输出缓冲行数 |
| `tasks.maxOutputSize` | number | 1048576 | - | 最大输出存储(bytes) |
| `tasks.queuePriority.high` | number | 3 | - | 高优先级权重 |
| `tasks.queuePriority.normal` | number | 2 | - | 普通优先级权重 |
| `tasks.queuePriority.low` | number | 1 | - | 低优先级权重 |
| `adapters.autoDetect` | boolean | true | - | 自动检测可用 Adapter |
| `adapters.cli.codex.command` | string | `codex` | - | codex 命令 |
| `adapters.cli.codex.args` | string[] | `["--approval-mode","suggest","--quiet"]` | - | codex 参数 |
| `adapters.cli.codex.timeout` | number | 300 | - | codex 超时(秒) |
| `adapters.cli.pi.command` | string | `pi` | - | pi 命令 |
| `adapters.cli.pi.args` | string[] | `[]` | - | pi 参数 |
| `adapters.cli.pi.timeout` | number | 300 | - | pi 超时(秒) |
| `adapters.cli.acp.command` | string | `openclaw` | - | acp 命令 |
| `adapters.cli.acp.args` | string[] | `["acp"]` | - | acp 参数 |
| `adapters.cli.acp.timeout` | number | 300 | - | acp 超时(秒) |
| `http.enabled` | boolean | true | - | 启用 HTTP API |
| `http.port` | number | 18790 | `OC_BRIDGE_HTTP_PORT` | HTTP 端口 |
| `http.host` | string | `127.0.0.1` | `OC_BRIDGE_HTTP_HOST` | HTTP 监听地址 |
| `http.cors.origins` | string[] | `["*"]` | - | CORS 允许源 |
| `http.auth.enabled` | boolean | true | - | HTTP API 认证 |
| `http.auth.token` | string | (同 gateway token) | `OC_BRIDGE_HTTP_TOKEN` | HTTP API token |
| `database.path` | string | `{configDir}/bridge.db` | `OC_BRIDGE_DB_PATH` | SQLite 文件路径 |
| `database.walEnabled` | boolean | true | - | 启用 WAL 模式 |
| `database.busyTimeout` | number | 5000 | - | SQLite busy 超时(ms) |
| `checkpoint.enabled` | boolean | true | - | 启用 checkpoint |
| `checkpoint.saveInterval` | number | 5 | - | 自动保存间隔(秒) |
| `checkpoint.directory` | string | `{configDir}/checkpoints` | - | checkpoint 目录 |
| `logging.level` | string | `info` | `OC_BRIDGE_LOGGING_LEVEL` | 日志级别 |
| `logging.file` | string | `{configDir}/bridge.log` | - | 日志文件路径 |
| `logging.maxFiles` | number | 5 | - | 日志轮转文件数 |
| `logging.maxSize` | string | `10m` | - | 单文件最大大小 |
| `logging.console` | boolean | true | - | 输出到控制台 |
| `security.allowedCommands` | string[] | 见默认 | - | 允许的 CLI 命令 |
| `security.allowedPaths` | string[] | `[]` | - | 允许的项目路径 |
| `security.blockedPatterns` | string[] | 见默认 | - | 阻止的 prompt 模式 |
| `security.requireApprovalFor` | string[] | `[]` | - | 需要确认的 Agent |

## 附录 C：与现有方案的关系

| 维度 | ACP（现有） | Remote Bridge（新） |
|------|------------|-------------------|
| **方向** | 单向（Mac→服务器） | **双向** |
| **平台** | Node.js（依赖 Node） | **Mac + Windows + Linux（Node.js 跨平台）** |
| **IDE 集成** | VS Code MCP（被卡住） | **CLI + 文件队列（不依赖 MCP）** |
| **Agent 位置** | 服务器上执行 | **Bridge 所在机器上执行** |
| **多机支持** | 不支持 | **多 Bridge 注册 + 路由 + 故障转移** |
| **编排集成** | 无 | **RemoteAgentEngine + Workflow 节点** |
| **容错** | 无 | **Checkpoint + 重连 + 重试** |
| **安全** | Token 认证 | **Token + 沙箱 + 审计 + CORS** |
| **状态管理** | 内存 | **SQLite 持久化** |
| **监控** | 无 | **Prometheus 指标 + 告警** |
| **开发状态** | 已验证连通 | **待开发（Phase 1 MVP）** |

**两者互补，不冲突：**
- **ACP**：IDE 里直接跟服务器上的 Agent 对话（单向，Agent 在服务器执行）
- **Remote Bridge**：服务器主动推任务到任意机器的 Agent（双向，Agent 在本地执行）

**何时用哪个？**

| 场景 | 使用 |
|------|------|
| 在 Mac IDE 里直接跟服务器 Agent 对话 | ACP |
| 服务器推任务到 Mac/Windows Agent 执行 | Remote Bridge |
| 编排系统 Workflow 调度远端 Agent | Remote Bridge |
| 多台机器的 Agent 协作 | Remote Bridge |
| 快速交互式对话 | ACP |
| 批量自动化开发任务 | Remote Bridge |
