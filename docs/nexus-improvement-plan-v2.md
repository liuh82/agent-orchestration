# Nexus 改进方案 v2

> 基于 CCDesk 端到端验证 + CCG Workflow (4k stars) 参考分析
> 日期：2026-03-19
> 状态：待执行

---

## 背景与参考

### CCDesk 验证发现的问题（12 项，已整理优先级）
详见 `docs/NEXUS_IMPROVEMENTS.md`（在 claude-code-desktop 仓库）

### CCG Workflow 值得借鉴的设计
| CCG 设计 | 参考价值 | 对应 Nexus 改进 |
|---|---|---|
| Go codeagent-wrapper SSE 实时推送 | ✅ 已验证可行 | 迭代一 T1-T2 |
| Backend interface 多后端抽象 | ✅ 扩展性设计 | 迭代一 T3（为多模型做准备）|
| 外部模型只读 + Claude 审核 patch | ✅ 安全设计 | 迭代四 T13 |
| 双层超时（全局 + 单命令） | ✅ 已验证稳定 | 迭代三 T9 |
| 结构化 TaskResult 提取 | ✅ 直接参考 | 迭代一 T5 |
| 失败自动重试（3 次 + 降级） | ✅ 可靠性设计 | 迭代三 T10 |

### OPSX 约束驱动方法论
| OPSX 能力 | 价值 | 对应 Nexus 改进 |
|---|---|---|
| 约束推理（需求→约束集） | 消除 AI 自由发挥 | 迭代六 T19 |
| 零决策计划（约束→可执行计划） | 执行可复现 | 迭代六 T20 |
| 多模型交叉验证 | 发现单模型盲点 | 迭代六 T21 |
| PBT 属性测试 | 验证约束是否满足 | 迭代六 T22 |
| Artifact 管理体系 | 需求→规格→计划→执行 全链路追踪 | 迭代六 T19-T22 |
| 角色提示词注入 | 外部模型遵守项目规范 | 迭代六 T20 |

---

## 迭代一：P0 — 实时输出流 + 结构化结果

**目标：** 消除任务执行黑盒，让用户实时看到 CC 在做什么、改了哪些文件。
**参考：** CCG codeagent-wrapper/server.go 的 SSE 推送架构。

### T1: CC 输出实时解析器
**文件：** `bridges/oc-bridge/src/agent/output-parser.ts`（新建）

```typescript
// 参考 CCG 的 UnifiedEvent 设计，统一解析所有后端格式
interface CCEvent {
  type: "assistant" | "user" | "result" | "system" | "error";
  subtype?: string;  // tool_use, tool_result, text, thinking
  content?: string;
  toolName?: string;  // Write, Edit, Bash, Read, Glob, Grep
  toolInput?: Record<string, any>;
  isError?: boolean;
  sessionId?: string;
  costUsd?: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

interface StructuredResult {
  filesModified: Array<{ path: string; action: "created" | "edited" | "deleted" }>;
  commandsRun: Array<{ command: string; exitCode: number | null; durationMs?: number }>;
  errors: string[];
  summary: string;
  tokenUsage: { input: number; output: number };
  costUsd: number;
}

function parseStreamLine(line: string): CCEvent | null
function buildStructuredResult(events: CCEvent[]): StructuredResult
```

**解析规则：**
- `type: "assistant"` + `subtype: "tool_use"` → 提取 toolName, toolInput
- `type: "user"` + `subtype: "tool_result"` → 提取 isError
- `type: "result"` → 提取 summary, costUsd, durationMs, inputTokens, outputTokens
- Write tool → filesModified (file_path → created)
- Edit tool → filesModified (file_path → edited)
- Bash tool → commandsRun (command → command, exit_code)

### T2: oc-bridge 实时进度转发
**文件：**
- `bridges/oc-bridge/src/websocket/types.ts` — 新增 TaskProgress 消息
- `bridges/oc-bridge/src/agent/claude-code.ts` — 实时回调
- `bridges/oc-bridge/src/task/task-manager.ts` — WebSocket 转发

```typescript
// 实时进度消息（参考 CCG ContentEvent）
interface TaskProgress {
  type: "task.progress";
  taskId: string;
  timestamp: number;
  event: {
    type: "tool_use" | "tool_result" | "text" | "thinking" | "error" | "done";
    content?: string;        // 文本内容或预览（前 500 字）
    toolName?: string;       // Write, Edit, Bash...
    filePath?: string;       // 文件路径（如适用）
    command?: string;        // 命令（如 Bash）
    isError?: boolean;
  };
}
```

**关键实现：**
- `claude-code.ts` 的 spawn stdout 每行调用 `onProgress(event: CCEvent)`
- `onProgress` 通过 `task-manager.ts` 的 WebSocket 发送 `task.progress`
- 任务完成时额外发送 `task.complete`（含 StructuredResult）

### T3: Gateway 后端 SSE 推送
**文件：**
- `backend/app/services/gateway/ws_server.py` — 新增事件广播
- `backend/app/routers/gateway.py` — 新增 SSE 端点

```
GET /api/gateway/tasks/{task_id}/stream → SSE

事件格式：
event: tool_use
data: {"toolName":"Write","filePath":"/src/app.rs","content":"Creating file..."}

event: text
data: {"content":"I'll implement the module by..."}

event: done
data: {"result":{"filesModified":[...],"commandsRun":[...],"costUsd":0.05}}
```

**实现要点：**
- 使用内存 dict 存储 {task_id: [sse_clients]}
- oc-bridge 发来 `task.progress` → 查找对应 SSE 订阅者 → 推送
- oc-bridge 发来 `task.complete` → 推送 done 事件 → 清理订阅者
- 超时无客户端订阅则不缓存（节省内存）

### T4: 结构化结果持久化
**文件：**
- `backend/app/models/gateway.py` — gateway_tasks 新增 result_data TEXT 列
- `backend/app/models/gateway_schemas.py` — TaskInfo 新增 result_data
- Alembic 迁移

