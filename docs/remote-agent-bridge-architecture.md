# Remote Agent Bridge 详细架构设计

> 日期：2026-03-13
> 架构师：小白
> 状态：待评审
> 版本：v1.1
> 更新：v1.1 考虑多平台（Mac/Windows/Linux）和多 IDE（VS Code/Cursor/IntelliJ IDEA 等）兼容性

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
│         ▼                     ▼                       ▼              │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │            Gateway WebSocket Server                      │       │
│  │  ├─ OpenClaw Agent（小白）调用 dev_task 工具              │       │
│  │  ├─ 编排系统 Workflow 节点通过 HTTP API 调用              │       │
│  │  ├─ 多 Bridge 注册管理（bridgeId + 平台 + IDE 标识）       │       │
│  │  └─ 统一管理：任务队列、状态跟踪、结果回传                  │       │
│  └─────────────────────────┬───────────────────────────────┘       │
│                            │                                       │
│                     WSS (双向)                                      │
┌───────────────────────────┼───────────────────────────────────────┐
│                           │                                        │
│    ┌──────────────────────┼──────────────────────────────┐         │
│    │       Remote Agent Bridge Service (Node.js)          │         │
│    │       支持平台: Mac / Windows / Linux                │         │
│    │                                                      │         │
│    │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐│         │
│    │  │ WS       │  │ Task     │  │ Agent Runner       ││         │
│    │  │ Client   │  │ Queue    │  │                    ││         │
│    │  └──────────┘  └──────────┘  └────────┬───────────┘│         │
│    │                                     │              │         │
│    │  ┌──────────────────────────────────┼──────────────┐│         │
│    │  │       Agent Adapter Layer        │              ││         │
│    │  │  ├─ CLI Adapter    (codex/pi)    │              ││         │
│    │  │  ├─ IDE Adapter    (见 §5)       │              ││         │
│    │  │  └─ ACP Adapter    (openclaw acp)│              ││         │
│    │  └─────────────────────────────────────────────────┘│         │
│    └─────────────────────────────────────────────────────┘         │
│                                                                      │
│    ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│    │ VS Code      │  │ Cursor      │  │ IntelliJ IDEA            │ │
│    │ + CC 插件    │  │ + AI Chat   │  │ + AI Assistant          │ │
│    └─────────────┘  └─────────────┘  └──────────────────────────┘ │
│                                                                      │
│    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│    │ codex CLI   │  │ pi CLI      │  │ 其他 CLI    │             │
│    └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                      │
│    ◀── Mac ─── Windows ─── Linux ──（任意组合）───────────────▶    │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 多平台与多 IDE 兼容性设计

### 2.1 设计原则

| 原则 | 说明 |
|------|------|
| **平台无关** | Bridge 核心用 Node.js/TypeScript，跨平台零修改 |
| **IDE 无关** | 通过 Adapter 模式隔离 IDE 差异，新增 IDE 只需加 Adapter |
| **渐进支持** | MVP 先支持 CLI Agent，后续逐步加 IDE Adapter |
| **统一协议** | 所有平台/IDE 共用同一套 WebSocket 协议 |
| **能力声明** | Bridge 注册时上报平台、IDE、可用 Agent，Gateway 自动路由 |

### 2.2 平台差异处理

