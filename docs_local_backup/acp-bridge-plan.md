# OpenClaw ACP Bridge 跨主机开发方案

> 日期：2026-03-13
> 作者：小白
> 状态：待实施
> 更新：2026-03-13 追加 Remote Agent Bridge 需求，调用 architect agent 重做架构设计

## 一、目标

通过 OpenClaw 的 ACP (Agent Client Protocol) Bridge，实现：

1. **在 Mac IDE 里直接调用服务器上的 AI Agent（Codex / Claude Code 等）进行开发**
2. **跨主机 Agent 协作** — 本地 IDE ↔ 服务器 Gateway ↔ AI Agent
3. **小白（OpenClaw）可调度外部 Agent 执行开发任务**
4. **Remote Agent Bridge** — 服务器 Gateway 可主动推任务到 Mac 上的 VS Code + Claude Code 插件执行开发（双向通信）

## 二、当前问题与限制

### 已验证的问题
1. **VS Code MCP**（`~/.vscode/mcp.json`）→ 报 `-32602 Invalid params`，`protocolVersion: "2025-11-25"` 不兼容
2. **Cursor MCP**（`~/.cursor/mcp.json`）→ 同样协议版本问题
3. **VS Code OpenClaw 插件**（marketplace）→ 同一个错误
4. **acpx** → 单向通信（Mac→服务器），服务器无法主动推任务
5. **`openclaw acp`** → 终端级 ACP 客户端，已验证连通，但非 IDE 集成
6. **acpx CLI** → `npm install -g acpx` 已验证可用（v0.3.0）

### 当前可用方案
- ✅ `openclaw acp` 连接 Gateway（终端交互）
- ✅ 浏览器 Control UI（`https://81.70.98.45`）
- ✅ VS Code Remote SSH → `root@81.70.98.45`
- ✅ 飞书助手协调

## 三、核心概念

| 概念 | 说明 |
|------|------|
| **ACP** | Agent Client Protocol，AI Agent 间通信的标准协议 |
| **ACP Bridge** | `openclaw acp` 命令，在 IDE 和 Gateway 之间桥接 ACP/stdio ↔ WebSocket |
| **acpx** | OpenClaw 的 ACP 运行时后端插件（npm 包 acpx@0.3.0），管理外部 Agent |
| **Remote Agent Bridge** | **新增**：Mac 上跑的桥接服务，让服务器能主动调度 Mac 上的开发工具 |
| **Session** | 一次 ACP 会话，映射到一个 Gateway 会话 key |

## 四、现有 ACP 方案（服务器端 Agent 执行）

```
┌───────────────────────────────────────────────────────────────────┐
│  开发机 (Mac)                                                       │
│                                                                    │
│  ┌─────────────────┐         ┌──────────────────────────────┐    │
│  │ VS Code/Cursor  │  stdio  │ openclaw acp (bridge)        │    │
│  │                 │◄───────►│ 转发 ACP 协议 → WebSocket    │    │
│  └─────────────────┘         └──────────────┬───────────────┘    │
│                                             │                      │
└─────────────────────────────────────────────┼──────────────────────┘
                                              │ WebSocket (wss://)
                                              ▼
┌───────────────────────────────────────────────────────────────────┐
│  服务器 (81.70.98.45)                                              │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ OpenClaw Gateway (:18789)                                   │   │
│  │  ├─ codex      (OpenAI Codex CLI)                           │   │
│  │  ├─ claude     (Claude Code)                                │   │
│  │  └─ kimi       (Kimi)                                       │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ⚠️ Agent 在服务器上执行，操作服务器上的文件                          │
└───────────────────────────────────────────────────────────────────┘
```

## 五、新增需求：Remote Agent Bridge（Mac 端 Agent 执行）

### 5.1 需求背景
1. 编排系统（agent-orchestration）当前只能通过 `subprocess.run()` 调用本地 CLI，没有远程 Agent 调用能力
2. VS Code MCP/ACP 集成被 `protocolVersion: "2025-11-25"` 卡住，IDE 插件无法直连 Gateway
3. acpx 只能单向（Mac→服务器），服务器无法主动推任务到 Mac
4. 用户希望：**服务器上的小白能主动控制 Mac 上的 VS Code + Claude Code 插件执行开发任务**

### 5.2 期望架构

