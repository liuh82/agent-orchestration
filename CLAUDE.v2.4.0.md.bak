# AI Agent Orchestration - 开发指南

> 当前版本：v2.4.0 | 更新日期：2026-03-14
> 开发计划详见：`agent-orchestration-v2-plan.md`

## 项目概述

AI Agent 编排可视化平台，用于编排 AI Agent（Codex、Pi、Claude Code 等）、创建开发工作流程、远程调度开发任务。支持多平台（macOS / Windows / Linux）、多 IDE（VS Code / Cursor / IntelliJ）。

**目标用户**：技术负责人/产品经理通过飞书/前端界面下达开发需求，AI Agent 团队自动拆解、执行、交付。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 4 + Ant Design 5 + styled-components |
| 后端 | Python FastAPI + Pydantic v2 + SQLAlchemy 2.0 ORM |
| 数据库 | SQLite (WAL模式) |
| 状态管理 | Zustand + React Query |
| 认证 | API Key (MVP，`X-API-Key` header) |
| Bridge | Node.js + TypeScript + better-sqlite3（跨平台服务） |
| 通信 | WebSocket (双向) + HTTP REST (本地 API) |
| 测试 | pytest (后端) / tsc + build (前端) / jest (Bridge) |
| 包管理 | npm (前端/Bridge) / pip (后端) |

## 项目结构

```
agent-orchestration/
├── frontend/                    # React 前端
│   ├── DESIGN_SPEC.md           # ★ 前端设计规范（强制遵循）
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   │   ├── Agents.tsx      # Agent 管理
│   │   │   ├── Tasks.tsx       # 任务管理
│   │   │   ├── Workflows.tsx   # 工作流管理
│   │   │   ├── Org.tsx         # 组织架构
│   │   │   ├── Approvals.tsx   # 审批中心
│   │   │   ├── Audit.tsx       # 审计日志
│   │   │   └── Heartbeats.tsx  # 心跳管理
│   │   ├── api/                # API 调用
│   │   ├── stores/             # Zustand 状态
│   │   ├── types/              # TypeScript 类型定义
│   │   ├── config/             # 常量配置
│   │   ├── utils/              # 工具函数 (debounce 等)
│   │   └── styles/             # 样式 (Design Token)
│   └── package.json
│
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # 应用入口 + lifespan
│   │   ├── auth.py             # API Key 认证中间件
│   │   ├── database.py         # SQLAlchemy engine + Session
│   │   ├── models/
│   │   │   └── orm_models.py   # 16 个 ORM 模型（已迁移完成）
│   │   ├── routers/            # API 路由
│   │   ├── services/           # 业务逻辑（12个service，已全部迁移到 ORM）
│   │   └── models/             # Pydantic 模型
│   ├── tests/                  # pytest 测试（23个用例）
│   ├── CODE_REVIEW_FIX_REPORT.md # ORM 迁移修复报告
│   └── requirements.txt
│
├── docs/
│   ├── remote-agent-bridge-architecture.md  # ★ Bridge 架构设计 v2.0（95KB）
│   ├── acp-bridge-plan.md                    # ACP Bridge 方案
│   ├── architect-task-brief.md               # 架构任务书
│   ├── orm-migration-design.md               # ORM 迁移设计
│   └── superpowers/specs/                    # 设计文档
│
├── remote-agent-bridge/         # ★ Bridge 服务（Node.js，待开发）
│   └── (Phase 1 MVP 开发目录)
│
├── agent-orchestration-v2-plan.md  # 完整开发计划
└── TEST_REPORT*.md              # 测试报告
```

## 当前实现状态

### ✅ 已完成

**Phase 1-4 核心功能**
- Agent 管理 — CRUD + 启停 + 日志 + 统计 + 预算控制
- Task 管理 — CRUD + 分配 + 执行 + 暂停/恢复 + 分页
- Workflow 管理 — CRUD + 执行 + 状态查询 + 日志 + 模板
- Cost 成本控制 — 列表 + 汇总 + 按 Agent 统计 + 预算 + 告警
- Org 组织架构 — 架构图 + 角色 + 成员
- Goal 目标对齐 — 目标 + 对齐关系
- Governance 治理 — 审批 + 审计日志
- Heartbeats 心跳 — CRUD + 调度 + 统计 + 日志
- API Key 认证 — MVP 版本
- 安全修复 — SQL 注入防御、单例线程安全、输入验证、前端防抖