```python
# result_data JSON 结构（参考 CCG TaskResult）
{
  "files_modified": [{"path": "src/app.rs", "action": "created"}],
  "commands_run": [{"command": "cargo check", "exit_code": 0, "duration_ms": 5400}],
  "errors": [],
  "summary": "Completed implementation of...",
  "token_usage": {"input": 15000, "output": 8000},
  "cost_usd": 0.052
}
```

### T5: 前端任务实时输出页
**文件：**
- `frontend/src/pages/tasks/TaskDetailPage.tsx` — 实时输出标签页
- `frontend/src/components/tasks/ToolUseCard.tsx` — 工具调用卡片
- `frontend/src/components/tasks/FileChangeList.tsx` — 文件变更列表
- `frontend/src/hooks/useTaskStream.ts` — SSE 连接 hook

**UI 设计：**
- 工具调用：折叠卡片，标题 `🔧 Write → /src/app.rs`，展开显示内容
- 文本消息：Markdown 渲染
- 思考过程：灰色折叠区域（默认折叠）
- 错误：红色高亮
- 完成后：显示文件变更列表 + 命令历史 + 费用
- 自动滚动到底部，新消息时保持滚动位置（除非用户手动上滚）

### 迭代一 CC 执行 Prompt

```
Read CLAUDE.md first. This is the highest priority constraint file.

Context: You are implementing Iteration 1 of Nexus improvements — Real-time task output streaming.
Reference: CCG Workflow (github.com/fengshao1227/ccg-workflow) uses a similar SSE streaming architecture for real-time CLI output.

Project: /root/.openclaw/workspace/agent-orchestration

Steps:

1. Create bridges/oc-bridge/src/agent/output-parser.ts:
   - CCEvent interface (type, subtype, content, toolName, toolInput, isError, costUsd, tokenUsage)
   - StructuredResult interface (filesModified, commandsRun, errors, summary, tokenUsage, costUsd)
   - parseStreamLine(line: string): CCEvent | null — parse one stream-json line
   - buildStructuredResult(events: CCEvent[]): StructuredResult — aggregate full task output

2. Update bridges/oc-bridge/src/websocket/types.ts:
   - Add TaskProgress type (type: "task.progress", taskId, timestamp, event: { type, content, toolName, filePath, command, isError })
   - Add resultData: StructuredResult to TaskComplete type

3. Update bridges/oc-bridge/src/agent/claude-code.ts:
   - Import output-parser
   - On each stdout line: call parseStreamLine, then call onProgress callback
   - On process exit: call buildStructuredResult, include in completion message

4. Update bridges/oc-bridge/src/task/task-manager.ts:
   - Add onProgress handler that sends TaskProgress via WebSocket

5. Backend: Add result_data TEXT column to gateway_tasks table
   - Create alembic migration
   - Update gateway_schemas.py TaskInfo with result_data field
   - Save result_data on task completion in task_router.py

6. Backend: Add SSE endpoint in gateway.py:
   - GET /api/gateway/tasks/{task_id}/stream
   - In-memory subscriber dict: {task_id: [response objects]}
   - On task.progress/task.complete from bridge: forward to SSE subscribers

7. Frontend: Add real-time output tab to TaskDetailPage
   - useTaskStream hook connecting to SSE endpoint
   - ToolUseCard component for tool calls
   - Auto-scroll, markdown rendering
   - File change list after completion

Build checks:
- cd bridges/oc-bridge && npm run build
- cd backend && python3 -c "from app.models.gateway import *; print('OK')"

Commit: git add -A && git commit -m "feat(P0): real-time task output streaming + structured results"
Do NOT push.
```

---

## 迭代二：P0 — 断点续传 + 任务依赖

**目标：** 任务超时/中断不丢进度，支持从断点恢复。
**参考：** CCG 的失败重试（3 次 + 降级）和 Binary 下载容错（重试 + 备份恢复）。

### T6: 超时保护与中间结果保存
**文件：**
- `bridges/oc-bridge/src/task/task-manager.ts`
- `bridges/oc-bridge/src/agent/claude-code.ts`

**设计（参考 CCG 双层超时）：**
```
配置项（可在 SubmitTaskRequest 中指定）：
- timeout: 300 (默认，总超时)
- grace_period: 60 (超时前警告时间)
- hard_timeout: timeout + 30 (SIGKILL 硬超时)

时间线：
0s ─────── (timeout-60s) ─────── timeout ── +30s ── hard_timeout
                  │                 │              │
                  │            SIGINT              SIGKILL
           task.warning      save partial       force kill
           event to GW       output
```

**关键：** SIGINT 而非 SIGKILL。CC 收到 SIGINT 会完成当前操作后退出，输出不丢失。参考 CCG 的 `CODEX_TIMEOUT` + `CODEAGENT_POST_MESSAGE_DELAY` 设计。

### T7: 任务 Resume API
**文件：**
- `backend/app/routers/gateway.py` — 新增 resume 端点
- `backend/app/services/gateway/task_router.py` — resume 逻辑

```python
POST /api/gateway/tasks/{task_id}/resume
{
  "prompt_suffix": "从上次中断的地方继续",  // 可选
  "timeout": 300,
  "skip_permissions": false
}

# Resume 行为：
# 1. 获取原任务的 result_data 和 partial_output
# 2. 构造新 prompt：
#    "[RESUME CONTEXT] You were previously working on this task and it was interrupted.
#     Files you modified: {files_modified list}
#     Commands you ran: {commands_run list}
#     Last output: {last 2000 chars of output}
#
#     Original task: {original_prompt}
#     {prompt_suffix}"
# 3. 提交新任务，parent_task_id 指向原任务
# 4. 返回新 task_id
```

### T8: 任务依赖链
**文件：**
- `backend/app/models/gateway_schemas.py` — SubmitTaskRequest 新增 depends_on
- `backend/app/services/gateway/task_router.py` — 依赖检查和自动解锁

```python
class SubmitTaskRequest(BaseModel):
    depends_on: Optional[list[str]] = None  # task_id list

# 新增状态：blocked（等待依赖完成）
# on_task_completed: 检查是否有 blocked 任务依赖此 task
# 如果所有依赖都已完成 → 自动路由执行
```

### 迭代二 CC 执行 Prompt

