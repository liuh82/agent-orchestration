# Nexus — AI Agent 编排系统

> 版本：v3.0 (重构中) | 更新日期：2026-03-15
> 架构文档：`docs/architecture-v1.md`
> 需求文档：`docs/requirements-v1.3.md`

## 项目概述

Nexus 是 AI Agent 编排可视化平台，用于管理 AI Agent（CC / Codex / OpenCode / OpenClaw）、创建项目任务、远程调度开发任务、Token 消耗追踪。支持本地部署和云端双模式。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design 5 + styled-components |
| 后端 | Python FastAPI + Pydantic v2 + SQLAlchemy 2.0 |
| 数据库 | SQLite (本地) / PostgreSQL (云端) |
| 状态管理 | Zustand + React Query |
| 认证 | JWT (access + refresh token) |
| 迁移 | Alembic |
| 部署 | Docker Compose / Nginx + uvicorn |

## 核心规则（⭐ 最重要）

### Git 规则
- **不要自动 git commit** — 完成任务后告诉我，我来 commit
- commit 格式：`feat(模块): 描述`

### 工作范围隔离
- **后端 agent 只改 `backend/` 目录**
- **前端 agent 只改 `frontend/` 目录**
- **不要交叉修改对方目录**
- 共享文件（`docs/`）只读，不修改

### 代码规范
- 后端禁止原生 SQL，用 SQLAlchemy 2.0 ORM
- 前端禁止硬编码颜色/间距，用 Design Token
- 所有 API 响应格式：`{"code": 0, "data": ..., "message": "success"}`
- 分页格式：`{"code": 0, "data": {"items": [...], "total": N, "page": P, "page_size": S}, "message": "success"}`

### 现有代码处理
- **不删除** `app/models/orm_models.py` 和 `app/models/gateway.py`
- 现有 router 暂时重命名为 `*_legacy.py`，新 router 取同名
- 确保 `from app.database import Base` 兼容

### 前端设计
- **必须遵循 `frontend/DESIGN_SPEC.md`**
- 必须使用 Ant Design ConfigProvider 包裹
- 所有页面需要 Loading / Empty / Error 三态

## 开发轮次

### 后端（按顺序）
1. `docs/backend-r1-infrastructure.md` — config + database + Alembic + base models + deps
2. `docs/backend-r2-auth.md` — User model + JWT + auth router
3. `docs/backend-r3-business.md` — Agent/Project/Task/Job 模型 + 25 个 API
4. `docs/backend-r4-admin-config.md` — Admin + settings + notifications + stats + seed

### 前端（按顺序）
1. `docs/frontend-r1-infrastructure.md` — Token + antd-theme + API client + types + stores
2. `docs/frontend-r2-auth-layout.md` — Login/Register + 路由守卫 + MainLayout
3. `docs/frontend-r3-core-pages.md` — Dashboard + Agent + Project + Task 页面
4. `docs/frontend-r4-settings-admin.md` — Settings + Admin 6 页面 + 打磨

## 关键文件索引

| 文件 | 说明 |
|------|------|
| `docs/architecture-v1.md` | 完整架构文档（29KB，13 章） |
| `docs/requirements-v1.3.md` | 需求文档（最终版） |
| `frontend/DESIGN_SPEC.md` | 前端设计规范 |
| `docs/backend-r[1-4]-*.md` | 后端分轮开发提示词 |
| `docs/frontend-r[1-4]-*.md` | 前端分轮开发提示词 |
| `docs/backend-dev-prompt.md` | 后端完整提示词（参考） |
| `docs/frontend-dev-prompt.md` | 前端完整提示词（参考） |

## 开发命令

```bash
# 后端
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8081
python3 -m pytest tests/ -v

# 前端
cd frontend
npm install
npm run dev        # http://localhost:5173
npx tsc --noEmit   # 类型检查
npm run build      # 构建

# 数据库迁移
cd backend
alembic upgrade head
alembic revision --autogenerate -m "描述"
```

## 端口配置

| 服务 | 端口 |
|------|------|
| 前端 Vite | 5173 |
| 后端 uvicorn | 8081 |
| Nginx (外部) | 9443 |
| Nginx → 前端 | 9443 → 5173 |

## API 设计

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/refresh` | 刷新 token |
| GET | `/api/v1/auth/me` | 当前用户 |
| PUT | `/api/v1/auth/me` | 更新信息 |
| PUT | `/api/v1/auth/password` | 改密码 |

### 业务 API
- `/api/v1/agents` — Agent 实例管理
- `/api/v1/agent-types` — Agent 类型（只读）
- `/api/v1/projects` — 项目管理
- `/api/v1/projects/:id/tasks` — 项目下任务
- `/api/v1/tasks/:id` — 任务详情
- `/api/v1/tasks/:id/jobs` — 任务下 Job

### Admin API
- `/api/v1/admin/users` — 用户管理
- `/api/v1/admin/agent-types` — 类型管理
- `/api/v1/admin/settings` — 系统设置
- `/api/v1/admin/stats/global` — 全局统计

### 其他
- `/api/v1/stats/dashboard` — Dashboard 统计
- `/api/v1/notifications/channels` — 通知通道