**Phase 5 — ORM 迁移** ✅（2026-03-13 完成）
- 12 个 service 文件全部迁移到 SQLAlchemy 2.0 ORM
- 16 个 ORM 模型定义
- 连接池配置（pool_size=5, max_overflow=10, pool_timeout=30）
- 代码审查 P0/P1/P2 修复全部完成
- 最新 commit：`457e8b7`（修复 Phase 5 代码审查问题）
- 详细报告：`backend/CODE_REVIEW_FIX_REPORT.md`

**架构设计文档**
- Remote Agent Bridge 架构设计 v2.0（95KB，13章+3附录）
- 前端设计规范 v1.0（19KB，Design Token + Ant Design 主题覆盖）

### 🔲 待开发

**Phase 6 — Remote Agent Bridge（下一阶段）**
- Bridge 服务（Node.js 跨平台应用）
- WebSocket 双向通信协议
- CLI Agent Adapter（codex / pi / openclaw acp）
- Gateway 多 Bridge 管理与路由
- 编排系统 RemoteAgentEngine 集成
- 详细设计：`docs/remote-agent-bridge-architecture.md`

**Phase 7 — 功能增强**
- Agent 独立心跳接口
- 按时间段成本统计
- Workflow 可视化编辑器
- Multi-Company 多公司隔离
- Mobile 适配
- JWT 认证（替换 API Key MVP）
- Rate Limiting
- Code splitting

---

## 前端开发规范

### 设计系统

**强制遵循 `frontend/DESIGN_SPEC.md`**

- **参考风格**：Linear.app + Vercel Dashboard
- **Design Token**：颜色、间距、字体、圆角、阴影、动画全部定义在 token 文件中
- **Ant Design 主题覆盖**：通过 `ConfigProvider` 使用 `antd-theme.ts` 中的配置
- **禁止硬编码**：不允许 `color: '#333'`、`padding: 13px`（必须是 token 值）

### 快速参考

```typescript
// 使用 Ant Design 主题（必须包裹 ConfigProvider）
import { ConfigProvider } from 'antd';
import { antdTheme } from './styles/antd-theme';

// 使用 Design Token
import { colors, spacing, radius, shadow, typography } from './styles/tokens';

// 暗色主题层次
// 层级 0: 背景 #0a0a0a
// 层级 1: 卡片 #141414，边框 rgba(255,255,255,0.06)
// 层级 2: 弹出层 #1a1a1a
// 层级 3: 模态层 #1a1a1a + 阴影

// 主色：Indigo (#6366f1)
// 间距基准：4px 倍数
// 圆角：sm=4px, md=6px, lg=8px, xl=12px
// 动画：hover 100ms, 展开 150ms, 过渡 300ms
```

### Agent 开发约束

| 规则 | 说明 |
|------|------|
| **必须使用 Design Token** | 不允许硬编码颜色值、间距值 |
| **必须使用 Ant Design 组件** | 优先用 antd，自定义用 styled-components |
| **必须有 Hover 状态** | 所有可交互元素必须有 hover/focus/active |
| **必须有 Loading 状态** | 数据加载时显示 Skeleton 或 Spin |
| **必须有 Empty 状态** | 列表无数据时显示 Empty 组件 |
| **必须有 Error 状态** | 数据加载失败时显示错误信息和重试按钮 |
| **组件必须抽离** | 超过 200 行的组件必须拆分 |

---

## Remote Agent Bridge 开发规范

### 架构概要

```
Gateway（服务器）──WebSocket（双向）──► Bridge（开发机）
                                          ├── CLI Adapter (codex/pi/acp) [Phase 1]
                                          ├── VS Code Adapter (文件队列) [Phase 2]
                                          └── IntelliJ Adapter [Phase 3]
```

### 技术规范