```
Read CLAUDE.md first.

Context: Iteration 2 — Task resume + dependency chain.
Reference: CCG uses retry + fallback patterns for reliability.

Project: /root/.openclaw/workspace/agent-orchestration

Steps:

1. bridges/oc-bridge/src/task/task-manager.ts — Graceful timeout:
   - Add grace_period config (default 60s before timeout)
   - At (timeout - grace_period): send task.warning via WebSocket
   - At timeout: send SIGINT to CC process (not SIGKILL)
   - Wait 30s for graceful exit
   - If still running: SIGKILL
   - On any exit after timeout: save full output as partial_result

2. backend/app/models/gateway_schemas.py:
   - Add 'blocked' to TaskStatus enum
   - Add depends_on: Optional[list[str]] = None to SubmitTaskRequest
   - Add ResumeTaskRequest model
   - Add parent_task_id: Optional[str] to TaskInfo

3. backend/app/services/gateway/task_router.py:
   - submit_task: validate depends_on tasks exist and are completed; if not, set status='blocked'
   - on_task_completed: query blocked tasks depending on this one; if all deps met, route
   - Add resume_task(task_id, prompt_suffix, timeout, skip_permissions):
     * Get original task's result_data, partial_output, prompt
     * Build resume prompt with context
     * Submit as new task with parent_task_id set

4. backend/app/routers/gateway.py:
   - POST /api/gateway/tasks/{task_id}/resume
   - Use ResumeTaskRequest body

5. Database: Alembic migration for parent_task_id column

Build checks:
- cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"

Commit: git add -A && git commit -m "feat(P0): task resume + dependency chain + graceful timeout"
Do NOT push.
```

---

## 迭代三：P1 — 超时策略 + 负载均衡 + 失败重试

**目标：** 提高系统可靠性和资源利用率。
**参考：** CCG 的 Gemini 3 次重试 + 降级、加权路由。

### T9: 失败自动重试（参考 CCG 重试机制）
**文件：**
- `backend/app/services/gateway/task_router.py`

```python
# 任务级别重试配置
class SubmitTaskRequest(BaseModel):
    max_retries: int = 0  # 默认不重试，>0 启用

# 重试策略（参考 CCG：3 次 + 降级）：
# - 只重试 exit_code != 0 且非用户取消的任务
# - 重试次数 ≤ max_retries
# - 每次重试间隔 5s（指数退避：5s, 10s, 20s）
# - 重试时 prompt 前注入 "[RETRY attempt N] Previous attempt failed: {error_summary}"
# - 如果有多个 bridge，重试时切换到不同 bridge
```

### T10: Bridge 智能路由
**文件：**
- `backend/app/services/gateway/task_router.py`

```python
# 路由策略（参考 CCG 的并行 worker 分配）：
def select_bridge(self, task):
    bridges = self.get_available_bridges()
    if not bridges:
        raise NoBridgeAvailable()

    # 策略：最少任务优先（Least Loaded）
    bridges.sort(key=lambda b: b.active_tasks_count)
    best = bridges[0]

    # 追加任务类型亲和性：cli 类型任务优先分配给执行过 cli 的 bridge
    cli_bridges = [b for b in bridges if b.last_task_type == 'cli']
    if cli_bridges and task.agent_type == 'cli':
        cli_bridges.sort(key=lambda b: b.active_tasks_count)
        if cli_bridges[0].active_tasks_count <= best.active_tasks_count + 1:
            best = cli_bridges[0]

    return best
```

### T11: 成本追踪仪表板
**文件：**
- `backend/app/models/gateway.py` — 新增 cost_usd 列
- `frontend/src/pages/tasks/TaskDetailPage.tsx` — 费用显示
- `frontend/src/pages/dashboard/DashboardPage.tsx` — 汇总统计

### 迭代三 CC 执行 Prompt

```
Read CLAUDE.md first.

Context: Iteration 3 — Reliability improvements.
Reference: CCG uses 3-retry + fallback for Gemini, and least-loaded routing.

Project: /root/.openclaw/workspace/agent-orchestration

Steps:

1. backend/app/services/gateway/task_router.py — Auto retry:
   - Add max_retries to SubmitTaskRequest (default 0)
   - On task failure (exit_code != 0): if retries < max_retries:
     * Wait 5s * 2^retry_count (exponential backoff)
     * Inject retry context into prompt
     * Route to different bridge if available
     * Increment retry counter
   - Log retry attempts

2. backend/app/services/gateway/task_router.py — Smart bridge selection:
   - select_bridge: sort by active_tasks_count ascending
   - Add task type affinity: prefer bridge with matching last_task_type
   - Add load logging

3. Database: cost_usd column on gateway_tasks + Alembic migration

4. Frontend: Cost display in TaskDetailPage + dashboard summary

Build checks:
- cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"
- cd frontend && npm run build

Commit: git add -A && git commit -m "feat(P1): auto-retry + smart routing + cost tracking"
Do NOT push.
```

---

## 迭代四：P1 — 前端增强 + 安全沙盒

**目标：** 提升前端体验，增加执行安全性。
**参考：** CCG 的"外部模型只返回 patch，Claude 审核后才 apply"设计。

### T12: 任务执行日志分页
- `GET /api/gateway/tasks/{id}/logs?page=1&size=100&event_type=tool_use`

### T13: 安全沙盒模式
- 沙盒目录隔离执行 → diff 预览 → 用户确认 apply

### T14: 多 Agent 并行状态面板
- Bridge 状态 + 任务时间线 + 实时更新

### 迭代四 CC 执行 Prompt

```
Read CLAUDE.md first.

Context: Iteration 4 — Frontend enhancement + security sandbox.
Reference: CCG's "external models return patches, Claude reviews before applying" design.

Project: /root/.openclaw/workspace/agent-orchestration

Steps:

1. backend/app/routers/gateway.py — Paginated task logs:
   - GET /api/gateway/tasks/{id}/logs?page=1&size=100&event_type=tool_use
   - Filter by event_type, search in content

2. Security sandbox mode:
   - Add sandbox_mode: bool = False to SubmitTaskRequest
   - In claude-code.ts: if sandbox_mode, set workdir to /tmp/nexus-sandbox-{task_id}/
   - Copy target project files to sandbox before execution
   - After execution: diff sandbox vs original, generate patch list
   - New API: POST /api/gateway/tasks/{id}/apply-patch
   - New API: POST /api/gateway/tasks/{id}/discard-patch

3. Frontend dashboard:
   - BridgeStatus: online/offline, active task count
   - TaskTimeline: running/completed/failed chronological order
   - Live update via polling or WebSocket

Build checks:
- cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"
- cd bridges/oc-bridge && npm run build
- cd frontend && npm run build

Commit: git add -A && git commit -m "feat(P1): sandbox mode + dashboard + paginated logs"
Do NOT push.
```