| 维度 | Mac | Windows | Linux |
|------|-----|---------|-------|
| **安装方式** | npm/brew | npm/下载exe | npm/apt |
| **配置路径** | `~/.oc-bridge/` | `%APPDATA%\oc-bridge\` | `~/.oc-bridge/` |
| **临时目录** | `/tmp/oc-tasks/` | `%TEMP%\oc-tasks\` | `/tmp/oc-tasks/` |
| **终端** | Terminal/iTerm2 | PowerShell/CMD/WSL | bash/zsh |
| **文件监听** | `fs.watch` (FSEvents) | `fs.watch` (ReadDirectoryChangesW) | `fs.watch` (inotify) |
| **进程管理** | `child_process.spawn` | 同左 | 同左 |
| **代码编辑器路径** | `/usr/local/bin/code` | `C:\Users\xxx\AppData\Local\Programs\code.exe` | `/usr/bin/code` |

**关键**：Node.js 的 `child_process`、`fs.watch`、`path` 等核心 API 在三大平台行为一致，Bridge 核心逻辑无需分支。只有路径和编辑器路径需要平台适配，封装在 `utils/platform.ts` 中。

### 2.3 IDE 支持矩阵

| IDE | 集成方式 | 支持阶段 | 说明 |
|-----|---------|---------|------|
| **VS Code** | 文件队列 / CLI | Phase 1 (CLI) → Phase 2 (文件队列) | 官方扩展 API 最成熟 |
| **Cursor** | 文件队列 / CLI | Phase 1 (CLI) → Phase 2 (文件队列) | 基于 VS Code，方案通用 |
| **IntelliJ IDEA** | CLI / 文件队列 | Phase 3 | JetBrains 扩展 API 独立 |
| **WebStorm** | CLI / 文件队列 | Phase 3 | 同 IntelliJ |
| **PyCharm** | CLI / 文件队列 | Phase 3 | 同 IntelliJ |
| **Zed** | ACP 原生 | 未来 | 已内置 ACP 支持 |
| **Neovim** | CLI | Phase 1 | 终端原生支持 |
| **Windsurf** | CLI / 文件队列 | Phase 2+ | 新兴 AI IDE |

**核心策略**：**CLI Adapter 是通用基线**，所有 IDE 都能用。IDE-specific Adapter 是增强体验。

### 2.4 IDE Adapter 抽象设计

```typescript
// adapters/base.ts — 适配器基类

interface AgentAdapter {
  /** 适配器类型标识 */
  readonly type: string;
  /** 当前是否可用 */
  isAvailable(): Promise<boolean>;
  /** 执行任务 */
  execute(task: ExecuteRequest): Promise<ExecuteResult>;
  /** 取消任务 */
  cancel(taskId: string): Promise<void>;
}

interface ExecuteRequest {
  prompt: string;
  cwd: string;
  signal: AbortSignal;
  onOutput?: (line: string) => void;
  onProgress?: (percent: number) => void;
}

interface ExecuteResult {
  exitCode: number;
  output: string;
  changedFiles: string[];
  duration: number;
}
```

```typescript
// adapters/registry.ts — 适配器注册表

class AdapterRegistry {
  private adapters: Map<string, AgentAdapter> = new Map();
  
  register(adapter: AgentAdapter) {
    this.adapters.set(adapter.type, adapter);
  }
  
  get(type: string): AgentAdapter | undefined {
    return this.adapters.get(type);
  }
  
  async getAvailable(): Promise<AgentAdapter[]> {
    const results = await Promise.all(
      Array.from(this.adapters.values()).map(async (a) => ({
        adapter: a,
        available: await a.isAvailable()
      }))
    );
    return results.filter(r => r.available).map(r => r.adapter);
  }
}

