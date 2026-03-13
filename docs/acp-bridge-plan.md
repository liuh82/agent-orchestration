# OpenClaw ACP Bridge 跨主机开发方案

> 日期：2026-03-13
> 作者：小白
> 状态：待实施

## 一、目标

通过 OpenClaw 的 ACP (Agent Client Protocol) Bridge，实现：

1. **在 Mac IDE 里直接调用服务器上的 AI Agent（Codex / Claude Code 等）进行开发**
2. **跨主机 Agent 协作** — 本地 IDE ↔ 服务器 Gateway ↔ AI Agent
3. **小白（OpenClaw）可调度外部 Agent 执行开发任务**

## 二、架构

```
┌───────────────────────────────────────────────────────────────────┐
│  开发机 (Mac)                                                       │
│                                                                    │
│  ┌─────────────────┐         ┌──────────────────────────────┐    │
│  │ VS Code/Cursor  │  stdio  │ openclaw acp (bridge)        │    │
│  │ (.cursor.json)  │◄───────►│ 转发 ACP 协议 → WebSocket    │    │
│  └─────────────────┘         └──────────────┬───────────────┘    │
│                                             │                      │
└─────────────────────────────────────────────┼──────────────────────┘
                                              │ WebSocket (wss://)
                                              ▼
┌───────────────────────────────────────────────────────────────────┐
│  服务器 (81.70.98.45)                                              │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Nginx (:9443)                                               │   │
│  │   /acp-ws → proxy_pass ws://127.0.0.1:18789               │   │
│  └───────────────────────────┬────────────────────────────────┘   │
│                              │                                     │
│  ┌───────────────────────────▼────────────────────────────────┐   │
│  │ OpenClaw Gateway (:18789)                                   │   │
│  │                                                              │   │
│  │  ACP Runtime (acpx backend)                                 │   │
│  │  ├─ codex      (OpenAI Codex CLI)                           │   │
│  │  ├─ claude     (Claude Code)                                │   │
│  │  ├─ gemini     (Gemini CLI)                                 │   │
│  │  └─ kimi       (Kimi)                                       │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  项目目录: /root/.openclaw/workspace/agent-orchestration/         │
└───────────────────────────────────────────────────────────────────┘
```

## 三、核心概念

| 概念 | 说明 |
|------|------|
| **ACP** | Agent Client Protocol，AI Agent 间通信的标准协议（类似 MCP） |
| **ACP Bridge** | `openclaw acp` 命令，在 IDE 和 Gateway 之间桥接 ACP/stdio ↔ WebSocket |
| **acpx** | OpenClaw 的 ACP 运行时后端插件，管理 Codex / Claude Code 等外部 Agent |
| **Session** | 一次 ACP 会话，映射到一个 Gateway 会话 key |

## 四、实施步骤

### 第1步：服务器端 — 启用 ACP

```bash
# 1. 启用 acpx 插件
openclaw plugins install acpx
openclaw config set plugins.entries.acpx.enabled true

# 2. 启用 ACP
openclaw config set acp.enabled true
openclaw config set acp.backend acpx
openclaw config set acp.defaultAgent codex
openclaw config set acp.allowedAgents '["pi","claude","codex","opencode","gemini","kimi"]'

# 3. 权限模式（开发环境全放开）
openclaw config set plugins.entries.acpx.config.permissionMode approve-all
openclaw config set plugins.entries.acpx.config.nonInteractivePermissions fail

# 4. 会话配置
openclaw config set acp.runtime.ttlMinutes 240

# 5. 重启 Gateway
openclaw gateway restart

# 6. 验证
# (在飞书对话中发送) /acp doctor
```

### 第2步：服务器端 — Nginx 反代 WebSocket

在现有 Nginx 配置中添加 ACP WebSocket 反代：

```nginx
# 在 9443 端口的 server block 中添加
location /acp-ws {
    proxy_pass http://127.0.0.1:18789;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket 超时（开发任务可能较长）
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

```bash
# 测试 Nginx 配置
sudo nginx -t
sudo nginx -s reload
```

### 第3步：开发机 — 安装 openclaw CLI

```bash
# Mac 上安装（只需要 CLI，不需要 Gateway）
npm install -g openclaw

# 验证安装
openclaw --version