---

## 迭代五：P1 — 多 CLI 后端支持（Codex + OpenCode）

**目标：** 扩展 oc-bridge 支持更多 AI 编码 CLI，参考 CCG 的 Backend interface 抽象。
**参考：** CCG codeagent-wrapper/config.go 的多后端注册 + 路由设计。

### 背景

CCG 支持 3 个后端（Codex、Claude、Gemini），通过统一的 Backend interface 调度。
Nexus 目前只支持 Claude Code CLI。需要扩展支持：
- **OpenAI Codex CLI** (`codex`) — OpenAI 的编码代理
- **OpenCode** (`opencode`) — 开源终端 AI 编码工具

### T25: 多后端抽象层
**文件：**
- `bridges/oc-bridge/src/agent/base.ts`（新建）— 统一后端接口
- `bridges/oc-bridge/src/agent/claude-code.ts` — 重构为 implements BaseAgent
- `bridges/oc-bridge/src/agent/codex-code.ts`（新建）— Codex CLI 封装
- `bridges/oc-bridge/src/agent/opencode.ts`（新建）— OpenCode 封装
- `bridges/oc-bridge/src/agent/registry.ts` — 后端注册表

**设计（参考 CCG Backend interface）：**
```typescript
// 统一后端接口
interface BaseAgent {
  name: string;              // "claude" | "codex" | "opencode"
  command: string;           // CLI 可执行文件名
  buildArgs(config: AgentConfig, prompt: string): string[];
  parseOutput(line: string): CCEvent | null;
  buildStructuredResult(events: CCEvent[]): StructuredResult;
  detectPresence(): boolean; // 检测 CLI 是否已安装
}

// 后端注册表
const agentRegistry: Record<string, () => BaseAgent> = {
  claude: () => new ClaudeCodeAgent(),
  codex: () => new CodexCodeAgent(),
  opencode: () => new OpenCodeAgent(),
};
```

### T26: Codex CLI 适配
**文件：**
- `bridges/oc-bridge/src/agent/codex-code.ts`

**Codex CLI 特性：**
```bash
# Codex 执行方式
codex --full-auto --json "prompt"  # 自动模式 + JSON 输出
codex -q -a full-auto "prompt"     # 安静模式

# 输出格式：JSON stream
# { "type": "message", "content": "..." }
# { "type": "tool_call", "name": "shell", "arguments": { "command": "..." } }
# { "type": "tool_result", "output": "..." }
# { "type": "done", "cost": 0.05, "tokens": { "input": 1000, "output": 500 } }
```

**适配要点：**
- `buildArgs`: `["--full-auto", "--json", prompt]`
- `parseOutput`: 解析 Codex JSON stream 格式
- 权限模式：`--full-auto`（Codex 没有 skip-permissions 概念）
- 工作目录：通过 `--cwd` 参数指定（或 codex 的默认行为）

### T27: OpenCode 适配
**文件：**
- `bridges/oc-bridge/src/agent/opencode.ts`

**OpenCode 特性：**
```bash
# OpenCode 执行方式
opencode "prompt"                    # 交互模式
opencode -p "prompt"                 # 单次执行（pipe mode）
opencode --provider openai "prompt"  # 指定 provider

# 输出格式：可能为纯文本或 JSON（取决于版本）
```

**适配要点：**
- 需要调研 OpenCode 的最新 CLI 参数和输出格式
- `buildArgs`: `["-p", prompt]`（pipe mode）
- `parseOutput`: 根据实际输出格式适配
- OpenCode 可能需要配置文件（`~/.config/opencode/config.json`）

### T28: 后端自动检测 + 路由
**文件：**
- `bridges/oc-bridge/src/cli/start.ts` — 启动时检测可用后端
- `bridges/oc-bridge/src/websocket/connection.ts` — 上报可用后端列表
- `backend/app/services/gateway/bridge_manager.py` — 按后端类型路由

**自动检测：**
```typescript
// 启动时检测
async function detectAgents(): Promise<DetectResult[]> {
  const results: DetectResult[] = [];
  for (const [name, factory] of Object.entries(agentRegistry)) {
    const agent = factory();
    const present = agent.detectPresence();
    let version = null;
    if (present) {
      version = await getAgentVersion(agent.command);
    }
    results.push({ name, present, version });
  }
  return results;
}
```

**Gateway 路由增强：**
```python
# SubmitTaskRequest 新增 backend_preference
class SubmitTaskRequest(BaseModel):
    backend: Optional[str] = None  # "claude" | "codex" | "opencode" | None(auto)

# task_router.select_bridge:
# 1. 如果指定了 backend，找支持该 backend 的 bridge
# 2. 如果未指定，按任务类型自动选择
#    - agent_type=cli → 优先 claude（已验证稳定）
#    - agent_type=codex → 只用 codex bridge
#    - agent_type=opencode → 只用 opencode bridge
```

### T29: 后端配置管理
**文件：**
- `bridges/oc-bridge/src/config/agent-config.ts`（新建）

```typescript
interface AgentConfig {
  name: string;
  enabled: boolean;
  command: string;           // CLI 路径（可自定义）
  defaultArgs: string[];     // 默认参数
  timeout: number;           // 默认超时
  workDir: string;           // 默认工作目录
  envVars: Record<string, string>;  // 环境变量
}

// 配置文件：~/.oc-bridge/agents.json
{
  "claude": {
    "enabled": true,
    "command": "claude",
    "defaultArgs": ["--output-format", "stream-json", "--verbose"],
    "timeout": 600
  },
  "codex": {
    "enabled": true,
    "command": "codex",
    "defaultArgs": ["--full-auto", "--json"],
    "timeout": 600
  },
  "opencode": {
    "enabled": false,
    "command": "opencode",
    "defaultArgs": ["-p"],
    "timeout": 600
  }
}
```