// 自动注册
const registry = new AdapterRegistry();
registry.register(new CLIAdapter());          // Phase 1: 通用
registry.register(new VSCodeAdapter());       // Phase 2: VS Code
registry.register(new CursorAdapter());       // Phase 2: Cursor
registry.register(new IntelliJAdapter());     // Phase 3: JetBrains
```

## 3. 模块划分

### 3.1 文件结构（跨平台）

```
remote-agent-bridge/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                        # 入口
│   ├── ws-client.ts                    # WebSocket 客户端
│   ├── task-queue.ts                   # 任务队列
│   ├── task-runner.ts                  # 任务调度器
│   ├── adapters/
│   │   ├── base.ts                     # Adapter 接口定义
│   │   ├── registry.ts                 # Adapter 注册表
│   │   ├── cli-adapter.ts             # CLI Agent (codex/pi) — 通用
│   │   ├── vscode-adapter.ts          # VS Code 文件队列
│   │   ├── cursor-adapter.ts          # Cursor 文件队列
│   │   ├── intellij-adapter.ts        # IntelliJ CLI + 文件队列
│   │   └── acp-adapter.ts             # ACP Bridge
│   ├── protocol/
│   │   ├── messages.ts                 # 消息类型
│   │   └── schema.ts                   # JSON Schema 验证
│   ├── config.ts                       # 配置管理
│   ├── bridge-info.ts                  # Bridge 注册信息
│   └── utils/
│       ├── logger.ts
│       ├── retry.ts
│       ├── platform.ts                 # 平台适配（路径、编辑器路径等）
│       └── file-watcher.ts             # 跨平台文件监听封装
├── ide-extensions/
│   ├── vscode/                         # VS Code 扩展（Phase 2）
│   │   ├── package.json
│   │   └── src/extension.ts
│   ├── cursor/                         # Cursor 扩展（Phase 2）
│   │   ├── package.json
│   │   └── src/extension.ts
│   └── jetbrains/                      # JetBrains 插件（Phase 3）
│       └── ... (Kotlin/Java)
├── scripts/
│   ├── install.sh                      # Mac/Linux 安装
│   ├── install.ps1                     # Windows 安装
│   ├── dev.ts
│   └── setup.ts                        # 交互式配置向导
├── .github/
│   └── workflows/
│       ├── release-mac.yml
│       ├── release-win.yml
│       └── release-linux.yml
└── README.md
```

### 3.2 平台适配层

```typescript
// utils/platform.ts

import { homedir, tmpdir } from 'os';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

type OS = 'darwin' | 'win32' | 'linux';

const os = process.platform as OS;