# 保存 Gateway Token
mkdir -p ~/.openclaw
echo "85a87cc43a456bb4648b91ee28ffdf3b357bbdb439f1c792" > ~/.openclaw/gateway.token
chmod 600 ~/.openclaw/gateway.token
```

### 第4步：开发机 — 配置 VS Code / Cursor

见单独的配置文件：`docs/vscode-cursor-acp-config.json`

### 第5步：验证连通性

```bash
# 在 Mac 终端测试
openclaw acp client \
  --server-args --url wss://81.70.98.45:9443/acp-ws \
  --server-args --token-file ~/.openclaw/gateway.token

# 能进入交互模式输入 prompt 就说明通了
```

## 五、使用方式

### 方式1：IDE 中直接对话（推荐）

在 VS Code / Cursor 中，OpenClaw ACP 作为一个 Agent Server 出现：
- 直接在编辑器的 Agent 面板里输入开发任务
- Agent 在服务器上执行，读写服务器上的文件
- 实时看到代码变更

### 方式2：飞书中调度

直接跟我说："用 Codex 把 task.py 迁移到 ORM"，我会调用：

```json
{
  "task": "将 task.py 迁移到 SQLAlchemy 2.0 ORM",
  "runtime": "acp",
  "agentId": "codex",
  "cwd": "/root/.openclaw/workspace/agent-orchestration",
  "mode": "run"
}
```

### 方式3：CLI 交互

```bash
# 一次性任务
openclaw acp \
  --url wss://81.70.98.45:9443/acp-ws \
  --token-file ~/.openclaw/gateway.token \
  --no-prefix-cwd

# 输入 prompt，回车，等结果
```

### 方式4：acpx 直接调用

```bash
# 安装 acpx
npm install -g acpx

# 配置 ~/.acpx/config.json（见下方）
acpx openclaw exec "将 backend/app/services/task.py 迁移到 SQLAlchemy ORM"
```

## 六、安全配置

| 项目 | 配置 | 说明 |
|------|------|------|
| Gateway 认证 | token 模式 | ✅ 已配置 |
| WebSocket | Nginx TLS 反代 | 复用 9443 端口 HTTPS |
| Token 存储 | 文件 (600权限) | 避免明文出现在命令行 |
| 防火墙 | 18789 不对外暴露 | 只通过 Nginx 访问 |
| Session TTL | 240 分钟 | 自动过期 |

## 七、支持的 Agent

| Agent ID | 工具 | 说明 |
|----------|------|------|
| `codex` | OpenAI Codex CLI | 默认 Agent，编码能力强 |
| `claude` | Claude Code | 代码理解和重构 |
| `gemini` | Gemini CLI | Google 出品 |
| `kimi` | Kimi | 月之暗面 |
| `opencode` | OpenCode | 开源方案 |
| `pi` | Pi | OpenClaw 内置 |

## 八、故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| 连接超时 | 防火墙挡了或 Nginx 未配 WebSocket | 检查 Nginx `/acp-ws` location |
| `ACP runtime backend is not configured` | acpx 插件未启用 | `openclaw config set plugins.entries.acpx.enabled true` |
| `ACP is disabled by policy` | ACP 全局关闭 | `openclaw config set acp.enabled true` |
| `Permission prompt unavailable` | 权限模式太严格 | 设为 `approve-all` |
| Session 无响应 | Agent 进程挂了 | `ps aux \| grep acpx` 检查，kill 重启 |
| Mac 上 `openclaw: command not found` | 未安装 | `npm install -g openclaw` |

## 九、扩展方向

### 多服务器

```
Mac ──► 服务器 A (主 Gateway) ──► 服务器 B (另一台 Gateway)
         │                         ├─ Codex
         ├─ Codex                  └─ Gemini
         └─ Claude Code
```

每台服务器独立 Gateway，通过 ACP 路由。

### 多 IDE 共享 Session

```
Mac VS Code ──┐
              ├──► 服务器 Gateway ──► 同一个 Codex Session
Mac Cursor  ──┘
```

通过 `--session` 参数绑定同一个 session key。

### Agent 自动调度

在 agent-orchestration 的 Workflow 中添加 ACP 调用节点：
1. Workflow 创建任务 → 调用 ACP → Codex 执行
2. 执行结果回写 Workflow 状态
3. 前端实时显示进度

---

## 附录

- OpenClaw ACP 文档: https://docs.openclaw.ai/cli/acp
- ACP 协议规范: https://agentclientprotocol.com/
- acpx 插件: OpenClaw 内置插件