- **语言**：TypeScript 5.x（strict mode）
- **运行时**：Node.js 18+
- **数据库**：better-sqlite3（Bridge 本地持久化）
- **WebSocket**：ws 库
- **验证**：zod（运行时 JSON Schema 验证）
- **日志**：winston
- **CLI**：commander.js

### Bridge HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/tasks` | 提交任务 |
| GET | `/api/v1/tasks/{id}` | 查询任务状态 |
| DELETE | `/api/v1/tasks/{id}` | 取消任务 |
| GET | `/api/v1/tasks` | 列出任务 |
| GET | `/api/v1/agents` | 列出可用 Agent |
| GET | `/api/v1/health` | 健康检查 |
| GET | `/api/v1/status` | Bridge 状态 |

### 错误码体系

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

完整错误码见 `docs/remote-agent-bridge-architecture.md` 附录 A。

### 配置管理

- 配置文件：`~/.oc-bridge/config.json`（macOS/Linux）或 `%APPDATA%\oc-bridge\config.json`（Windows）
- 环境变量覆盖：`OC_BRIDGE_GATEWAY_URL`、`OC_BRIDGE_TASKS_MAX_CONCURRENT` 等
- 优先级：环境变量 > 配置文件 > 默认值
- 完整配置项见架构设计文档附录 B（50+ 配置项）

---

## 开发规范

### Git 提交规范
```
feat: 新功能
fix: Bug 修复
docs: 文档更新
refactor: 代码重构
chore: 构建/工具更新
style: 代码格式（不影响功能）
```

### Python (FastAPI)
- Pydantic v2，使用 `model_config = ConfigDict(...)` 替代 `class Config`
- 路由函数 async/await
- 错误处理使用 HTTPException
- 日志使用标准 logging
- **禁止原生 SQL** — 使用 SQLAlchemy 2.0 ORM（`select()` / `insert()` / `update()` 风格）
- **禁止硬编码密钥** — 从环境变量读取
- SQLAlchemy 2.0 风格参考：
  ```python
  # 查询
  stmt = select(Task).where(Task.id == task_id)
  result = db.execute(stmt).scalar_one_or_none()

  # 分页
  stmt = select(Task).offset(skip).limit(limit).order_by(Task.created_at.desc())
  results = db.execute(stmt).scalars().all()

  # 创建
  task = Task(name=name, status="pending")
  db.add(task)
  db.commit()
  db.refresh(task)

  # 更新
  stmt = update(Task).where(Task.id == task_id).values(status="completed")
  db.execute(stmt)
  db.commit()

  # 删除
  db.delete(task)
  db.commit()

  # 事务
  try:
      # ... 操作 ...
      db.commit()
  except Exception:
      db.rollback()
      raise
  ```

### TypeScript / React
- strict 模式，避免 `any`（用 `unknown` 占位）
- 函数式组件 + Hooks
- 未使用的 import/变量必须清理
- 异步操作加防抖（已有 `utils/debounce.ts`）
- 轮询间隔使用 `config/constants.ts` 常量
- **遵循 `DESIGN_SPEC.md` 设计规范**

### TypeScript / Node.js (Bridge)
- TypeScript strict mode
- 所有异步操作使用 async/await（不用 .then 链）
- 子进程管理使用 `child_process.spawn`（不用 exec）
- 跨平台路径使用 `path.join()` + `path.sep`（不用字符串拼接）
- 错误处理不吞异常，必须向上传播或记录日志

### API 设计
- RESTful 风格
- 统一响应格式：`{"success": bool, "data": ..., "message": ...}`
- 分页响应：`{"success": bool, "data": [], "pagination": {...}}`
- **不要改现有 API 接口** — URL、请求/响应格式不变（前端依赖）

### 安全规范
- API Key 认证（`X-API-Key` header，默认值：`dev-api-key-please-change-in-production`）
- Bridge Token 认证（`~/.openclaw/gateway.token`）
- 所有用户输入必须验证
- SQL 参数化查询（ORM 自动保证）
- 任务沙箱：命令白名单 + prompt 危险关键词检测
- 环境变量管理密钥

---

## 开发命令