### T30: 前端后端选择 UI
**文件：**
- `frontend/src/components/workflow/NodeConfigPanel.tsx` — agent 节点配置增加后端选择
- `frontend/src/components/gateway/BridgeDetail.tsx` — 显示 bridge 支持的后端列表

**UI 设计：**
- agent 节点配置新增 "AI 后端" 下拉框：Claude / Codex / OpenCode / 自动
- Bridge 详情页显示支持的后端列表和版本
- 任务提交时显示后端选择状态

### 迭代五 CC 执行 Prompt

```
Read CLAUDE.md first.

Context: Iteration 5 — Multi-backend support (Codex CLI + OpenCode).
Reference: CCG codeagent-wrapper/config.go Backend interface pattern.
CCG supports 3 backends (Codex, Claude, Gemini) via unified interface.

Project: /root/.openclaw/workspace/agent-orchestration

## IMPORTANT: Research first
Before writing code, research the CLI interfaces:

1. Codex CLI: Run `codex --help` to check current CLI arguments and output format
   Check: `codex --full-auto --json` output format (JSON stream structure)

2. OpenCode: Check https://github.com/opencode-ai/opencode for CLI usage
   Check: `opencode --help` and `opencode -p` output format

## Steps

1. Create bridges/oc-bridge/src/agent/base.ts:
   - BaseAgent interface (name, command, buildArgs, parseOutput, buildStructuredResult, detectPresence)
   - AgentConfig interface
   - Common CCEvent and StructuredResult types (move from output-parser.ts if needed)

2. Refactor bridges/oc-bridge/src/agent/claude-code.ts:
   - Implement BaseAgent interface
   - Move CLI-specific logic into buildArgs and parseOutput
   - Keep existing WebSocket and progress logic unchanged

3. Create bridges/oc-bridge/src/agent/codex-code.ts:
   - Implement BaseAgent interface for Codex CLI
   - buildArgs: ["--full-auto", "--json", prompt]
   - parseOutput: parse Codex JSON stream format
   - detectPresence: check if `codex` command exists

4. Create bridges/oc-bridge/src/agent/opencode.ts:
   - Implement BaseAgent interface for OpenCode
   - Research actual CLI args and output format first
   - parseOutput: handle OpenCode output format

5. Update bridges/oc-bridge/src/agent/registry.ts:
   - Register all 3 backends
   - addAgent(name, factory) for extensibility
   - getAgent(name): BaseAgent

6. Update bridges/oc-bridge/src/cli/start.ts:
   - On startup: detect all available agents and their versions
   - Report available agents in heartbeat message

7. Create bridges/oc-bridge/src/config/agent-config.ts:
   - AgentConfigManager: load/save ~/.oc-bridge/agents.json
   - Per-agent enable/disable, custom command path, default args, timeout, env vars

8. Update backend/app/models/gateway_schemas.py:
   - Add backend: Optional[str] = None to SubmitTaskRequest
   - Add supported_backends field to BridgeInfo

9. Update backend/app/services/gateway/task_router.py:
   - select_bridge: filter by backend preference
   - Auto-select based on agent_type if backend not specified

10. Frontend: Agent node config backend selector
    - Dropdown: Claude / Codex / OpenCode / Auto
    - Bridge detail: show supported backends

Build checks:
- cd bridges/oc-bridge && npm run build
- cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"

Commit: git add -A && git commit -m "feat(P1): multi-backend support — Codex CLI + OpenCode"
Do NOT push.
```

---

## 迭代六：P2 — 增强功能

### T15: Prompt 模板管理
- CRUD API + 前端编辑器

### T16: 任务依赖可视化
- DAG 图 + 实时状态

### T17: Webhook 通知
- 钉钉/飞书/Slack

### T18: 审计日志
- API 调用记录 + 查看页面

---

## 迭代七：P0 — OPSX 约束驱动体系（质量革命）

**目标：** 解决 AI 编码的核心问题——质量和可复现性。让 Nexus 不仅是"怎么调度"，还能"怎么做对"。
**参考：** OPSX（fission-ai/opsx）+ CCG spec-* 命令
**策略：** 优先原生实现，不成就集成 OPSX。

### 核心理念

> **先消除所有决策点，再执行。执行阶段不需要做任何判断。**

OPSX 的 4 步严格分离：
```
模糊需求 → 约束集(Research) → 零决策计划(Plan) → 机械执行(Impl) → 交叉验证(Review)
```

### Nexus 与 OPSX 的差距

| 维度 | OPSX 现状 | Nexus 现状 | 差距 |
|------|----------|----------|------|
| 需求理解 | 多模型并行探索+Prompt 增强 | 直接发 prompt 给 CC | 无约束推理 |
| 决策时机 | 全部在 Plan 阶段做完 | 执行时 CC 自己决策 | 执行不可复现 |
| 多模型验证 | Codex+Gemini 并行分析，冲突标记 Critical | 单模型执行 | 无交叉验证 |
| 约束管理 | openspec/ 目录存储约束集+PBT 属性 | 无约束概念 | 无质量门控 |
| Artifact 追踪 | proposal→specs→design→tasks 全链路 | 只有 prompt+result | 无需求追溯 |
| 可复现性 | 高（零决策计划） | 低（同一 prompt 两次不同结果） | 核心缺陷 |

### T19: 约束推理节点（spec-research）
**新增节点类型：** `spec`

**文件：**
- `backend/app/services/workflow_engine/nodes/spec_node.py`（新建）
- `backend/app/services/workflow_engine/nodes/base.py` — 注册
- `frontend/src/components/workflow/NodeConfigPanel.tsx` — 配置面板

