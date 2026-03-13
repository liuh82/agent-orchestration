# AI Agent Orchestration 开发方案 (v4.0)

> 基于 agent-orchestration 项目现状 + Paperclip 功能对比 + Remote Agent Bridge 架构
> 更新日期：2026-03-14
> 当前版本：v2.4.0 (commit: a7a2078)
> 项目状态：**ORM 迁移已完成并验证通过，进入 Phase 6 Remote Agent Bridge 开发**

---

## 一、架构设计

### 1.1 核心架构（宏观）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         前端层 (React + TypeScript + Ant Design 5)           │
│   Dashboard │ Agents │ Tasks │ Workflows │ Org │ Approvals │ Audit │ HB   │
│   【设计规范: frontend/DESIGN_SPEC.md】                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       API Gateway (FastAPI)                                  │
│   API Key 认证 │ 限流 │ 日志 │ 路由                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  Agent      │          │  Task       │          │  Workflow   │
│  Service    │          │  Service    │          │  + Remote   │
│             │          │             │          │  AgentEngine│
└──────────────┘          └──────────────┘          └──────┬───────┘
                                                          │
                                    ┌─────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  OpenClaw Gateway (Bridge Manager)                          │
│   多 Bridge 管理 │ 任务路由 │ 心跳检测 │ 故障转移                                │
└────────────┬──────────────────────────────────────────┬─────────────────────┘
             │ WebSocket (双向, TLS 1.2+)                │
             ▼                                          ▼
┌─────────────────────┐              ┌─────────────────────┐
│  Bridge (Mac)       │              │  Bridge (Win/Linux) │
│  CLI Adapter        │              │  CLI Adapter        │
│  (codex/pi/acp)     │              │  (codex/pi/acp)     │
│  HTTP API :18790    │              │  HTTP API :18790    │
└─────────────────────┘              └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         数据层 (SQLite + SQLAlchemy 2.0 ORM)                 │
│   21 表: agents │ tasks │ workflows │ costs │ logs │ org │ goals │ etc.     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 4 + Ant Design 5 + styled-components |
| 后端 | Python FastAPI + Pydantic v2 + **SQLAlchemy 2.0 ORM** ✅ |
| 数据库 | SQLite (WAL模式) + SQLAlchemy 2.0（已迁移完成） |
| Bridge | **Node.js 18+ / TypeScript 5.x** + better-sqlite3 + ws |
| 状态管理 | Zustand + React Query |
| 工作流引擎 | Lobster Engine (可插拔) + **RemoteAgentEngine**（新增） |
| 认证 | API Key (MVP) + Bridge Token |

### 1.3 关键文档索引

| 文档 | 说明 |
|------|------|
| `docs/remote-agent-bridge-architecture.md` | Bridge 架构设计 v2.0（95KB，13章+3附录） |
| `frontend/DESIGN_SPEC.md` | 前端设计规范 v1.0（Design Token + Ant Design 主题） |
| `docs/orm-migration-design.md` | ORM 迁移设计文档 |
| `backend/CODE_REVIEW_FIX_REPORT.md` | ORM 迁移代码审查修复报告 |
| `backend/TEST_VERIFICATION_REPORT.md` | ORM 迁移验证报告（用户本地通过） |
| `docs/acp-bridge-plan.md` | ACP Bridge 方案（参考，已决定不依赖 ACP） |
| `frontend/DESIGN_SPEC.md` | 前端设计规范 |
| `agent-orchestration-architecture.md` | 系统架构文档 |
| `agent-orchestration-requirements.md` | 需求文档 |

---

## 二、功能实现进度

### 2.1 Agent 管理模块 — ✅ 完成

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/agents | GET | Agent列表 | ✅ |
| /api/agents | POST | 创建Agent | ✅ |
| /api/agents/{id} | GET/PUT/DELETE | CRUD | ✅ |
| /api/agents/{id}/start | POST | 启动Agent | ✅ |
| /api/agents/{id}/stop | POST | 停止Agent | ✅ |
| /api/agents/{id}/logs | GET | 运行日志 | ✅ |
| /api/agents/{id}/stats | GET | 性能统计 | ✅ |
| /api/agents/{id}/heartbeat | POST | Agent心跳 | 🔲 未实现（低优先级） |