```
┌───────────────────────────────────────────────────────────────────┐
│  服务器 (81.70.98.45)                                              │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ OpenClaw Gateway (:18789)                                   │   │
│  │  小白（main agent）                                           │   │
│  │  ├─ 本地 Agent（codex/claude on server）                     │   │
│  │  └─ 远程 Agent（通过 Remote Bridge 调度 Mac 上的开发工具）    │   │
│  └──────────────────────────────┬─────────────────────────────┘   │
│                                 │ WebSocket（双向）                   │
└─────────────────────────────────┼─────────────────────────────────┘
                                  │
┌─────────────────────────────────┼─────────────────────────────────┐
│  开发机 (Mac)                    │                                   │
│                                 ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Remote Agent Bridge Service (Node.js MCP Server)           │    │
│  │  ├─ 暴露工具：dev_task(), run_test(), read_file() 等       │    │
│  │  ├─ 任务队列：/tmp/oc-dev-tasks/                           │    │
│  │  └─ 状态回传：执行结果→Gateway→小白                          │    │
│  └───────────┬──────────────────────────────────┬────────────┘    │
│              │                                  │                  │
│     ┌────────▼────────┐              ┌─────────▼─────────┐      │
│     │ VS Code         │              │ CLI Agent          │      │
│     │ + Claude Code   │              │ (codex/pi/...)    │      │
│     │ 插件执行开发     │              │ 终端执行            │      │
│     └─────────────────┘              └───────────────────┘      │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

### 5.3 调用方（两个层级）
1. **OpenClaw 层**：小白通过 Gateway → Bridge → Mac VS Code + `claude code`
2. **编排系统层**：agent-orchestration 任务节点 → Bridge → Mac 上的 `codex`/`pi`/`claude`

### 5.4 核心能力需求
- **dev_task(prompt, project_path)**：向 Mac 开发工具推送开发任务
- **run_test(project_path, test_file)**：在 Mac 上跑测试
- **read_file(project_path, file_path)**：读取 Mac 上的文件
- **get_status(task_id)**：查询任务执行状态
- **cancel_task(task_id)**：取消执行中的任务
- **list_agents()**：列出 Mac 上可用的开发 Agent

### 5.5 技术约束
- 不能依赖 VS Code MCP 协议（版本不兼容）
- 需要支持多种 Agent（codex CLI, pi, openclaw acp, 直接命令行）
- Gateway 认证：token 模式
- WebSocket 双向通信 + 任务队列
- 执行结果实时回传

### 5.6 安全要求
- Token 认证（复用 Gateway token）
- 任务白名单（只允许执行特定类型的操作）
- 执行超时控制
- 日志审计

## 六、服务器配置（已完成）

### Gateway 端口
- **内部端口**：18789（Gateway 主端口）
- **外部端口**：443（Nginx SSL 代理 → 18789）
- **连接地址**：`wss://81.70.98.45`
- **Gateway token**：`85a87cc43a456bb4648b91ee28ffdf3b357bbdb439f1c792`

### 服务器配置（已生效）
```bash
openclaw config set acp.enabled true
openclaw config set acp.backend acpx
openclaw config set acp.defaultAgent codex
openclaw config set acp.allowedAgents '["pi","claude","codex","opencode","gemini","kimi"]'
openclaw config set plugins.entries.acpx.config.permissionMode approve-all
openclaw config set acp.runtime.ttlMinutes 240
openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
```

### 服务器已安装的 CLI Agent
- `@anthropic-ai/claude-code@2.1.74`
- `@openai/codex@0.114.0`

## 七、Mac 端配置

### 已安装
- `openclaw` CLI（v2026.3.12）
- `acpx`（v0.3.0，`npm install -g acpx`）
- `~/.openclaw/gateway.token`（Gateway token）

### 已验证连通
- ✅ `openclaw acp --url wss://81.70.98.45 --token-file ~/.openclaw/gateway.token` — 连通

## 八、编排系统现状

### 当前 Agent 调用方式
- **唯一方式**：`lobster_engine.py` 通过 `subprocess.run()` 调用本地 CLI
- **局限**：只能调用服务器本地的 CLI 工具，不能调用远端 Agent
- **无任务队列**：没有异步调度、重试、超时管理

### 编排系统需要的 Bridge 能力
1. Workflow 任务节点能调度远端 Agent（Mac 上的 codex/claude）
2. 支持同步和异步两种执行模式
3. 执行结果回写到 Workflow 状态
4. 前端看板实时显示进度

## 九、故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| VS Code MCP `-32602` | protocolVersion 不兼容 | 用 Remote Bridge 替代 |
| `openclaw: command not found` | PATH 问题 | 绝对路径或从终端启动 |
| `acpx: command not found` | 未全局安装 | `npm install -g acpx` |
| Gateway 显示旧版本 | systemd 路径写死 | `openclaw doctor --repair` |

## 十、附录

- OpenClaw ACP 文档: `docs/cli/acp.md`
- ACP 协议规范: https://agentclientprotocol.com/
- GitHub repo: https://github.com/liuh82/agent-orchestration.git