```bash
# === 后端 ===
cd backend
uvicorn app.main:app --reload --port 8083      # 开发启动
python3 -m pytest tests/ -v --tb=short          # 测试

# === 前端 ===
cd frontend
npm install                                      # 安装依赖
npm run dev                                      # 开发启动 (http://localhost:5173)
npx tsc --noEmit                                 # 类型检查
npm run build                                    # 构建

# === Bridge (待开发) ===
cd remote-agent-bridge
npm install                                      # 安装依赖
npx tsc --noEmit                                 # 类型检查
npm run dev                                      # 开发启动
npm test                                         # 测试
npm run build                                    # 构建
oc-bridge setup                                  # 交互式配置
oc-bridge start                                  # 启动

# === API 测试 ===
curl -H "X-API-Key: dev-api-key-please-change-in-production" http://localhost:8083/agents
```

## 端口配置

| 服务 | 开发端口 | 生产端口 | 说明 |
|------|---------|---------|------|
| 前端 Vite | 5173 | - | 开发模式 |
| 后端 uvicorn | 8083 | 8080 | 8080 被 Docker 占用 |
| Nginx | - | 80 | 生产模式前端 |
| Nginx SSL | - | 443 | 生产模式 HTTPS |
| Dashboard | - | 9443 | Nginx → 5173（生产构建） |
| Bridge HTTP | 18790 | 18790 | Bridge 本地 API |
| Gateway WS | 18789 | 18789 | OpenClaw Gateway |

## API 端点总览

| 模块 | 端点 | 方法 |
|------|------|------|
| Agent | /agents, /agents/{id}, /agents/{id}/start, /agents/{id}/stop, /agents/{id}/logs, /agents/{id}/stats | CRUD + 操作 |
| Task | /tasks, /tasks/{id}, /tasks/{id}/execute, /tasks/{id}/pause, /tasks/{id}/resume, /tasks/{id}/assign | CRUD + 操作 |
| Workflow | /workflows, /workflows/{id}, /workflows/{id}/execute, /workflows/{id}/status/{exec_id}, /workflows/{id}/logs/{exec_id}, /workflows/templates | CRUD + 执行 |
| Cost | /costs, /costs/summary, /costs/by-agent, /costs/budget, /costs/alert | 统计 |
| Org | /org/chart, /org/roles, /org/members | 组织架构 |
| Goals | /goals, /goals/align | 目标 |
| Approvals | /approvals, /approvals/{id}, /approvals/history | 审批 |
| Audit | /audit/logs | 审计 |
| Heartbeats | /heartbeats, /heartbeats/{id}, /heartbeats/{id}/trigger, /heartbeats/{id}/enable, /heartbeats/{id}/disable, /heartbeats/{id}/logs, /heartbeats/stats | CRUD + 调度 |

## 关键文件索引

| 文件 | 说明 |
|------|------|
| `docs/remote-agent-bridge-architecture.md` | Bridge 架构设计 v2.0（95KB，13章+3附录） |
| `docs/acp-bridge-plan.md` | ACP Bridge 方案 |
| `frontend/DESIGN_SPEC.md` | 前端设计规范（Design Token + Ant Design 主题） |
| `backend/CODE_REVIEW_FIX_REPORT.md` | ORM 迁移代码审查修复报告 |
| `docs/orm-migration-design.md` | ORM 迁移设计文档 |
| `agent-orchestration-v2-plan.md` | 完整开发计划（含版本记录、测试报告、审查记录） |
| `backend/app/models/orm_models.py` | SQLAlchemy 2.0 ORM 模型（16个） |
| `backend/app/database.py` | 数据库连接池配置 |

## 参考文档

- **开发计划**: `agent-orchestration-v2-plan.md`（v3.0，含完整版本记录、测试报告、审查记录）
- **Bridge 架构**: `docs/remote-agent-bridge-architecture.md`（v2.0）
- **前端设计规范**: `frontend/DESIGN_SPEC.md`（v1.0）
- **设计文档**: `docs/superpowers/specs/`
- **需求文档**: `agent-orchestration-requirements.md`
- **架构文档**: `agent-orchestration-architecture.md`
- **测试报告**: `TEST_REPORT*.md`