### 2.2 Task 管理模块 — ✅ 完成

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/tasks | GET/POST | 列表/创建 | ✅ |
| /api/tasks/{id} | GET/PUT/DELETE | CRUD | ✅ |
| /api/tasks/{id}/execute | POST | 执行 | ✅ |
| /api/tasks/{id}/pause/resume | POST | 暂停/恢复 | ✅ |
| /api/tasks/{id}/assign | POST | 分配Agent | ✅ |
| /api/tasks/{id}/logs | GET | 任务日志 | 🔲 未实现（低优先级） |

### 2.3 Workflow 管理模块 — ✅ 完成（RemoteAgentEngine 待开发）

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/workflows | GET/POST | 列表/创建 | ✅ |
| /api/workflows/{id} | GET/PUT/DELETE | CRUD | ✅ |
| /api/workflows/{id}/execute | POST | 执行 | ✅ |
| /api/workflows/{id}/status/{exec_id} | GET | 执行状态 | ✅ |
| /api/workflows/{id}/logs/{exec_id} | GET | 执行日志 | ✅ |
| /api/workflows/templates | GET | 模板 | ✅ |
| /api/workflows/visual-editor | GET | 可视化编辑器 | 🔲 Phase 9 |

### 2.4 Cost 成本控制模块 — ✅ 完成

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/costs | GET | 列表 | ✅ |
| /api/costs/summary | GET | 汇总 | ✅ |
| /api/costs/by-agent | GET | 按Agent统计 | ✅ |
| /api/costs/by-period | GET | 按时间段统计 | 🔲 Phase 9 |
| /api/costs/budget | GET/POST | 预算 | ✅ |
| /api/costs/alert | POST | 告警 | ✅ |

### 2.5 Org 组织架构模块 — ✅ 完成

所有端点已实现（org/chart, org/roles, org/members, goals, goals/align）。

### 2.6 Governance 治理模块 — ✅ 完成

所有端点已实现（approvals, audit/logs）。

### 2.7 Heartbeat 心跳模块 — ✅ 完成

所有端点已实现（CRUD + trigger + enable/disable + logs + stats）。

### 2.8 Remote Agent Bridge — 🔲 Phase 6 开发中

| 组件 | 说明 | 状态 |
|------|------|------|
| Bridge 服务 (Node.js) | 跨平台常驻服务 | 🔲 待开发 |
| WebSocket 双向通信 | Bridge ↔ Gateway | 🔲 待开发 |
| CLI Adapter | codex / pi / openclaw acp | 🔲 待开发 |
| Gateway BridgeManager | 多 Bridge 管理 + 路由 | 🔲 待开发 |
| RemoteAgentEngine | 编排系统远端执行引擎 | 🔲 待开发 |
| Bridge HTTP API | 本地 RESTful API | 🔲 待开发 |
| 安全沙箱 | 命令白名单 + prompt 检测 | 🔲 待开发 |
| 审计日志 | 操作记录 | 🔲 待开发 |
| IDE Adapter | VS Code / Cursor（文件队列） | 🔲 Phase 7 |

详细架构设计：`docs/remote-agent-bridge-architecture.md`（v2.0，95KB）

---

## 三、版本发布记录

### v2.0 — Phase 1 核心功能 ✅ (2026-03-09)
- Agent CRUD + 启停 + 日志 + 统计
- Task CRUD + 分配 + 执行
- Workflow CRUD + 执行
- Cost 按Agent统计 + 预算 + 告警
- 前端基础页面

### v2.1 — Phase 2 后端扩展 ✅ (2026-03-12)
- Org Chart / Goal Alignment / Governance（审批+审计）后端
- pytest 23/23 通过

### v2.2 — Phase 2.5 + Phase 3 ✅ (2026-03-12)
- 前端 Org / Goals / Approvals / Audit 页面
- 后端 Heartbeats 心跳模块

### v2.3 — 安全审查修复 ✅ (2026-03-13)
- SQL 注入修复、单例线程安全、API Key 认证中间件
- 前端防抖、轮询清理、错误处理统一
- 前端清理（未使用 import/变量）

### v2.3.5 — 审查验证通过 ✅ (2026-03-13)
- 本地验证（Python 3.9.10 + macOS）：pytest 23/23, tsc 0 error, build 成功
- **版本状态: 稳定**

### v2.4.0 — ORM 迁移完成 + 架构设计 ✅ (2026-03-14)

