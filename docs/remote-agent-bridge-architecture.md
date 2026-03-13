# Remote Agent Bridge 详细架构设计

> 日期：2026-03-13
> 架构师：小白
> 状态：待评审
> 版本：v1.0

---

## 1. 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        服务器 (81.70.98.45)                          │
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────────┐  │
│  │ OpenClaw      │     │ 编排系统      │     │ Nginx :443         │  │
│  │ Gateway       │────►│ (FastAPI)    │     │ (SSL + WS proxy)   │  │
│  │ :18789        │     │ :8083        │     │                    │  │
│  └──────┬───────┘     └──────┬───────┘     └────────┬───────────┘  │
│         │                     │                       │              │
│         │    ┌────────────────┘                       │              │
│         │    │                                        │              │
│         ▼    ▼                                        ▼              │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │            Gateway WebSocket Server                      │       │
│  │  ├─ OpenClaw Agent（小白）调用 dev_task 工具              │       │
│  │  ├─ 编排系统 Workflow 节点通过 HTTP API 调用              │       │
│  │  └─ 统一管理：任务队列、状态跟踪、结果回传                  │       │
│  └─────────────────────────┬───────────────────────────────┘       │
│                            │                                       │
│                            │ WSS (双向)                             │
│                            │                                       │
└────────────────────────────┼───────────────────────────────────────┘
                             │
                             │
┌────────────────────────────┼───────────────────────────────────────┐
│                            │   开发机 (Mac)                          │
│                            ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │           Remote Agent Bridge Service                      │       │
│  │           (Node.js, 常驻进程)                               │       │
│  │                                                              │       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │       │
│  │  │ WS Client    │  │ Task Queue   │  │ Agent Runner   │   │       │
│  │  │ (连接Gateway)│  │ (内存队列)    │  │ (执行Agent)    │   │       │
│  │  └──────────────┘  └──────────────┘  └───────┬────────┘   │       │
│  │                                               │            │       │
│  │  ┌────────────────────────────────────────────┼────────┐   │       │
│  │  │           Agent Adapter Layer               │        │   │       │
│  │  │  ├─ VS Code Adapter (文件队列 + watch)       │        │   │       │
│  │  │  ├─ CLI Adapter (subprocess: codex/pi)       │        │   │       │
│  │  │  └─ ACP Adapter (openclaw acp)               │        │   │       │
│  │  └─────────────────────────────────────────────────────┘   │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ VS Code +    │  │ codex CLI    │  │ pi / openclaw acp   │    │
│  │ Claude Code  │  │ (终端)        │  │ (终端)              │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 模块划分

### 2.1 文件结构

```
remote-agent-bridge/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # 入口：启动 Bridge Service
│   ├── ws-client.ts                # WebSocket 客户端（连接 Gateway）
│   ├── task-queue.ts               # 任务队列管理
│   ├── task-runner.ts              # 任务执行调度器
│   ├── adapters/
│   │   ├── base.ts                 # Adapter 基类
│   │   ├── vscode-adapter.ts       # VS Code + 文件队列集成
│   │   ├── cli-adapter.ts          # CLI Agent (codex/pi)
│   │   └── acp-adapter.ts          # ACP Bridge (openclaw acp)
│   ├── protocol/
│   │   ├── messages.ts             # 消息类型定义
│   │   └── schema.ts               # JSON Schema 验证
│   ├── config.ts                   # 配置管理
│   └── utils/
│       ├── logger.ts               # 日志
│       └── retry.ts                # 重试逻辑
├── vscode-extension/               # 可选：VS Code 扩展
│   ├── package.json
│   └── src/
│       └── extension.ts            # 监听任务文件
└── scripts/
    ├── dev.ts                      # 开发启动脚本
    └── install.sh                  # 安装脚本
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| `ws-client.ts` | 管理 WebSocket 连接、认证、心跳、消息收发 |
| `task-queue.ts` | 内存任务队列，支持优先级、并发控制 |
| `task-runner.ts` | 从队列取任务，分发给对应 Adapter，跟踪状态 |
| `vscode-adapter.ts` | 通过文件队列将任务注入 VS Code |
| `cli-adapter.ts` | 启动 codex/pi CLI 子进程执行任务 |
| `acp-adapter.ts` | 通过 `openclaw acp` 执行任务 |
| `protocol/` | 定义所有消息格式、验证、编解码 |

## 3. 通信协议设计

### 3.1 消息格式

```typescript
// === Gateway → Mac (下行) ===