const platformConfig = {
  darwin: {
    configDir: () => join(homedir(), '.oc-bridge'),
    taskDir: () => '/tmp/oc-tasks',
    // 常见编辑器路径
    editors: {
      vscode: [
        '/usr/local/bin/code',
        '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      ],
      cursor: [
        '/usr/local/bin/cursor',
        '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
      ],
      idea: [
        '/usr/local/bin/idea',
      ],
    },
  },
  win32: {
    configDir: () => join(process.env.APPDATA || homedir(), 'oc-bridge'),
    taskDir: () => join(process.env.TEMP || homedir(), 'oc-tasks'),
    editors: {
      vscode: [
        'C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd',
      ],
      cursor: [
        'C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Programs\\cursor\\bin\\cursor.cmd',
      ],
      idea: [
        resolve('C:\\Program Files\\JetBrains\\IntelliJ IDEA', 'bin', 'idea.bat'),
      ],
    },
  },
  linux: {
    configDir: () => join(homedir(), '.oc-bridge'),
    taskDir: () => '/tmp/oc-tasks',
    editors: {
      vscode: ['/usr/bin/code', '/snap/bin/code', '/usr/local/bin/code'],
      cursor: ['/usr/local/bin/cursor'],
      idea: ['/usr/local/bin/idea'],
    },
  },
};

export function findEditor(name: string): string | null {
  const paths = platformConfig[os]?.editors[name] || [];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function getConfigDir(): string {
  return platformConfig[os]?.configDir() || join(homedir(), '.oc-bridge');
}

export function getTaskDir(): string {
  return platformConfig[os]?.taskDir() || join(tmpdir(), 'oc-tasks');
}
```

## 4. 通信协议设计

### 4.1 消息格式

```typescript
// === Gateway → Bridge (下行) ===

interface TaskSubmit {
  type: "task.submit";
  taskId: string;
  prompt: string;
  projectPath: string;       // Bridge 所在平台的本地路径
  agentType: "vscode-cc" | "cursor-cc" | "intellij-ai" 
            | "codex" | "pi" | "acp" | "cli";
  timeout: number;
  priority: "high" | "normal" | "low";
  callbackId?: string;
  preferredIde?: string;     // 可选：指定用哪个 IDE
}

interface TaskCancel {
  type: "task.cancel";
  taskId: string;
  reason: string;
}

// === Bridge → Gateway (上行) ===

interface TaskProgress {
  type: "task.progress";
  taskId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  output?: string;
  progress?: number;
}

interface TaskComplete {
  type: "task.complete";
  taskId: string;
  result: {
    exitCode: number;
    output: string;
    changedFiles: string[];
    duration: number;
  };
}

// === Bridge 注册（上行） ===

interface BridgeRegister {
  type: "bridge.register";
  bridgeId: string;
  platform: "darwin" | "win32" | "linux";
  hostname: string;
  osVersion: string;
  nodeVersion: string;
  bridgeVersion: string;
  availableAdapters: {
    type: string;              // "cli" | "vscode" | "cursor" | "intellij" | "acp"
    agentName: string;         // "codex" | "pi" | "claude-code" | "idea-ai"
    version?: string;
    executablePath?: string;
  }[];
  activeIDEs: {
    name: string;              // "vscode" | "cursor" | "intellij"
    version: string;
    workspace?: string;        // 当前打开的项目路径
  }[];
}
```

### 4.2 Gateway 多 Bridge 路由

```typescript
// Gateway 侧的 Bridge 管理

interface ManagedBridge {
  bridgeId: string;
  platform: string;
  hostname: string;
  status: "online" | "offline";
  lastSeen: number;
  adapters: BridgeAdapter[];
  activeTasks: number;
  maxConcurrent: number;
}

class BridgeManager {
  private bridges: Map<string, ManagedBridge> = new Map();
  
  /** 选择最佳 Bridge 执行任务 */
  selectBridge(task: TaskSubmit): ManagedBridge | null {
    const candidates = Array.from(this.bridges.values())
      .filter(b => 
        b.status === 'online' && 
        b.activeTasks < b.maxConcurrent &&
        b.adapters.some(a => a.type === task.agentType)
      );
    
    if (candidates.length === 0) return null;
    
    // 优先级：负载最低 > 平台匹配 > 先注册
    return candidates.sort((a, b) => {
      if (a.activeTasks !== b.activeTasks) return a.activeTasks - b.activeTasks;
      return 0;
    })[0];
  }
  
  /** 按 IDE 偏好路由 */
  selectBridgeForIDE(task: TaskSubmit): ManagedBridge | null {
    if (!task.preferredIde) return this.selectBridge(task);
    
    // 找有指定 IDE 且空闲的 Bridge
    return Array.from(this.bridges.values())
      .filter(b => 
        b.status === 'online' &&
        b.activeTasks < b.maxConcurrent &&
        b.adapters.some(a => a.type === task.agentType) &&
        b.activeIDEs?.some(ide => ide.name === task.preferredIde)
      )[0] || this.selectBridge(task); // fallback
  }
}
```

### 4.3 任务状态机

```
                    ┌──────────┐
                    │ pending  │ (Gateway 创建，分配给 Bridge)
                    └────┬─────┘
                         │ Bridge 接收
                         ▼
                    ┌──────────┐
                    │  queued  │ (Bridge 队列中，等待执行)
                    └────┬─────┘
                         │ Runner 取出，选择 Adapter
                         ▼
                    ┌──────────┐
              ┌────►│ running  │
              │     └──┬───┬───┘
              │        │   │
              │        │   │ cancel / timeout
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
            │completed │ │ failed  │──► retry (最多 N 次)
            └──────────┘ └──────────┘
```

## 5. IDE 集成方案

### 5.1 通用方案：CLI Agent Adapter（Phase 1，跨平台跨 IDE）

所有 IDE 都支持终端操作，CLI Adapter 是最通用的方案：

```
Bridge → spawn `codex --quiet "prompt" --cwd /path`
Bridge → spawn `pi "prompt"`  
Bridge → spawn `openclaw acp --session xxx`
```

**特点**：
- ✅ 跨平台（Mac/Win/Linux）
- ✅ 跨 IDE（任何 IDE 都能用终端）
- ✅ 零 IDE 扩展依赖
- ❌ 用户看不到 IDE 里的实时编辑过程

### 5.2 VS Code / Cursor 集成（Phase 2）

VS Code 和 Cursor 共享 Electron 架构，方案通用：

**方案 A：文件队列 + 扩展监听**

```
Bridge → 写入 {taskDir}/task_uuid.json
              ↓
VS Code/Cursor 扩展 (FileSystemWatcher)
              ↓
读取任务 → 在当前终端发送命令
              ↓
CLI 执行完毕 → 扩展写 {taskDir}/task_uuid.result.json
              ↓
Bridge 监听结果文件 → 回传 Gateway
```

**方案 B：通过 VS Code CLI 发送命令**

```bash
# 在已有终端中发送命令
code --send-to-terminal "codex 修复 approval.py 的 SQL 注入"

# 或打开新终端执行
code -r /path/to/project --goto /path/to/file
```

**方案 C：通过 VS Code 扩展 API 直接注入**

```typescript
// VS Code 扩展内部
vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
  text: `codex "${task.prompt}"\n`
});
```

### 5.3 IntelliJ IDEA / WebStorm / PyCharm 集成（Phase 3）

JetBrains IDE 通过独立扩展机制：

**方案 A：文件队列（通用）**
- 同 VS Code 方案 A，Bridge 写文件，JetBrains 插件监听

**方案 B：通过 CLI 执行**
```bash
# JetBrains CLI (idea command)
idea project --command "ai.assistant.submit" --param "prompt"
```

**方案 C：通过 HTTP API（IntelliJ 内置）**
```bash
# IntelliJ 插件启动本地 HTTP server
curl -X POST http://localhost:63342/api/ai/execute \
  -d '{"prompt": "修复SQL注入", "projectPath": "/path"}'