**ORM 迁移（Phase 5）**：
- 12 个 service 文件全部迁移到 SQLAlchemy 2.0 ORM
- 4 库合并 → 单库 tasks.db（21 表）
- 147 处原生 SQL → ORM（零残留）
- 连接池配置（pool_size=5, max_overflow=10）
- 代码审查 P0/P1/P2 修复全部完成
- 本地测试验证通过（23/23 pytest）
- **Commits**: `305a3ec` → `87f6c40` → `bfed631` → `457e8b7` → `f1fe25e`

**架构设计文档**：
- Remote Agent Bridge 架构 v2.0（95KB，commit `a5e56cb`）
- 前端设计规范 v1.0（19KB）
- **版本状态: 稳定，可进入 Phase 6 开发**

---

## 四、测试报告汇总

### 4.1 服务器测试（Python 3.11, Linux）
- pytest **23/23 通过**

### 4.2 本地测试（Python 3.9.10, macOS）— Phase 5 ORM 迁移验证 ✅
- pytest **23/23 通过**（0.53s）
- 零原生 SQL 残留
- 21 个 ORM 表定义正确
- 4 个 API 端点功能验证通过
- 64 个路由注册成功
- 修复了 4 个本地环境特有问题：
  1. task.py 导入冲突（Task 别名）
  2. cost.py 缺失 import
  3. task.py assign_task 异步调用
  4. tasks.py 路由异步调用
- **报告文件**: `backend/TEST_VERIFICATION_REPORT.md`

### 4.3 前端
- TypeScript: 0 error
- Build: 成功（1.7MB JS, gzip 544KB）
- 代码分割优化待 Phase 9

---

## 五、代码审查记录

### 5.1 审查 1（2026-03-12 初审）— 通过
### 5.2 审查 2（2026-03-13 安全审查）— 4🔴 全修复，通过
### 5.3 审查 3（2026-03-13 ORM 迁移）— 7.5/10，P0/P1/P2 修复完成

---

## 六、开发路线图

### ✅ Phase 1-4：核心功能（v2.0-v2.2）
### ✅ Phase 5：ORM 迁移（v2.4.0）

---

### 🔴 Phase 6：Remote Agent Bridge MVP（当前重点）

**目标**：Gateway 能调度任意平台（macOS / Windows / Linux）上的 CLI Agent

**架构文档**：`docs/remote-agent-bridge-architecture.md`（v2.0，95KB）
**开发参考**：`CLAUDE.md` 中 Bridge 开发规范章节

#### 6.1 Bridge 核心服务（Node.js + TypeScript）
- [ ] 项目初始化（package.json, tsconfig, eslint, jest）
- [ ] 入口文件 `src/index.ts`（commander.js CLI）
- [ ] `src/bridge.ts` — Bridge 主类（生命周期管理、状态机）
- [ ] `src/ws-client.ts` — WebSocket 客户端（连接、认证、心跳、ACK、断线重连）
- [ ] `src/task-queue.ts` — 任务队列（优先级、并发控制）
- [ ] `src/task-runner.ts` — 任务执行调度器
- [ ] `src/checkpoint.ts` — Checkpoint Manager（崩溃恢复）
- [ ] `src/database.ts` — SQLite 管理（better-sqlite3, WAL 模式）

#### 6.2 协议与消息
- [ ] `src/protocol/types.ts` — 消息类型定义
- [ ] `src/protocol/schemas.ts` — Zod 验证 schemas
- [ ] `src/protocol/encoder.ts` — 消息编码器
- [ ] `src/protocol/decoder.ts` — 消息解码器 + 验证

#### 6.3 Adapter 系统
- [ ] `src/adapters/types.ts` — Adapter 接口
- [ ] `src/adapters/registry.ts` — Adapter 注册表
- [ ] `src/adapters/base.ts` — Adapter 基类
- [ ] `src/adapters/cli-adapter.ts` — CLI Adapter（codex / pi / acp）
- [ ] `src/platform/paths.ts` — 跨平台路径
- [ ] `src/platform/editors.ts` — Agent 可执行文件检测

#### 6.4 HTTP API
- [ ] `src/http-server.ts` — HTTP 服务（Express/Koa）
  - POST `/api/v1/tasks` — 提交任务
  - GET `/api/v1/tasks/{id}` — 查询状态
  - DELETE `/api/v1/tasks/{id}` — 取消任务
  - GET `/api/v1/tasks` — 列出任务
  - GET `/api/v1/agents` — 列出可用 Agent
  - GET `/api/v1/health` — 健康检查
  - GET `/api/v1/status` — Bridge 状态