// 提交任务
interface TaskSubmit {
  type: "task.submit";
  taskId: string;           // UUID
  prompt: string;           // 开发任务描述
  projectPath: string;      // 项目路径（Mac 上）
  agentType: "vscode-cc" | "codex" | "pi" | "acp";
  timeout: number;          // 秒，默认 300
  priority: "high" | "normal" | "low";
  callbackId?: string;      // 编排系统回调 ID
}

// 取消任务
interface TaskCancel {
  type: "task.cancel";
  taskId: string;
  reason: string;
}

// 心跳请求
interface HeartbeatRequest {
  type: "ping";
  ts: number;
}

// === Mac → Gateway (上行) ===

// 任务状态更新
interface TaskProgress {
  type: "task.progress";
  taskId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  output?: string;          // 实时输出（最近 N 行）
  progress?: number;        // 0-100
}

// 任务完成
interface TaskComplete {
  type: "task.complete";
  taskId: string;
  result: {
    exitCode: number;
    output: string;
    changedFiles: string[];  // 变更的文件列表
    duration: number;        // 毫秒
  };
}

// 心跳响应
interface HeartbeatResponse {
  type: "pong";
  ts: number;
  activeTasks: number;
  availableAgents: string[];
}

// Bridge 注册
interface BridgeRegister {
  type: "bridge.register";
  bridgeId: string;
  agents: {
    type: string;
    version: string;
    projectPath: string;
  }[];
}
```

### 3.2 连接与握手流程

```
Mac Bridge                    Gateway
    │                            │
    │── bridge.register ────────►│  (1) Bridge 上线，报告能力
    │                            │
    │◄── bridge.ack ────────────│  (2) 确认注册，分配 bridgeId
    │                            │
    │── ping ───────────────────►│  (3) 心跳 (每30秒)
    │◄── pong ───────────────────│
    │                            │
    │◄── task.submit ────────────│  (4) 服务器推任务
    │                            │
    │── task.progress(running)──►│  (5) 状态更新
    │── task.progress(50%) ─────►│
    │                            │
    │── task.complete ───────────►│  (6) 任务完成
    │                            │
```

### 3.3 任务状态机

```
                    ┌──────────┐
                    │ pending  │ (Gateway 创建)
                    └────┬─────┘
                         │ Bridge 接收
                         ▼
                    ┌──────────┐
                    │  queued  │ (Bridge 队列中)
                    └────┬─────┘
                         │ Runner 取出
                         ▼
                    ┌──────────┐
              ┌────►│ running  │
              │     └──┬───┬───┘
              │        │   │
              │        │   │ cancel
              │        │   ▼
              │        │ ┌───────────┐
              │        │ │ cancelled │
              │        │ └───────────┘
              │        │
              │        │ complete/fail
              │        ▼
              │  ┌───────────┐
              └──│  done     │
                 └───────────┘
                  /         \
            ┌──────────┐ ┌──────────┐
            │completed │ │ failed  │
            └──────────┘ └──────────┘
                            │
                       retry (最多3次)
                            │
                            ▼
                       back to running
```

## 4. Remote Bridge 服务设计

### 4.1 配置文件 `~/.oc-bridge/config.json`

```json
{
  "gateway": {
    "url": "wss://81.70.98.45",
    "tokenFile": "~/.openclaw/gateway.token",
    "reconnect": {
      "enabled": true,
      "maxRetries": 10,
      "baseDelay": 1000,
      "maxDelay": 60000
    }
  },
  "agents": {
    "codex": {
      "command": "codex",
      "args": ["--approval-mode", "suggest"],
      "timeout": 300
    },
    "pi": {
      "command": "pi",
      "args": [],
      "timeout": 300
    },
    "vscode-cc": {
      "type": "file-queue",
      "watchDir": "/tmp/oc-dev-tasks",
      "timeout": 600
    }
  },
  "tasks": {
    "maxConcurrent": 2,
    "defaultTimeout": 300,
    "outputTailLines": 100
  },
  "logging": {
    "level": "info",
    "file": "~/.oc-bridge/bridge.log"
  }
}
```

### 4.2 启动方式

```bash
# 全局安装
npm install -g @liuh82/oc-bridge