**设计：**
```python
@NodeRegistry.register("spec", label="Constraint Analysis", category="quality", icon="search")
class SpecNode(BaseNodeExecutor):
    """将模糊需求转化为可验证的约束集"""

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "约束分析"},
            "requirement": {
                "type": "string",
                "title": "需求描述",
                "description": "要实现的功能或需求"
            },
            "scope": {
                "type": "string",
                "title": "分析范围",
                "enum": ["full", "backend", "frontend", "infrastructure"],
                "default": "full"
            },
            "parallel_models": {
                "type": "boolean",
                "title": "多模型并行分析",
                "description": "使用多个模型交叉分析",
                "default": True
            },
            "max_constraints": {
                "type": "integer",
                "title": "最大约束数",
                "default": 50
            }
        }
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        requirement = context.node_config["requirement"]
        scope = context.node_config.get("scope", "full")

        # Step 1: Prompt 增强（参考 CCG /ccg:enhance）
        enhanced = await self._enhance_prompt(requirement, scope)

        # Step 2: 约束提取
        constraints = await self._extract_constraints(enhanced, scope)

        # Step 3: 成功判据
        criteria = await self._define_criteria(constraints)

        return NodeResult(
            output_data={
                "original_requirement": requirement,
                "enhanced_requirement": enhanced,
                "constraints": constraints,          # [{id, text, category, priority, verifiable}]
                "success_criteria": criteria,        # [{id, text, constraint_ids, pbt_properties}]
                "scope": scope,
                "artifacts": {
                    "proposal": "...",  # 约束提案文本
                }
            }
        )
```

**约束提取的 Prompt 模板：**
```
你是一个约束分析专家。将以下需求转化为可验证的约束集。

需求：{enhanced_requirement}
范围：{scope}
分析维度：
1. 功能约束 — 必须实现什么
2. 安全约束 — 不能做什么、必须防护什么
3. 性能约束 — 延迟、吞吐、资源限制
4. 兼容性约束 — API 兼容、数据迁移、向后兼容
5. 架构约束 — 代码组织、模块边界、依赖方向
6. 测试约束 — 测试覆盖、边界条件、异常处理

对每个约束，必须明确：
- 约束文本（精确、无歧义）
- 优先级（MUST / SHOULD / MAY）
- 可验证性（如何验证此约束被满足）
- 反例（违反此约束的例子）

输出 JSON 数组。
```

### T20: 零决策计划节点（spec-plan）
**新增节点类型：** `plan`

**文件：**
- `backend/app/services/workflow_engine/nodes/plan_node.py`（新建）

**设计：**
```python
@NodeRegistry.register("plan", label="Zero-Decision Plan", category="quality", icon="clipboard")
class PlanNode(BaseNodeExecutor):
    """将约束集转化为零决策可执行计划"""

    async def execute(self, context: NodeContext) -> NodeResult:
        # 上游 spec 节点输出
        constraints = context.upstream_outputs.get("constraints", [])
        criteria = context.upstream_outputs.get("success_criteria", [])

        # Step 1: 多模型实现分析（参考 CCG 并行分析）
        if context.node_config.get("parallel_models"):
            analysis_a = await self._analyze_with_model(constraints, model="claude")
            analysis_b = await self._analyze_with_model(constraints, model="codex")
            conflicts = self._find_conflicts(analysis_a, analysis_b)
        else:
            analysis_a = await self._analyze_with_model(constraints, model="claude")
            conflicts = []

        # Step 2: 消除歧义 → 零决策计划
        plan = await self._build_zero_decision_plan(constraints, analysis_a, conflicts)

        return NodeResult(
            output_data={
                "constraints": constraints,
                "plan": plan,               # [{step, action, file, content, verification}]
                "conflicts": conflicts,      # [{description, resolution, status}]
                "total_steps": len(plan),
                "artifacts": {
                    "specs": "...",
                    "design": "...",
                    "tasks": "..."  # checkbox 格式
                }
            }
        )
```

**零决策计划格式（每个步骤无歧义）：**
```json
[
  {
    "step": 1,
    "action": "create_file",
    "file": "src/models/user.py",
    "content_template": "创建 User 模型，字段：id (UUID PK), email (unique, not null), password_hash (not null), created_at, updated_at。使用 SQLAlchemy ORM。",
    "constraint_ids": ["C1", "C3"],
    "verification": "python3 -c 'from src.models.user import User; print(User.__table__.columns.keys())'",
    "estimated_diff_lines": 25
  },
  {
    "step": 2,
    "action": "edit_file",
    "file": "src/api/routes/auth.py",
    "content_template": "在现有 login 路由后添加 register 路由：POST /api/auth/register，接收 email+password，调用 User.create()，返回 201 + JWT token。",
    "constraint_ids": ["C1", "C5"],
    "verification": "pytest tests/api/test_auth.py::test_register -v"
  }
]
```

### T21: 交叉验证节点（spec-review）
**新增节点类型：** `review`

**文件：**
- `backend/app/services/workflow_engine/nodes/review_node.py`（新建）

**设计：**
```python
@NodeRegistry.register("review", label="Cross-Model Review", category="quality", icon="shield")
class ReviewNode(BaseNodeExecutor):
    """多模型交叉验证实现结果"""

    CONFIG_SCHEMA = {
        "properties": {
            "review_dimensions": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["spec_compliance", "logic_correctness", "security", "maintainability"]
            },
            "fail_on_critical": {
                "type": "boolean",
                "default": True,
                "description": "存在 Critical 级别问题时任务失败"
            }
        }
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        # 获取上游 spec 节点的约束 + plan 节点的计划
        constraints = context.upstream_outputs.get("constraints", [])
        plan = context.upstream_outputs.get("plan", [])
        task_result = context.upstream_outputs.get("execution_result", {})

        # 多模型并行 review（参考 CCG spec-review）
        review_a = await self._review_with_model(constraints, plan, task_result, "claude")
        review_b = await self._review_with_model(constraints, plan, task_result, "codex")

        # 综合两个 review
        findings = self._merge_reviews(review_a, review_b)

        # 检查约束合规
        compliance = self._check_constraint_compliance(constraints, findings)

        return NodeResult(
            status=NodeStatus.FAILED if findings["critical_count"] > 0 else NodeStatus.SUCCESS,
            output_data={
                "review_a": review_a,
                "review_b": review_b,
                "findings": findings,       # [{severity, dimension, description, file, suggestion}]
                "compliance": compliance,   # {constraint_id: "pass"|"fail"|"partial"}
                "critical_count": findings["critical_count"],
                "artifacts": {
                    "review_report": "..."
                }
            }
        )
```