#### 6.5 配置与安全
- [ ] `src/config/types.ts` — 配置类型（50+ 配置项）
- [ ] `src/config/loader.ts` — 配置加载器（文件 + 环境变量）
- [ ] `src/config/validator.ts` — Zod 验证
- [ ] `src/security/token.ts` — Token 管理
- [ ] `src/security/sandbox.ts` — 任务沙箱（命令白名单 + prompt 检测）
- [ ] `src/audit/logger.ts` — 审计日志

#### 6.6 工具与基础设施
- [ ] `src/utils/logger.ts` — Winston 日志
- [ ] `src/utils/retry.ts` — 重试逻辑
- [ ] `src/utils/pid-monitor.ts` — 子进程监控
- [ ] `src/utils/graceful-shutdown.ts` — 优雅退出

#### 6.7 测试
- [ ] 单元测试（task-queue, task-runner, checkpoint, ws-client, adapters）
- [ ] 集成测试（bridge-lifecycle, task-e2e, reconnection）
- [ ] Mock Gateway 测试工具

#### 6.8 Gateway 侧集成
- [ ] BridgeManager 模块（多 Bridge 管理 + 路由 + 心跳超时）
- [ ] WS Server 扩展（处理 Bridge 消息）

#### 6.9 编排系统集成
- [ ] `backend/app/services/remote_agent_engine.py` — RemoteAgentEngine
- [ ] `lobster_engine.py` 添加 `remote-agent` 执行模式
- [ ] Workflow 支持 `mode: "remote-agent"` 节点

#### 6.10 部署
- [ ] `scripts/install.sh` — Mac/Linux 安装脚本
- [ ] `scripts/install.ps1` — Windows 安装脚本
- [ ] `scripts/setup.ts` — 交互式配置向导
- [ ] `scripts/db-migrate.ts` — 数据库迁移

**验收标准**：
1. Mac/Windows/Linux 三平台 npm install + start 成功
2. Bridge 连接 Gateway → 注册 → 心跳 → 收到任务 → 执行 → 回传结果 < 5 分钟
3. 断线重连 < 30 秒，任务恢复正确
4. 单元测试覆盖率 > 60%
5. CLI Adapter codex 执行成功

**预计工期**：1-1.5 周

---

### Phase 7：IDE 集成（VS Code / Cursor）
- [ ] 文件队列机制（incoming / outgoing + FileSystemWatcher）
- [ ] VS Code 扩展（监听任务 + 终端执行 + 结果捕获）
- [ ] Cursor 扩展（复用 VS Code 方案）
- [ ] 扩展发布到 marketplace
- **预计工期**：1 周

### Phase 8：JetBrains + 编排增强
- [ ] IntelliJ IDEA 集成（HTTP API）
- [ ] WebStorm / PyCharm 支持
- [ ] 编排系统 RemoteAgentEngine 完善
- [ ] 前端看板显示远端任务状态
- [ ] 飞书通知集成
- [ ] Git 自动 commit/push
- **预计工期**：1.5 周

### Phase 9：功能补齐
- [ ] Multi-Company 多公司数据隔离
- [ ] Mobile 响应式适配
- [ ] Workflow 可视化编辑器（React Flow 增强版）
- [ ] 按时间段成本统计
- [ ] Agent 独立心跳接口
- [ ] 前端代码分割（1.7MB → < 500KB per chunk）

### Phase 10：生产加固
- [ ] JWT 认证（替换 API Key MVP）
- [ ] Rate Limiting（100 req/min）
- [ ] CI/CD 集成（GitHub Actions + 自动化测试）
- [ ] Token 轮换
- [ ] Let's Encrypt 证书（替换自签名）
- [ ] 测试覆盖率提升 → 70%+
- [ ] 前端设计规范落地（DESIGN_SPEC.md）

---

## 七、Paperclip 核心功能对比