# 启动
oc-bridge start

# 后台运行
oc-bridge start --daemon

# 查看状态
oc-bridge status

# 查看日志
oc-bridge logs
```

### 4.3 Agent Runner 执行流程

```typescript
async function executeTask(task: TaskSubmit, adapter: AgentAdapter): Promise<TaskResult> {
  const startTime = Date.now();
  
  // 1. 通知 Gateway：开始执行
  ws.send({ type: 'task.progress', taskId: task.taskId, status: 'running' });
  
  try {
    // 2. 创建超时控制器
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), task.timeout * 1000);
    
    // 3. 通过 Adapter 执行
    const result = await adapter.execute({
      prompt: task.prompt,
      cwd: task.projectPath,
      signal: controller.signal,
      onOutput: (line) => {
        // 实时输出流式回传
        ws.send({ type: 'task.progress', taskId: task.taskId, output: line });
      }
    });
    
    clearTimeout(timeout);
    
    // 4. 通知 Gateway：完成
    ws.send({
      type: 'task.complete',
      taskId: task.taskId,
      result: { ...result, duration: Date.now() - startTime }
    });
    
    return result;
    
  } catch (err) {
    if (err.name === 'AbortError') {
      ws.send({ type: 'task.progress', taskId: task.taskId, status: 'failed', output: 'Timeout' });
    } else {
      ws.send({ type: 'task.progress', taskId: task.taskId, status: 'failed', output: err.message });
    }
    throw err;
  }
}
```

## 5. VS Code 集成方案

### 方案 A：文件队列 + 文件监听（推荐，最简单）

```
Bridge → 写入 /tmp/oc-dev-tasks/task_uuid.json
              ↓
VS Code 扩展 (file watcher) → 读取任务
              ↓
注入到当前打开的终端 / 新建终端
              ↓
Terminal → `claude` / `codex` CLI
              ↓
执行完毕 → 写入 /tmp/oc-dev-tasks/task_uuid.result.json
              ↓
Bridge 读取结果 → 回传 Gateway
```

**优点**：不依赖任何协议，VS Code 原生支持 file watcher
**缺点**：需要安装 VS Code 扩展，文件轮询有延迟（~1s）

**任务文件格式：**
```json
{
  "taskId": "task-uuid-xxx",
  "prompt": "修复 approval.py 的 SQL 注入问题",
  "projectPath": "/Users/liuh82/projects/agent-orchestration",
  "status": "pending",
  "createdAt": "2026-03-13T23:00:00Z"
}
```

**结果文件格式：**
```json
{
  "taskId": "task-uuid-xxx",
  "status": "completed",
  "exitCode": 0,
  "output": "已修复 approval.py...",
  "changedFiles": ["backend/app/services/approval.py"],
  "duration": 45000
}
```

### 方案 B：CLI 直接调用（中等复杂度）

```
Bridge → spawn `codex --quiet "prompt" --cwd /path`
              ↓
子进程执行
              ↓
stdout/stderr 捕获 → 流式回传 Gateway
```

**优点**：不需要 VS Code 扩展，直接在终端执行
**缺点**：看不到 VS Code 里的实时编辑过程，用户不知道在执行什么

### 方案 C：Terminal 注入（复杂但体验最好）

```
Bridge → 通过 VS Code Extension API → sendTextToActiveTerminal
              ↓
当前终端接收命令 → 执行
              ↓
捕获输出 → 回传
```

**优点**：在 VS Code 终端里直接看到执行过程
**缺点**：需要自定义 VS Code 扩展，API 不稳定

### 推荐组合

**MVP（Phase 1）**：方案 B（CLI 直接调用）
**完整版（Phase 2）**：方案 A（文件队列）+ 方案 B（CLI）并行

## 6. 编排系统集成

### 6.1 LobsterEngine 添加 Remote 模式

```python
# backend/app/services/lobster_engine.py 新增