### T22: 约束验证 + PBT 节点（spec-verify）
**新增节点类型：** `verify`

**文件：**
- `backend/app/services/workflow_engine/nodes/verify_node.py`（新建）

**设计：**
```python
@NodeRegistry.register("verify", label="Constraint Verify", category="quality", icon="check-circle")
class VerifyNode(BaseNodeExecutor):
    """验证实现是否满足所有约束"""

    CONFIG_SCHEMA = {
        "properties": {
            "auto_fix": {
                "type": "boolean",
                "default": False,
                "description": "验证失败时自动修复（最多 3 次）"
            },
            "generate_pbt": {
                "type": "boolean",
                "default": True,
                "description": "为约束生成 Property-Based Tests"
            }
        }
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        constraints = context.upstream_outputs.get("constraints", [])
        success_criteria = context.upstream_outputs.get("success_criteria", [])

        results = []
        for criterion in success_criteria:
            result = await self._verify_criterion(criterion, context)
            results.append(result)

        passed = sum(1 for r in results if r["status"] == "pass")
        total = len(results)

        return NodeResult(
            status=NodeStatus.SUCCESS if passed == total else NodeStatus.FAILED,
            output_data={
                "results": results,
                "passed": passed,
                "total": total,
                "pass_rate": passed / total if total > 0 else 0,
                "artifacts": {
                    "test_report": "...",
                    "pbt_tests": "..."  # 如果启用了 generate_pbt
                }
            }
        )
```

### T23: Artifact 管理体系
**文件：**
- `backend/app/models/spec_artifact.py`（新建）
- `backend/app/routers/spec.py`（新建）

**数据模型：**
```python
class SpecArtifact(Base):
    """约束驱动开发的 artifact 管理"""
    __tablename__ = "spec_artifacts"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    change_id = Column(String, index=True)        # 变更 ID
    artifact_type = Column(String)                  # proposal|specs|design|tasks|review
    content = Column(Text)                          # Markdown 内容
    constraints = Column(Text)                      # JSON: 约束集
    success_criteria = Column(Text)                 # JSON: 成功判据
    status = Column(String, default="active")       # active|archived
    parent_artifact_id = Column(String, ForeignKey("spec_artifacts.id"))
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

**API：**
```
POST   /api/v1/specs/changes              — 创建变更
GET    /api/v1/specs/changes              — 列出变更
GET    /api/v1/specs/changes/{id}         — 变更详情
POST   /api/v1/specs/changes/{id}/artifacts  — 添加 artifact
GET    /api/v1/specs/changes/{id}/artifacts  — 列出 artifacts
POST   /api/v1/specs/changes/{id}/archive    — 归档变更
```

### T24: 约束驱动工作流模板
**预设工作流模板，用户一键使用：**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   spec       │────→│   plan       │────→│   agent      │────→│   review     │────→│   verify     │
│  约束分析    │     │  零决策计划  │     │  按计划执行  │     │  交叉验证    │     │  约束验证    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
     │                    │                    │                    │                    │
     ▼                    ▼                    ▼                    ▼                    ▼
  proposal.md         specs.md            result_data          review_report        test_report
  constraints         tasks.md            files_modified       findings             pbt_tests
  criteria            design.md           cost_usd             compliance           pass_rate
```

**与现有 Nexus 优势的结合：**
- spec 节点的输出通过工作流数据流传递给 plan 节点
- plan 节点的输出注入 agent 节点的 prompt（变量模板）
- agent 节点执行时按计划操作（约束 + 计划作为上下文）
- review 节点读取 constraints + agent result 做交叉验证
- verify 节点读取 criteria 自动运行测试
- human 节点可以在任何阶段暂停等待人工确认
- 整个流程可视化、可追踪、可复现

### 降级方案：集成 OPSX

如果原生实现不理想，降级为集成方案：

1. **安装 OPSX CLI** — `npm install -g opsx`
2. **封装为工作流节点** — spec/plan/review 节点内部调用 `openspec` CLI
3. **Artifact 同步** — OPSX 的 `openspec/` 目录内容同步到 Nexus 数据库
4. **状态映射** — OPSX change status ↔ Nexus workflow execution status

```python
# 降级方案的 spec 节点
class SpecNodeFallback(BaseNodeExecutor):
    async def execute(self, context):
        requirement = context.node_config["requirement"]

        # 调用 OPSX CLI
        proc = await asyncio.create_subprocess_exec(
            "openspec", "new", "change", requirement[:50],
            stdout=asyncio.subprocess.PIPE,
            cwd=context.node_config.get("work_dir", "/tmp")
        )
        stdout, _ = await proc.communicate()

        # 解析 OPSX 输出并同步到 Nexus
        # ...
```

### 迭代六 CC 执行 Prompt