```

### 5.4 IDE 适配器对比

| IDE | 文件队列 | CLI注入 | API调用 | 扩展开发语言 | 优先级 |
|-----|---------|---------|---------|-------------|--------|
| VS Code | ✅ | ✅ | ❌ | TypeScript | Phase 2 |
| Cursor | ✅ | ✅ | ❌ | TypeScript | Phase 2 |
| IntelliJ IDEA | ✅ | ⚠️ | ✅ | Kotlin/Java | Phase 3 |
| WebStorm | ✅ | ⚠️ | ✅ | Kotlin/Java | Phase 3 |
| PyCharm | ✅ | ⚠️ | ✅ | Kotlin/Java | Phase 3 |
| Zed | ❌ | ✅ | ❌ | Rust (ACP原生) | 未来 |
| Neovim | ❌ | ✅ | ❌ | Lua (可选) | Phase 1 via CLI |

## 6. 编排系统集成

### 6.1 LobsterEngine 添加 Remote 模式

```python
class RemoteAgentEngine:
    """远端 Agent 执行引擎 — 跨平台"""
    
    def __init__(self, bridge_url: str = "http://127.0.0.1:18790"):
        self.bridge_url = bridge_url
    
    async def execute(self, workflow, context):
        task = {
            "prompt": context.get("prompt", ""),
            "projectPath": workflow.config.get("project_path", ""),
            "agentType": workflow.config.get("agent_type", "cli"),
            "preferredIde": workflow.config.get("preferred_ide"),  # 新增
            "timeout": workflow.config.get("timeout", 300),
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.bridge_url}/api/tasks", json=task) as resp:
                result = await resp.json()
        return {"success": result["exitCode"] == 0, **result}