class RemoteAgentEngine:
    """远端 Agent 执行引擎"""
    
    def __init__(self, bridge_url: str = "http://127.0.0.1:18790"):
        self.bridge_url = bridge_url
    
    async def execute(self, workflow: WorkflowDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """通过 Remote Bridge 执行任务"""
        task = {
            "prompt": context.get("prompt", ""),
            "projectPath": workflow.config.get("project_path", ""),
            "agentType": workflow.config.get("agent_type", "codex"),
            "timeout": workflow.config.get("timeout", 300),
        }
        
        # 调用 Bridge HTTP API
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.bridge_url}/api/tasks", json=task) as resp:
                result = await resp.json()
        
        return {
            "success": result["exitCode"] == 0,
            "output": result["output"],
            "taskId": result["taskId"],
            "status": "completed" if result["exitCode"] == 0 else "failed"
        }
```

### 6.2 Bridge HTTP API（本地代理）

在 Bridge 服务上同时开一个 HTTP 端口（`:18790`），提供 REST API 供编排系统调用：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks` | 提交任务 |
| GET | `/api/tasks/:id` | 查询任务状态 |
| DELETE | `/api/tasks/:id` | 取消任务 |
| GET | `/api/agents` | 列出可用 Agent |
| GET | `/api/health` | 健康检查 |

这样编排系统通过 HTTP 调用 Bridge，Bridge 通过 WebSocket 与 Gateway 通信。

### 6.3 Workflow 集成

在 Workflow 定义中添加远程 Agent 节点：

```json
{
  "name": "ORM迁移开发",
  "steps": [
    {
      "id": "step1",
      "type": "remote-agent",
      "agent": "codex",
      "prompt": "将 task.py 迁移到 SQLAlchemy 2.0",
      "projectPath": "/Users/liuh82/projects/agent-orchestration",
      "timeout": 300,
      "onComplete": "step2"
    },
    {
      "id": "step2",
      "type": "remote-agent",
      "agent": "vscode-cc",
      "prompt": "运行测试验证迁移结果",
      "projectPath": "/Users/liuh82/projects/agent-orchestration"
    }
  ]
}
```

## 7. 安全设计

### 7.1 认证

```
Mac Bridge 启动时：
1. 读取 ~/.openclaw/gateway.token
2. WebSocket 连接时发送: { type: "auth", token: "xxx" }
3. Gateway 验证 token → 发送: { type: "auth.ok", bridgeId: "assigned" }
4. 后续所有消息携带 bridgeId
```

### 7.2 授权

| 操作 | 权限级别 | 说明 |
|------|---------|------|
| dev_task | 普通 | 需要确认（可配置自动审批） |
| run_test | 普通 | 自动允许 |
| read_file | 只读 | 自动允许 |
| cancel_task | 普通 | 任务提交者可取消 |
| list_agents | 只读 | 自动允许 |

### 7.3 审计日志

```
[2026-03-13 23:00:01] AUTH  bridge_id=mac-001 source_ip=81.70.98.45
[2026-03-13 23:00:05] TASK  submit  task_id=task-001 agent=codex prompt="修复SQL注入" caller=openclaw
[2026-03-13 23:00:10] TASK  start   task_id=task-001
[2026-03-13 23:02:30] TASK  done    task_id=task-001 exit_code=0 duration=145000ms files_changed=1
```

## 8. 容错与可靠性

### 8.1 断线重连

```typescript
async function connectWithRetry(url: string, config: ReconnectConfig) {
  let attempt = 0;
  const delay = Math.min(
    config.baseDelay * Math.pow(2, attempt),
    config.maxDelay
  );
  
  while (attempt < config.maxRetries) {
    try {
      const ws = new WebSocket(url);
      await waitForOpen(ws);
      return ws; // 成功
    } catch (e) {
      attempt++;
      logger.warn(`Reconnect attempt ${attempt}/${config.maxRetries}, next in ${delay}ms`);
      await sleep(delay + Math.random() * 1000); // jitter
    }
  }
  throw new Error('Max reconnection attempts exceeded');
}
```

### 8.2 任务超时

- Bridge 端：`AbortController` 超时自动 kill 子进程
- Gateway 端：如果 Bridge 断线，pending 的任务标记为 `interrupted`
- 恢复后：Bridge 重连时上报未完成任务，Gateway 决定是否重派