```
Read CLAUDE.md first. This is the highest priority constraint file.

Context: Iteration 6 — OPSX Constraint-Driven Development System.
This is the most important iteration for Nexus quality. It transforms Nexus from a "task dispatcher" into a "quality-guaranteed development system".
Reference: OPSX (fission-ai/opsx) + CCG spec-* commands (github.com/fengshao1227/ccg-workflow).

Project: /root/.openclaw/workspace/agent-orchestration

## Phase A: Core Node Types (2 CC tasks)

### CC Task 1: spec + plan nodes

1. Create backend/app/services/workflow_engine/nodes/spec_node.py:
   - @NodeRegistry.register("spec", label="Constraint Analysis", category="quality", icon="search")
   - CONFIG_SCHEMA: requirement (string), scope (enum), parallel_models (bool), max_constraints (int)
   - execute():
     a) _enhance_prompt: expand vague requirement into structured one (goals, constraints, scope, acceptance criteria)
     b) _extract_constraints: from enhanced prompt, extract constraints in 6 dimensions (functional, security, performance, compatibility, architecture, testing)
     c) _define_criteria: for each constraint, define verifiable success criteria
     d) Return: {enhanced_requirement, constraints[], success_criteria[], artifacts.proposal}

   Constraints must have: {id, text, category, priority(MUST/SHOULD/MAY), verifiable, anti_pattern}
   Criteria must have: {id, text, constraint_ids, verification_method, pbt_properties[]}

2. Create backend/app/services/workflow_engine/nodes/plan_node.py:
   - @NodeRegistry.register("plan", label="Zero-Decision Plan", category="quality", icon="clipboard")
   - CONFIG_SCHEMA: analysis_depth (enum), include_tests (bool), auto_resolve_conflicts (bool)
   - execute():
     a) Read upstream spec output (constraints, success_criteria)
     b) If parallel_models: dispatch constraint analysis to 2 models simultaneously, merge results
     c) _build_zero_decision_plan: convert constraints into step-by-step plan
        Each step: {step_number, action(create_file|edit_file|delete_file|run_command), file, exact_content, constraint_ids, verification_command}
     d) _find_conflicts: detect contradictions between models
     e) Return: {constraints, plan[], conflicts[], artifacts.specs/design/tasks}

   KEY: Each plan step must be ZERO-DECISION — the implementer should NOT need to think, just execute mechanically.

3. Register both nodes in __init__.py

### CC Task 2: review + verify nodes + artifact management

1. Create backend/app/services/workflow_engine/nodes/review_node.py:
   - @NodeRegistry.register("review", label="Cross-Model Review", category="quality", icon="shield")
   - CONFIG_SCHEMA: review_dimensions (array), fail_on_critical (bool), models (array)
   - execute():
     a) Read upstream constraints + plan + execution result
     b) Dispatch to 2 models for independent review (parallel if possible)
     c) Review dimensions: spec_compliance, logic_correctness, security, maintainability, performance
     d) Merge findings, check constraint compliance
     e) If critical_count > 0: return FAILED

2. Create backend/app/services/workflow_engine/nodes/verify_node.py:
   - @NodeRegistry.register("verify", label="Constraint Verify", category="quality", icon="check-circle")
   - CONFIG_SCHEMA: auto_fix (bool), generate_pbt (bool), test_framework (enum)
   - execute():
     a) Read upstream success_criteria + execution result
     b) For each criterion, run verification
     c) If generate_pbt: generate Property-Based Tests
     d) Return: {results[], passed, total, pass_rate, artifacts.test_report}

3. Create backend/app/models/spec_artifact.py:
   - SpecArtifact model (id, project_id, change_id, artifact_type, content, constraints, success_criteria, status, parent_id, timestamps)
   - Alembic migration

4. Create backend/app/routers/spec.py:
   - POST /api/v1/specs/changes — create change
   - GET /api/v1/specs/changes — list changes
   - GET /api/v1/specs/changes/{id} — detail
   - POST /api/v1/specs/changes/{id}/artifacts — add artifact
   - GET /api/v1/specs/changes/{id}/artifacts — list artifacts
   - POST /api/v1/specs/changes/{id}/archive — archive

5. Add spec router to main app

6. Create a preset workflow template "约束驱动开发":
   spec → plan → human(optional) → agent → review → verify → output
   Each node passes data via upstream_outputs

Build checks:
- cd backend && python3 -c "from app.services.workflow_engine.nodes.spec_node import SpecNode; from app.services.workflow_engine.nodes.plan_node import PlanNode; from app.services.workflow_engine.nodes.review_node import ReviewNode; from app.services.workflow_engine.nodes.verify_node import VerifyNode; print('OK')"
- cd backend && python3 -c "from app.models.spec_artifact import SpecArtifact; print('OK')"

Commit 1: git add -A && git commit -m "feat(P0): spec + plan nodes — constraint analysis + zero-decision planning"
Commit 2: git add -A && git commit -m "feat(P0): review + verify nodes + spec artifact management"
Do NOT push.
```

---

## 执行计划

| 迭代 | 任务 | 改动范围 | CC 任务数 | 依赖 |
|------|------|---------|----------|------|
| 一 | T1-T5 实时输出+结构化结果 | oc-bridge + backend + frontend | 2 | 无 |
| 二 | T6-T8 断点续传+依赖链 | backend + oc-bridge | 1 | 迭代一 |
| 三 | T9-T11 重试+路由+成本 | backend + frontend | 1 | 迭代一 |
| 四 | T12-T14 沙盒+仪表板 | 全部 | 2 | 迭代一 |
| **五** | **T25-T30 Codex+OpenCode 多后端** | **oc-bridge + backend + frontend** | **1** | **迭代一** |
| 六 | T15-T18 增强功能 | 全部 | 2 | 迭代二 |
| **七** | **T19-T24 OPSX约束驱动** | **backend(nodes+models+routers) + frontend** | **2** | **迭代一** |

**总计：11 个 CC 任务**

---

## CCG + OPSX 参考文件索引

### CCG Workflow (github.com/fengshao1227/ccg-workflow)
| 文件 | 参考内容 |
|---|---|
| `codeagent-wrapper/server.go` | SSE 服务器架构、ContentEvent 设计 |
| `codeagent-wrapper/parser.go` | stream-json 解析、UnifiedEvent 设计 |
| `codeagent-wrapper/executor.go` | 进程管理、超时处理 |
| `codeagent-wrapper/config.go` | 多后端抽象、Backend interface |
| `codeagent-wrapper/logger.go` | 异步日志、错误缓存 |
| `codeagent-wrapper/filter.go` | 噪声过滤 |
| `templates/commands/spec-research.md` | 约束推理流程 + Prompt 增强 |
| `templates/commands/spec-plan.md` | 零决策计划 + 多模型分析 |
| `templates/commands/spec-impl.md` | 按规范执行 + 外部模型只读 |
| `templates/commands/spec-review.md` | 双模型交叉审查 |

### OPSX (fission-ai/opsx)
| 概念 | 参考内容 |
|---|---|
| Change lifecycle | new → research → plan → impl → verify → archive |
| Constraint schema | id, text, category, priority, verifiable, anti_pattern |
| Success criteria | id, text, constraint_ids, pbt_properties |
| Task format | checkbox `- [ ] X.Y description`（机器可解析） |
| State machine | active → implementing → verifying → verified → archived |