```

### 6.2 Workflow 示例（跨 IDE）

```json
{
  "steps": [
    {
      "id": "dev",
      "type": "remote-agent",
      "agent": "codex",
      "preferredIde": "cursor",
      "prompt": "迁移 task.py 到 ORM",
      "projectPath": "/Users/liuh82/projects/agent-orchestration"
    },
    {
      "id": "test",
      "type": "remote-agent",
      "agent": "cli",
      "prompt": "运行 pytest",
      "projectPath": "/Users/liuh82/projects/agent-orchestration"
    }
  ]
}
```

## 7. 安全设计

### 7.1 认证

```
Bridge 启动 → 读取 token 文件 → WebSocket 连接 → 发送认证消息
         ↓
    Mac:   ~/.openclaw/gateway.token
    Win:   %APPDATA%\oc-bridge\gateway.token
    Linux: ~/.openclaw/gateway.token
```

### 7.2 任务白名单

```json
{
  "permissions": {
    "allowedCommands": ["codex", "pi", "openclaw acp"],
    "allowedPaths": ["/Users/liuh82/projects"],
    "blockedPatterns": ["rm -rf /", "sudo"],
    "autoApproveAgents": ["codex", "pi"],
    "requireConfirmationFor": ["vscode-cc", "cursor-cc"]
  }
}
```

### 7.3 审计日志

```
[2026-03-13 23:00:01] AUTH  bridge=mac-001 platform=darwin hostname=MacBook-Pro
[2026-03-13 23:00:05] TASK  submit  id=task-001 agent=codex caller=openclaw
[2026-03-13 23:02:30] TASK  done    id=task-001 exit=0 dur=145s files=1
[2026-03-13 23:10:00] AUTH  bridge=win-001 platform=win32 hostname=DESKTOP-PC
[2026-03-13 23:10:05] TASK  submit  id=task-002 agent=pi caller=workflow
```

## 8. 容错与可靠性

### 8.1 断线重连（指数退避 + jitter）

```typescript
const reconnectConfig = {
  maxRetries: Infinity,        // 永不放弃重连
  baseDelay: 1000,
  maxDelay: 60000,
  jitter: 1000,
};
```

### 8.2 多 Bridge 故障转移

```
Gateway 分配任务 → Bridge A (Mac, online, 0 tasks) ✓
                     ↓
Bridge A 断线 → Gateway 重新分配 → Bridge B (Windows, online, 0 tasks) ✓
```

### 8.3 任务持久化

```
Bridge 内存队列 → 定期刷入磁盘 → 重启后恢复未完成任务
{configDir}/tasks/
├── pending/
│   ├── task-001.json
│   └── task-002.json
├── running/
│   └── task-003.json
└── completed/
    ├── task-001.result.json
    └── task-002.result.json