### 8.3 失败重试

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  retryableErrors: ['TIMEOUT', 'ABORT', 'CONNECTION_LOST'],
  backoff: [5000, 15000, 45000] // 5s, 15s, 45s
};
```

## 9. 风险与边界情况

### 9.1 已识别风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **Mac 休眠/睡眠** | Bridge 断连，任务中断 | 检测系统唤醒后自动重连；Gateway 标记中断任务 |
| **VS Code 未启动** | vscode-cc 类型任务无法执行 | Bridge 检测 VS Code 状态，降级到 CLI 模式 |
| **Agent CLI 版本不兼容** | 命令行参数变化 | Bridge 启动时检测 CLI 版本，上报给 Gateway |
| **多个任务同时操作同一文件** | 文件冲突 | 按项目路径加锁，同一项目同时只允许一个任务 |
| **Mac 磁盘满** | 子进程失败 | Bridge 检测磁盘空间，任务前预警 |
| **网络不稳定（SSH/远程）** | WebSocket 频繁断连 | 指数退避重连 + 本地任务队列缓冲 |
| **Gateway 重启** | 连接丢失 + 任务状态不清 | Bridge 重连时上报本地状态，Gateway 合并 |
| **安全：恶意 prompt** | 执行危险命令 | Agent 级别沙箱限制；审批模式 |

### 9.2 未考虑到的地方（待讨论）

1. **多台 Mac 支持**：一个 Gateway 连多个 Bridge 实例，需要 Bridge 注册 + 路由策略
2. **结果缓存**：相同 prompt 是否复用之前的结果
3. **费用追踪**：远端 Agent 的 API 调用费用统计
4. **Git 集成**：任务完成后自动 commit/push
5. **通知机制**：任务完成时通过飞书/邮件通知
6. **项目隔离**：不同项目的任务是否允许并行

## 10. 开发路线图

### Phase 1：MVP（1周）

**目标**：服务器能通过 Bridge 调度 Mac 上的 CLI Agent（codex/pi）

- [ ] Bridge 服务核心（WebSocket 客户端 + 任务队列）
- [ ] CLI Adapter（subprocess 调用 codex/pi）
- [ ] 通信协议实现（消息收发、心跳、状态机）
- [ ] 基础安全（token 认证）
- [ ] Bridge HTTP API（供编排系统调用）
- [ ] 安装脚本 + 配置管理
- [ ] 端到端测试

**交付物**：`oc-bridge` npm 包，支持 `codex` / `pi` 远程调度

### Phase 2：VS Code 集成（1周）

**目标**：支持 VS Code + Claude Code 插件执行任务

- [ ] 文件队列机制
- [ ] VS Code 扩展（监听任务文件）
- [ ] 任务注入（终端发送）
- [ ] 结果捕获（文件监听）
- [ ] 多 Agent 并发控制

**交付物**：VS Code 扩展 marketplace 发布

### Phase 3：编排系统对接（3天）

**目标**：Workflow 能调度远端 Agent

- [ ] RemoteAgentEngine 实现
- [ ] Workflow 节点类型扩展
- [ ] 前端看板展示远端任务状态
- [ ] 飞书通知集成

**交付物**：编排系统支持 `remote-agent` 工作流节点

### Phase 4：生产加固（1周）

- [ ] 多 Bridge 注册与路由
- [ ] 费用追踪
- [ ] Git 自动 commit/push
- [ ] 完善审计日志
- [ ] 监控告警
- [ ] 文档完善

---

## 附录 A：与现有 ACP 方案的关系

| 维度 | ACP（现有） | Remote Bridge（新） |
|------|------------|-------------------|
| 方向 | Mac→服务器（单向） | 双向 |
| 协议 | ACP over stdio | 自定义 WebSocket + JSON |
| Agent 位置 | 服务器上 | Mac 上 |
| VS Code 集成 | MCP（被卡住） | 文件队列 / CLI |
| 编排系统集成 | 无 | 完整支持 |
| 开发状态 | 已验证连通 | 待开发 |

两者**互补**，不冲突：
- ACP 适合：IDE 里直接跟服务器上的 Agent 对话
- Remote Bridge 适合：服务器主动推任务到 Mac Agent 执行
