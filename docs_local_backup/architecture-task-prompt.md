# Nexus 编排系统 — 第一轮迭代架构设计任务

## 你的角色

你是一名资深软件架构师，负责为 **Nexus**（原 agent-orchestration）编排系统设计第一轮迭代的架构方案。这是一个 AI Agent 编排管理系统，用于管理和调度多种编程 Agent（如 CC、Codex、OpenCode 等）。

## 任务目标

基于需求文档和现有代码分析，产出一份**完整可执行的第一轮迭代架构设计文档**，包含：
1. 数据模型设计（ER 图 + 详细表定义）
2. API 设计（RESTful 接口）
3. 认证与权限方案
4. 多租户隔离策略
5. 前后端目录结构
6. 部署方案（Docker + 本地部署）
7. 数据迁移策略（v2.4.0 → v3.0.0）

## 需求文档

请阅读以下需求文档：`/root/.openclaw/workspace/agent-orchestration/docs/requirements-v1.3.md`

### 第一轮迭代范围

1. **用户体系**：注册/登录（JWT）、多租户隔离、Admin/User 两级权限、配额管理
2. **后台管理框架**：Admin 后台布局、路由、权限控制
3. **Agent 类型配置 + 实例管理**：类型模板（后台）+ 实例 CRUD（前台）
4. **基础系统设置**：API Keys、模型配置、安全设置、通知通道
5. **Token 消耗采集与存储**：Job 级 token 统计，向上汇总
6. **数据库抽象层**：SQLAlchemy + Alembic，支持 SQLite/PostgreSQL
7. **Docker 部署方案**：docker-compose.yml + .env.example + 首次启动初始化

## 现有代码分析

项目路径：`/root/.openclaw/workspace/agent-orchestration/`

### 技术栈
- 后端：FastAPI + SQLAlchemy 2.0 + Uvicorn（Python）
- 前端：React + Vite + TypeScript + Zustand
- 数据库：当前 SQLite（tasks.db + gateway.db）
- WebSocket：已有 Agent 实时状态推送

### 现有后端结构
```
backend/
├── main.py                          # FastAPI 入口
├── database.py                      # 数据库连接
├── app/
│   ├── models/
│   │   ├── orm_models.py            # 主要 ORM 模型（18 张表）
│   │   ├── gateway.py               # BridgeRecord + TaskRecord
│   │   ├── gateway_schemas.py       # Gateway Pydantic schemas
│   │   ├── agent.py, task.py, workflow.py, cost.py, ...
│   │   ├── org_models.py, role_models.py, goal.py, approval.py, audit_log.py
│   │   ├── heartbeat.py, heartbeat_log.py, member.py, role.py, budget.py, log.py
│   ├── routers/
│   │   ├── agents.py, tasks.py, workflows.py, cost.py, org.py, heartbeats.py, gateway.py
│   ├── services/
│   │   ├── workflow.py, goal.py, org_chart.py, role.py, member.py, audit.py
│   │   ├── heartbeat.py, scheduler.py, lobster_engine.py, workflow_engine_registry.py
```

### 现有前端结构
```
frontend/src/
├── api/         → agents.ts, tasks.ts, workflows.ts, heartbeats.ts, org.ts, client.ts
├── components/  → Header.tsx
├── pages/       → Dashboard, Agents, Tasks, Workflows, Goals, Approvals, Heartbeats, Org, Audit
├── stores/      → agents.ts, tasks.ts, heartbeats.ts, org.ts
├── styles/      → index.tsx
├── types/       → index.ts
├── App.tsx, main.tsx
```

### 现有数据模型（需重点关注的表）

**agents 表**（需重构为 agent_types + agent_instances）：
- 扁平结构，类型和实例混在一起
- 有 token 统计字段但未充分利用
- 无 user_id，无多租户隔离

**tasks 表**（需重构为 projects + tasks + jobs 三层）：
- 扁平单层，无项目/子任务概念
- 无 spec 约束
- 无 token 消耗字段

**members 表**（需改造为 users）：
- 当前为企业级成员管理，需简化为用户表
- 有 role_id 外键到 roles 表

**其他表**：
- org_chart_nodes, departments → 搁置（企业功能）
- goals, goal_alignments → 搁置（改为 Spec 约束）
- approvals, approval_history → 搁置（企业功能）
- audit_logs → 保留基础版
- heartbeats, heartbeat_logs → 保留，加 user_id
- workflows, workflow_templates → 保留，后续轮次处理
- gateway_bridges, gateway_tasks → 保留不动
- cost_entries, daily_costs, budgets, cost_alerts → 保留，加 user_id

## 关键设计约束

1. **多租户隔离**：所有业务表加 user_id，API 层自动注入过滤
2. **Agent 类型/实例分离**：类型是后台模板，实例是用户的前台管理对象
3. **三层任务**：Project → Task → Job，每层有 token 统计
4. **Token 汇总链路**：Job → Task → Project → User → Global
5. **双数据库支持**：SQLite（本地部署默认）+ PostgreSQL（云端）
6. **首次启动初始化**：自动建表、创建 admin 用户、插入系统预置数据
7. **搁置功能保留但不使用**：org、goal、approval 相关表保留在代码中但不暴露 API

## 输出要求

请产出一份 Markdown 格式的架构设计文档，保存到 `/root/.openclaw/workspace/agent-orchestration/docs/architecture-v2.md`，包含：

1. **技术栈确认**（是否需要调整，理由）
2. **数据模型设计**
   - ER 关系图（ASCII 文本）
   - 每张新增/改造表的详细 SQL 定义
   - 搁置表的处理方式
3. **认证与权限方案**
   - JWT 配置、密码安全、登录流程
4. **多租户隔离策略**
   - 中间件实现、全局数据处理
5. **API 设计**
   - 第一轮所有新增/改造的 REST API 列表
   - 请求/响应格式示例
6. **前端路由结构**
   - 前台/后台路由、守卫规则
7. **后端目录结构**
   - 完整的文件/目录规划
8. **部署方案**
   - Docker Compose 配置、.env 模板、初始化流程
9. **数据迁移策略**
   - v2.4.0 → v3.0.0 的迁移方案
10. **开发清单**
    - 后端/前端/部署的具体开发任务 checklist

## 注意事项

- 架构要务实，第一轮迭代范围明确，不要过度设计
- 保留现有 Gateway 相关代码不动
- 搁置功能的表保留但移到 legacy/ 目录，不删除
- 所有 JSON 字段给出示例结构
- 考虑代码可维护性，避免过度抽象