```

## 9. 风险与边界情况

### 9.1 已识别风险

| # | 风险 | 影响 | 跨平台 | 缓解措施 |
|---|------|------|--------|---------|
| 1 | 主机休眠/睡眠 | Bridge 断连 | 全平台 | 检测唤醒事件，自动重连 + 任务恢复 |
| 2 | IDE 未启动 | IDE 类型任务失败 | 全平台 | 降级到 CLI Adapter |
| 3 | Agent CLI 版本变化 | 命令行参数不兼容 | 全平台 | 启动时检测版本，上报 Gateway |
| 4 | 多任务同文件冲突 | 数据损坏 | 全平台 | 按项目路径加锁 |
| 5 | 防火墙/代理阻 WebSocket | 连接失败 | 全平台 | 支持 HTTP 长轮询 fallback |
| 6 | Gateway 重启 | 连接丢失 | 全平台 | Bridge 重连时上报本地状态 |
| 7 | 多人共用同一台机器 | 任务冲突 | 全平台 | 用户级隔离 + 任务 owner |
| 8 | Windows 路径分隔符 | 文件操作失败 | Windows | 统一使用 `path.join()` + `path.posix` |
| 9 | Windows 权限问题 | 子进程启动失败 | Windows | 检测 admin 权限，提示提权 |
| 10 | JetBrains 扩展市场审核 | 上线延迟 | JetBrains | Phase 3 内测先不发布市场 |
| 11 | 恶意 prompt | 执行危险操作 | 全平台 | Agent 沙箱 + 命令白名单 |
| 12 | 网络不稳定（移动设备） | 频繁断连 | 全平台 | 本地队列缓冲 + 断点续传 |

### 9.2 待讨论项

1. **多用户协作**：同一台机器多人使用，任务如何隔离？
2. **结果缓存**：相同 prompt 是否复用结果（节省 API 费用）？
3. **费用追踪**：远端 Agent API 调用费用如何统计和分摊？
4. **Git 集成**：任务完成后自动 commit/push？
5. **通知机制**：飞书 / 邮件 / IDE 内通知？
6. **IDE 识别**：如何检测当前活跃的 IDE 和项目？
7. **自动更新**：Bridge 版本自动升级？
8. **离线模式**：网络不可用时的本地任务队列？

## 10. 开发路线图

### Phase 1：MVP — CLI Agent 跨平台调度（1-1.5周）

**目标**：Gateway 能调度任意平台上 Mac/Windows/Linux 的 CLI Agent

- [ ] Bridge 核心服务（WebSocket + 任务队列 + 状态机）
- [ ] CLI Adapter（codex / pi / openclaw acp）
- [ ] 跨平台路径适配（platform.ts）
- [ ] 跨平台安装脚本（install.sh / install.ps1）
- [ ] 交互式配置向导（setup.ts）
- [ ] Token 认证 + 心跳
- [ ] Gateway 多 Bridge 注册 + 路由
- [ ] Bridge HTTP API
- [ ] 端到端测试（Mac + Windows）

**交付物**：`oc-bridge` npm 包，支持 Mac/Win/Linux，CLI Agent 调度

### Phase 2：IDE 集成 — VS Code / Cursor（1周）

**目标**：VS Code 和 Cursor IDE 内执行任务

- [ ] 文件队列机制（跨平台文件监听）
- [ ] VS Code 扩展（监听任务 + 注入终端 + 捕获结果）
- [ ] Cursor 扩展（复用 VS Code 方案，品牌适配）
- [ ] IDE 状态检测（当前打开的项目、活跃状态）
- [ ] 多任务并发控制（按项目锁定）

**交付物**：VS Code + Cursor 扩展（marketplace / open-vsx）

### Phase 3：JetBrains IDE + 编排系统集成（1.5周）

**目标**：支持 IntelliJ IDEA 系列IDE，编排系统 Workflow 可调用远端 Agent

- [ ] IntelliJ IDEA 扩展（文件队列 + HTTP API）
- [ ] RemoteAgentEngine 集成到编排系统
- [ ] Workflow 节点类型扩展
- [ ] 前端看板显示远端任务状态
- [ ] 飞书通知集成
- [ ] Git 自动 commit/push

**交付物**：JetBrains 插件 + 编排系统集成

### Phase 4：生产加固 + 多人协作（1周）

- [ ] 多用户任务隔离
- [ ] 费用追踪仪表板
- [ ] 结果缓存
- [ ] HTTP 长轮询 fallback
- [ ] Bridge 自动更新
- [ ] 离线模式
- [ ] 监控告警
- [ ] 完善文档

---

## 附录 A：与现有方案的关系

| 维度 | ACP（现有） | Remote Bridge（新） |
|------|------------|-------------------|
| 方向 | 单向（Mac→服务器） | **双向** |
| 平台 | 依赖 Node.js | **Mac + Windows + Linux** |
| IDE | VS Code MCP（被卡住） | **CLI + 多 IDE 适配** |
| Agent 位置 | 服务器上 | **Bridge 所在机器上** |
| 多机 | 不支持 | **多 Bridge 注册路由** |
| 编排系统集成 | 无 | **完整支持** |
| 开发状态 | 已验证连通 | 待开发 |

两者互补：
- **ACP**：IDE 里直接跟服务器 Agent 对话（单向，服务器执行）
- **Remote Bridge**：服务器主动推任务到任意机器的 Agent 执行（双向，本地执行）
