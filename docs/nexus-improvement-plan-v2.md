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
| 外部模型只读 + Claude 审核 patch | ✅ 安全设计 | 迭代五（安全沙盒） |
| 双层超时（全局 + 单命令） | ✅ 已验证稳定 | 迭代三 T9 |
| 结构化 TaskResult 提取 | ✅ 直接参考 | 迭代一 T5 |
| 失败自动重试（3 次 + 降级） | ✅ 可靠性设计 | 迭代三 T10 |

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
    # （缓存预热优势）
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

```typescript
// 任务详情：显示本次费用
// 仪表板：按天/按项目/按 Agent 汇总
// 数据来源：result_data.cost_usd（迭代一已提取）
```

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
   - Save cost from result_data.cost_usd on task completion

4. Frontend: Cost display in TaskDetailPage
   - Show cost_usd in task info section
   - Dashboard: daily cost summary

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
**文件：**
- `backend/app/routers/gateway.py` — `GET /api/gateway/tasks/{id}/logs?page=1&size=100`
- `frontend/src/pages/tasks/TaskDetailPage.tsx` — 虚拟滚动

### T13: 安全沙盒模式（参考 CCG 只读外部模型设计）
**文件：**
- `backend/app/models/gateway_schemas.py` — 新增 sandbox_mode 字段
- `bridges/oc-bridge/src/agent/claude-code.ts` — 沙盒模式执行

```python
class SubmitTaskRequest(BaseModel):
    sandbox_mode: bool = False  # 沙盒模式

# 沙盒模式行为：
# 1. CC 在临时目录（/tmp/nexus-sandbox-{task_id}/）中执行
# 2. 工作目录设为沙盒目录
# 3. 执行完成后，列出所有修改/创建的文件
# 4. 生成 diff 预览（沙盒文件 vs 原始文件）
# 5. 前端展示 diff，用户确认后执行 apply（cp/rsync 回原目录）
# 6. apply 完成后删除沙盒
```

### T14: 多 Agent 并行状态面板
**文件：**
- `frontend/src/pages/dashboard/DashboardPage.tsx` — 实时状态总览
- `frontend/src/components/dashboard/BridgeStatus.tsx` — Bridge 在线/离线
- `frontend/src/components/dashboard/TaskTimeline.tsx` — 任务时间线

### 迭代四 CC 执行 Prompt

```
Read CLAUDE.md first.

Context: Iteration 4 — Frontend enhancement + security sandbox.
Reference: CCG's "external models return patches, Claude reviews before applying" design.

Project: /root/.openclaw/workspace/agent-orchestration

Steps:

1. backend/app/routers/gateway.py — Paginated task logs:
   - GET /api/gateway/tasks/{id}/logs?page=1&size=100&event_type=tool_use
   - Query from stored progress events
   - Filter by event_type, search in content

2. Security sandbox mode:
   - Add sandbox_mode: bool = False to SubmitTaskRequest
   - In claude-code.ts: if sandbox_mode, set workdir to /tmp/nexus-sandbox-{task_id}/
   - Copy target project files to sandbox before execution
   - After execution: diff sandbox vs original, generate patch list
   - New API: POST /api/gateway/tasks/{id}/apply-patch (apply sandbox changes)
   - New API: POST /api/gateway/tasks/{id}/discard-patch (delete sandbox)

3. Frontend dashboard:
   - BridgeStatus: online/offline indicator, active task count
   - TaskTimeline: running/completed/failed tasks in chronological order
   - Live update via polling or WebSocket

Build checks:
- cd backend && python3 -c "from app.models.gateway_schemas import *; print('OK')"
- cd bridges/oc-bridge && npm run build
- cd frontend && npm run build

Commit: git add -A && git commit -m "feat(P1): sandbox mode + dashboard + paginated logs"
Do NOT push.
```

---

## 迭代五：P2 — 增强功能

### T15: Prompt 模板管理
- CRUD API for prompt templates
- 前端模板编辑器
- 任务提交时可选择模板

### T16: 任务依赖可视化
- 前端 DAG 图（任务依赖关系）
- 依赖状态实时更新

### T17: Webhook 通知
- 任务完成/失败时发送 webhook
- 支持钉钉/飞书/Slack

### T18: 审计日志
- 所有 API 调用记录
- 前端审计日志查看页面

---

## 执行计划

| 迭代 | 任务 | 改动范围 | CC 任务数 | 依赖 |
|------|------|---------|----------|------|
| 一 | T1-T5 实时输出+结构化结果 | oc-bridge + backend + frontend | 2 | 无 |
| 二 | T6-T8 断点续传+依赖链 | backend + oc-bridge | 1 | 迭代一 |
| 三 | T9-T11 重试+路由+成本 | backend + frontend | 1 | 迭代一 |
| 四 | T12-T14 沙盒+仪表板 | 全部 | 2 | 迭代一 |
| 五 | T15-T18 增强功能 | 全部 | 2 | 迭代二 |

**总计：8 个 CC 任务**

---

## CCG 参考文件索引

在 CCG 仓库中查看以下文件获取实现参考：

| CCG 文件 | 参考内容 |
|---|---|
| `codeagent-wrapper/server.go` | SSE 服务器架构、ContentEvent 设计 |
| `codeagent-wrapper/parser.go` | stream-json 解析、UnifiedEvent 设计 |
| `codeagent-wrapper/executor.go` | 进程管理、超时处理 |
| `codeagent-wrapper/config.go` | 多后端抽象、Backend interface |
| `codeagent-wrapper/logger.go` | 异步日志、错误缓存 |
| `codeagent-wrapper/filter.go` | 噪声过滤（参考减少 Nexus 日志噪音）|
