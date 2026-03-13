# AI Agent Orchestration - 开发指南

> 当前版本：v2.3.5 | 更新日期：2026-03-13
> 开发计划详见：`agent-orchestration-v2-plan.md`

## 项目概述

AI Agent 编排可视化工具，用于编排 Claude Code 的 Agent、创建开发工作流程、建立、追踪、管理开发任务。对标 Paperclip 的核心功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 4 + Ant Design |
| 后端 | Python FastAPI + Pydantic v2 |
| 数据库 | SQLite (WAL模式) — **正在迁移到 SQLAlchemy 2.0 ORM** |
| 状态管理 | Zustand + React Query |
| 认证 | API Key (MVP，通过 `X-API-Key` header) |
| 测试 | pytest (后端) / tsc + build (前端) |
| 包管理 | npm (前端) / pip (后端) |

## 项目结构

```
agent-orchestration/
├── frontend/                    # React 前端
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
│   │   └── styles/             # 样式 (浅色主题)
│   └── package.json
│
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── main.py             # 应用入口 + lifespan
│   │   ├── auth.py             # API Key 认证中间件
│   │   ├── routers/            # API 路由
│   │   │   ├── agents.py
│   │   │   ├── tasks.py
│   │   │   ├── workflows.py
│   │   │   ├── org.py          # 组织架构
│   │   │   ├── cost.py         # 成本控制
│   │   │   └── heartbeats.py   # 心跳模块
│   │   ├── services/           # 业务逻辑（12个service）
│   │   ├── models/             # Pydantic 模型
│   │   └── services/scheduler.py # APScheduler 单例（线程安全）
│   ├── tests/                  # pytest 测试（23个用例）
│   └── requirements.txt
│
├── docs/superpowers/specs/     # 设计文档
├── TEST_REPORT.md              # 测试报告 1
├── test-report.md              # 测试报告 2
├── backend/test-report.md      # 测试报告 3
├── TEST_REPORT_LOCAL.md        # 测试报告 4（本地验证）
└── agent-orchestration-v2-plan.md  # 完整开发计划
```

## 当前实现状态

### ✅ 已完成

**Agent 管理** — CRUD + 启停 + 日志 + 统计 + 预算控制
**Task 管理** — CRUD + 分配 + 执行 + 暂停/恢复 + 分页
**Workflow 管理** — CRUD + 执行 + 状态查询 + 日志 + 模板
**Cost 成本控制** — 列表 + 汇总 + 按Agent统计 + 预算 + 告警
**Org 组织架构** — 架构图 + 角色 + 成员（后端+前端）
**Goal 目标对齐** — 目标 + 对齐关系（后端+前端）
**Governance 治理** — 审批 + 审计日志（后端+前端）
**Heartbeats 心跳** — CRUD + 调度 + 统计 + 日志（后端+前端）
**API Key 认证** — MVP 版本，所有端点受保护
**安全修复** — SQL注入防御、单例线程安全、输入验证、前端防抖

### 🔲 未实现

- Agent 独立心跳接口
- 按时间段成本统计
- Workflow 可视化编辑器
- Multi-Company 多公司隔离
- Mobile 适配
- JWT 认证（替换 API Key MVP）
- Rate Limiting

## 当前进行中：Phase 5 — ORM 迁移

**目标**：将 12 个 service 文件中的 328 处原生 SQL 迁移到 SQLAlchemy 2.0 ORM。

### 需要创建的文件
- `app/database.py` — engine, SessionLocal, get_db()
- `app/models/orm_models.py` — 16 个 ORM 模型

### 需要重写的 Service（按顺序）
1. task.py (18处) → 2. cost.py (24处) → 3. role.py (26处) → 4. org_chart.py (27处)
→ 5. audit.py (31处) → 6. workflow.py (31处) → 7. approval.py (36处) → 8. member.py (33处)
→ 9. goal.py (38处) → 10. agent.py (38处) → 11. budget_service.py (39处) → 12. heartbeat.py (42处)

### 验收标准
```bash
# 1. 零原生 SQL 残留
grep -rn "cursor.execute\|cursor.fetchall\|cursor.fetchone\|sqlite3.connect\|_get_connection" app/services/

# 2. 测试全部通过
pytest tests/ -v  # 23/23

# 3. 前端无影响
cd ../frontend && npx tsc --noEmit && npm run build

# 4. 启动正常
uvicorn app.main:app --port 8083
```

### ORM 迁移规则
- `SELECT ... WHERE id=?` → `db.execute(select(Model).where(Model.id == id)).scalar_one_or_none()`
- `SELECT *` → `db.execute(select(Model)).scalars().all()`
- `INSERT INTO` → `obj = Model(...); db.add(obj); db.commit(); db.refresh(obj)`
- `UPDATE ... SET` → 直接修改 ORM 对象属性
- `DELETE` → `db.delete(obj)`
- 分页 → `.offset().limit()`
- 事务 → Session 自动管理，异常 `db.rollback()`
- **完全删除** `_get_connection()`、`self.conn`、`sqlite3.connect()`

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
- **禁止原生 SQL** — 使用 SQLAlchemy ORM（迁移完成后强制）
- **禁止硬编码密钥** — 从环境变量读取

### TypeScript / React
- strict 模式，避免 `any`
- 函数式组件 + Hooks
- 未使用的 import/变量必须清理
- 使用 `unknown` 替代 `any` 占位
- 异步操作加防抖（已有 `utils/debounce.ts`）
- 轮询间隔使用 `config/constants.ts` 常量

### API 设计
- RESTful 风格
- 统一响应格式：`{"success": bool, "data": ..., "message": ...}`
- 分页响应：`{"success": bool, "data": [], "pagination": {...}}`
- **不要改现有 API 接口** — URL、请求/响应格式不变

### 安全规范
- API Key 认证（`X-API-Key` header，默认值：`dev-api-key-please-change-in-production`）
- 所有用户输入必须验证
- SQL 参数化查询（ORM 迁移后自动保证）
- 环境变量管理密钥

---

## 开发命令

```bash
# 后端启动（开发模式）
cd backend
uvicorn app.main:app --reload --port 8083

# 后端测试
cd backend
python3 -m pytest tests/ -v --tb=short

# 前端启动（开发模式）
cd frontend
npm install
npm run dev     # http://localhost:5173

# 前端编译检查
npx tsc --noEmit

# 前端构建
npm run build

# API 测试（需认证）
curl -H "X-API-Key: dev-api-key-please-change-in-production" http://localhost:8083/agents
```

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

## 参考文档

- **开发计划**: `agent-orchestration-v2-plan.md`（v3.0，含完整版本记录、测试报告、审查记录）
- **设计文档**: `docs/superpowers/specs/2026-03-12-phase2.5-phase3-heartbeats-design.md`
- **需求文档**: `agent-orchestration-requirements.md`
- **架构文档**: `agent-orchestration-architecture.md`
- **测试报告**: `TEST_REPORT.md` / `test-report.md` / `backend/test-report.md` / `TEST_REPORT_LOCAL.md`