| Paperclip 功能 | agent-orchestration 状态 | 优先级 |
|---------------|----------------------|--------|
| Bring Your Own Agent | ✅ Phase1 | P0 ✅ |
| Goal Alignment | ✅ 后端+前端 | P1 ✅ |
| Heartbeats | ✅ 后端+前端 | P1 ✅ |
| Cost Control | ✅ Phase1 | P0 ✅ |
| Governance | ✅ 后端+前端 | P1 ✅ |
| Org Chart | ✅ 后端+前端 | P1 ✅ |
| Ticket System | ⚠️ 基础实现 | P0 |
| **Remote Agent Bridge** | 🔲 Phase 6 | **P0 🔴** |
| **跨平台开发** | 🔲 Phase 6 | **P0 🔴** |
| Multi-Company | 🔲 Phase 9 | P2 |
| Mobile Ready | 🔲 Phase 9 | P2 |

---

## 八、技术规范

### 8.1 统一响应格式

```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

### 8.2 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数错误"
  }
}
```

### 8.3 分页响应

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total": 100
  }
}
```

### 8.4 Bridge API 错误码

| 错误码 | HTTP | 含义 |
|--------|------|------|
| `AUTH_REQUIRED` | 401 | 缺少 token |
| `TASK_NOT_FOUND` | 404 | 任务不存在 |
| `TASK_REJECTED` | 422 | Agent 不可用 |
| `TASK_TIMEOUT` | 504 | 执行超时 |
| `QUEUE_FULL` | 429 | 队列已满 |
| `AGENT_UNAVAILABLE` | 503 | Agent 不可用 |
| `BRIDGE_OFFLINE` | 503 | Bridge 离线 |
| `INTERNAL_ERROR` | 500 | 内部错误 |

完整错误码列表见 `docs/remote-agent-bridge-architecture.md` 附录 A。

---

## 九、非功能性需求

### 9.1 安全要求
- ✅ API Key 认证（MVP 已实现）
- ✅ SQL 注入防御（ORM 自动保证）
- ✅ Bridge Token 认证
- 🔲 JWT 认证（Phase 10）
- 🔲 Rate Limiting（Phase 10）

### 9.2 代码规范
- ✅ ORM 优先 — 所有数据库操作使用 SQLAlchemy 2.0
- ✅ 禁止硬编码密钥
- ✅ Bridge 使用 Design Token（前端）/ TypeScript strict mode（Bridge）
- ✅ 前端遵循 `DESIGN_SPEC.md` 设计规范

---

## 十、Git 提交历史（最近 20 条）

| Commit | 日期 | 说明 |
|--------|------|------|
| a7a2078 | 2026-03-14 | docs: 更新 CLAUDE.md v2.4.0 |
| a5e56cb | 2026-03-14 | docs: Remote Agent Bridge 架构设计 v2.0 (95KB) + 前端设计规范 |
| f1fe25e | 2026-03-14 | fix: 修复 Phase 5 ORM 迁移代码审查问题 |
| 2867d3c | 2026-03-14 | docs: Remote Agent Bridge 架构 v1.1 |
| 61affbc | 2026-03-13 | docs: 更新 ACP Bridge 方案 |
| 457e8b7 | 2026-03-13 | fix: 修复 Phase 5 ORM 迁移代码审查问题 |
| bfed631 | 2026-03-13 | feat: 完成 Phase 5 ORM 迁移 - 全部 12 个 Service |
| 305a3ec | 2026-03-13 | feat: 完成 Phase 5 ORM 迁移 - 迁移 9 个 Service |
| 87f6c40 | 2026-03-13 | feat: 完成第5阶段ORM迁移 |
| 7117a11 | 2026-03-13 | docs: 确认 ORM 迁移设计文档 |
| c48bc60 | 2026-03-13 | docs: 添加 TEST_REPORT_LOCAL 测试报告 |
| ... | ... | 完整历史见 `git log` |

---

## 十一、开发工作流

所有开发类需求遵循严格流程：

```
需求确认 → 架构评审 → 开发实现 → 安全审计 → 测试验证 → 代码审查 → 验收确认 → 部署上线
```

**关键规则**：
1. 执行者严格禁止自行开发，遇到问题必须报告
2. 所有子节点决策通过飞书向用户询问
3. 不要改现有 API 接口（URL、请求/响应格式不变）
4. 使用 SQLAlchemy 2.0 风格（`select()` / `insert()` / `update()`）
5. 前端遵循 `DESIGN_SPEC.md` 设计规范
6. Bridge 开发遵循 `docs/remote-agent-bridge-architecture.md` 架构设计
