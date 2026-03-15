# Nexus — 第一轮迭代架构设计文档

**日期**: 2026-03-15  
**基于**: requirements-v1.3.md  
**范围**: 第一轮迭代（用户体系 + 后台框架 + Agent 管理 + 系统设置 + 部署方案）

---

## 一、技术栈确认

| 层 | 现有 | 调整后 | 原因 |
|----|------|--------|------|
| **后端框架** | FastAPI + Uvicorn | ✅ 不变 | — |
| **ORM** | SQLAlchemy 2.0 | ✅ 不变 | — |
| **数据库** | SQLite | SQLite（默认）+ PostgreSQL（云端） | 双模式部署需求 |
| **数据库迁移** | 无 | ✅ **新增** Alembic | 版本升级需要 |
| **认证** | 无 | ✅ **新增** JWT + bcrypt | 用户体系 |
| **前端框架** | React + Vite + TypeScript | ✅ 不变 | — |
| **UI 组件库** | Ant Design 5 | ✅ 不变 | 中文文档好，AI 生成准确率高 |
| **CSS 方案** | styled-components | ✅ 不变 | 自定义组件用 |
| **状态管理** | Zustand | ✅ 不变 | 轻量够用 |
| **数据请求** | react-query | ✅ 不变 | 缓存 + 自动刷新 |
| **HTTP 客户端** | fetch 封装 | ✅ 不变 | — |
| **部署** | 手动 + Nginx | Docker Compose + Nginx | 本地部署需求 |
| **WebSocket** | 已有 | ✅ 不变 | Agent 实时状态 |

---

## 二、现有数据模型分析

### 现有表（共 18 张）

```
agents                    → Agent 实例（扁平，类型混在实例里）
agent_logs                → Agent 日志
tasks                     → 任务（扁平单层，无 Project/Task/Job 层级）
task_assignments          → 任务分配
cost_entries              → 费用记录
daily_costs               → 每日费用汇总
budgets                   → 预算
cost_alerts               → 费用告警
org_chart_nodes           → 组织架构节点（搁置）
departments               → 部门（搁置）
roles                     → 角色
members                   → 成员（企业级，搁置）
goals                     → 目标（改为 Spec，搁置原模型）
goal_alignments           → 目标对齐（搁置）
approvals                 → 审批（搁置）
approval_history          → 审批历史（搁置）
audit_logs                → 审计日志（搁置增强）
heartbeats                → 心跳任务
heartbeat_logs            → 心跳日志
workflows                 → 工作流实例
workflow_templates        → 工作流模板
gateway_bridges           → Bridge 记录
gateway_tasks             → 网关任务记录
```

### 第一轮需要改动的表

| 表 | 动作 | 说明 |
|----|------|------|
| agents | **重构** | 拆分为 agent_types + agent_instances |
| tasks | **重构** | 拆分为 projects + tasks + jobs 三层 |
| cost_entries | **保留+改造** | 挂到 job 层，增加 user_id |
| daily_costs | **保留+改造** | 增加 user_id |
| budgets | **保留+改造** | 增加 user_id |
| heartbeats | **保留+改造** | 增加 user_id |
| heartbeat_logs | 保留 | 不动 |
| workflows | 保留 | 后续轮次处理 |
| workflow_templates | 保留 | 后续轮次处理 |
| gateway_bridges | 保留 | 不动 |
| gateway_tasks | 保留 | 不动 |
| agent_logs | **改造** | 挂到 agent_instances |
| task_assignments | **删除** | 被 jobs 表的 agent_id 替代 |
| org_chart_nodes | **搁置** | 保留但不使用 |
| departments | **搁置** | 保留但不使用 |
| roles | **改造** | 简化为 admin/user 两级 |
| members | **改造** | 重命名为 users，作为用户表 |
| goals | **搁置** | 后续改为 spec |
| goal_alignments | **搁置** | — |
| approvals | **搁置** | 保留但不使用 |
| approval_history | **搁置** | — |
| audit_logs | **搁置** | 保留基础版本 |

---

## 三、新增数据模型（第一轮）

### ER 关系图

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   users     │────<│ agent_instances  │────<│   agent_logs    │
│             │     │                  │     │                 │
│ id (PK)     │     │ id (PK)          │     │ id (PK)         │
│ email       │     │ user_id (FK)     │     │ agent_id (FK)   │
│ password    │     │ type_id (FK)     │     │ level           │
│ name        │     │ name             │     │ message         │
│ role        │     │ status           │     │                 │
│ quota_*     │     │ model            │     └─────────────────┘
│ settings    │     │ config           │
│ created_at  │     │ ...              │
└──────┬──────┘     └──────────────────┘     ┌─────────────────┐
       │                                       │   agent_types   │
       │                                       │                 │
       │     ┌──────────────────┐             │ id (PK)         │
       ├────<│    projects      │             │ name (unique)   │
       │     │                  │             │ protocol        │
       │     │ id (PK)          │             │ config_schema   │
       │     │ user_id (FK)     │             │ capabilities    │
       │     │ name             │             │ models          │
       │     │ description      │             │ is_system       │
       │     │ spec             │             │ created_at      │
       │     │ workflow_id (FK) │             └────────┬────────┘
       │     │ status           │                      │
       │     │ ...              │                      │
       │     └──────┬───────────┘                      │
       │            │                                  │
       │     ┌──────┴───────────┐                      │
       ├────<│     tasks        │                      │
       │     │                  │                      │
       │     │ id (PK)          │                      │
       │     │ project_id (FK)  │                      │
       │     │ user_id (FK)     │                      │
       │     │ parent_task_id   │     ┌────────────────┘
       │     │ name             │     │
       │     │ spec             │     │ (type_id 引用)
       │     │ status           │     │
       │     │ ...              │     │
       │     └──────┬───────────┘     │
       │            │                  │
       │     ┌──────┴───────────┐     │
       ├────<│      jobs        │     │
       │     │                  │     │
       │     │ id (PK)          │     │
       │     │ task_id (FK)     │     │
       │     │ project_id (FK)  │     │
       │     │ user_id (FK)     │     │
       │     │ agent_inst_id(FK)│     │
       │     │ status           │     │
       │     │ input_files      │     │
       │     │ output_files     │     │
       │     │ prompt_tokens    │     │
       │     │ completion_tokens│     │
       │     │ spec             │     │
       │     │ ...              │     │
       │     └──────────────────┘     │
       │                               │
       │     ┌──────────────────┐     │
       ├────<│  cost_entries    │─────┘ (agent_inst_id)
       │     │  daily_costs     │
       │     │  budgets         │
       │     │  heartbeats      │
       │     └──────────────────┘
       │
       │     ┌──────────────────┐
       └────<│ system_settings  │（全局配置，仅 admin）
             │  notification_channels（全局通知配置）
             └──────────────────┘
```

### 新增表详细定义

#### 1. users（重命名改造自 members）

```sql
CREATE TABLE users (
    id              VARCHAR(36) PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,          -- bcrypt
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'user',  -- admin / user
    avatar          VARCHAR(500),
    settings        TEXT,                              -- JSON: 通知偏好、默认模型等
    
    -- 配额
    max_agents      INTEGER DEFAULT 10,
    max_projects    INTEGER DEFAULT 20,
    max_tasks       INTEGER DEFAULT 100,
    
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP
);
```

#### 2. agent_types（新增）

```sql
CREATE TABLE agent_types (
    id              VARCHAR(36) PRIMARY KEY,
    name            VARCHAR(100) UNIQUE NOT NULL,     -- cc, codex, opencode, openclaw
    display_name    VARCHAR(255),
    protocol        VARCHAR(50) NOT NULL,             -- ssh, websocket, local_process
    config_schema   TEXT,                              -- JSON: 连接参数结构定义
    capabilities    TEXT,                              -- JSON: 能力标签列表
    default_models  TEXT,                              -- JSON: 推荐模型列表
    is_system       BOOLEAN DEFAULT TRUE,             -- 系统预置 or 用户自定义
    created_by      VARCHAR(36) REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. agent_instances（改造自 agents）

```sql
CREATE TABLE agent_instances (
    id              VARCHAR(36) PRIMARY KEY,
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id),
    type_id         VARCHAR(36) NOT NULL REFERENCES agent_types(id),
    name            VARCHAR(255) NOT NULL,
    status          VARCHAR(20) DEFAULT 'offline',    -- online, offline, busy, error
    model           VARCHAR(100),
    config          TEXT,                              -- JSON: 连接参数（host, port, token...）
    
    -- 统计
    task_count      INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks    INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    total_cost      FLOAT DEFAULT 0.0,
    
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at    TIMESTAMP,
    
    UNIQUE(user_id, name)
);
```

#### 4. projects（新增）

```sql
CREATE TABLE projects (
    id              VARCHAR(36) PRIMARY KEY,
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    spec            TEXT,                              -- Markdown/YAML 项目级规范
    workflow_id     VARCHAR(36) REFERENCES workflows(id),
    status          VARCHAR(20) DEFAULT 'active',     -- active, completed, archived
    
    -- 汇总统计（冗余字段，后台计算更新）
    total_tasks     INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    total_cost      FLOAT DEFAULT 0.0,
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, name)
);
```

#### 5. tasks（改造，增加层级）

```sql
CREATE TABLE tasks (
    id              VARCHAR(36) PRIMARY KEY,
    project_id      VARCHAR(36) NOT NULL REFERENCES projects(id),
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id),
    parent_task_id  VARCHAR(36) REFERENCES tasks(id),  -- 支持子任务
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    spec            TEXT,                              -- Markdown/YAML 任务级规范
    priority        VARCHAR(20) DEFAULT 'medium',
    status          VARCHAR(20) DEFAULT 'pending',
    depends_on      TEXT,                              -- JSON: [task_id, task_id...] 依赖关系
    assigned_agent  VARCHAR(36) REFERENCES agent_instances(id),
    
    -- 汇总统计
    total_jobs      INTEGER DEFAULT 0,
    completed_jobs  INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    total_cost      FLOAT DEFAULT 0.0,
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP
);
```

#### 6. jobs（新增，原 tasks 的执行单元）

```sql
CREATE TABLE jobs (
    id              VARCHAR(36) PRIMARY KEY,
    task_id         VARCHAR(36) NOT NULL REFERENCES tasks(id),
    project_id      VARCHAR(36) NOT NULL REFERENCES projects(id),
    user_id         VARCHAR(36) NOT NULL REFERENCES users(id),
    agent_inst_id   VARCHAR(36) REFERENCES agent_instances(id),
    
    name            VARCHAR(255),
    status          VARCHAR(20) DEFAULT 'pending',    -- pending/running/completed/failed/waiting_approval
    priority        VARCHAR(20) DEFAULT 'medium',
    
    -- 执行内容
    prompt          TEXT,
    action_params   TEXT,                              -- JSON
    result          TEXT,                              -- JSON
    error_message   TEXT,
    input_files     TEXT,                              -- JSON
    output_files    TEXT,                              -- JSON
    messages        TEXT,                              -- JSON: Agent 会话内容
    node_data       TEXT,                              -- JSON: 节点工作内容
    spec            TEXT,                              -- Spec 约束
    
    -- Token 统计
    prompt_tokens   INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    
    -- 重试
    retry_count     INTEGER DEFAULT 0,
    max_retries     INTEGER DEFAULT 3,
    
    -- 超时
    timeout_seconds INTEGER DEFAULT 300,
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP
);
```

#### 7. system_settings（新增）

```sql
CREATE TABLE system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT NOT NULL,                      -- JSON 值
    description     TEXT,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by      VARCHAR(36) REFERENCES users(id)
);
```

#### 8. notification_channels（新增）

```sql
CREATE TABLE notification_channels (
    id              VARCHAR(36) PRIMARY KEY,
    user_id         VARCHAR(36) REFERENCES users(id),   -- NULL = 全局（admin 配置）
    channel_type    VARCHAR(50) NOT NULL,               -- feishu, dingtalk, wecom, slack, discord, email
    name            VARCHAR(255) NOT NULL,
    config          TEXT NOT NULL,                      -- JSON: webhook_url, secret...
    triggers        TEXT,                              -- JSON: 触发条件列表
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 四、多租户隔离策略

**方式：所有业务表加 `user_id` 字段，API 层自动注入过滤条件。**

```python
# 后端中间件伪代码
async def get_current_user(request) -> User:
    token = request.headers.get("Authorization")
    user = decode_jwt(token)
    return user

# 查询时自动隔离
def query_with_tenant(model, user_id):
    return session.query(model).filter(model.user_id == user_id)
```

**不受用户隔离的全局数据：**
- agent_types（系统预置）
- gateway_bridges / gateway_tasks（系统级）
- system_settings（全局配置）

---

## 五、认证方案

### JWT 认证流程

```
1. POST /api/v1/auth/register → 创建用户
2. POST /api/v1/auth/login    → 返回 access_token + refresh_token
3. 请求头: Authorization: Bearer <access_token>
4. access_token 过期 → 用 refresh_token 换新的
5. /api/v1/auth/refresh       → 刷新 token
```

### Token 配置
- access_token 有效期: 24 小时
- refresh_token 有效期: 7 天
- 存储: localStorage（前端）或 httpOnly cookie（更安全，第二轮考虑）

### 密码安全
- bcrypt 哈希存储
- 最小 8 位
- 登录失败限流（5次/分钟）

---

## 六、API 设计（第一轮）

### 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/refresh` | 刷新 token |
| GET | `/api/v1/auth/me` | 当前用户信息 |
| PUT | `/api/v1/auth/me` | 更新个人信息 |
| PUT | `/api/v1/auth/password` | 修改密码 |

### 用户管理（Admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/users` | 用户列表 |
| PUT | `/api/v1/admin/users/:id/quota` | 修改配额 |
| PUT | `/api/v1/admin/users/:id/role` | 修改角色 |
| PUT | `/api/v1/admin/users/:id/status` | 启用/禁用 |

### Agent 类型（Admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/agent-types` | 类型列表 |
| POST | `/api/v1/admin/agent-types` | 新增类型 |
| PUT | `/api/v1/admin/agent-types/:id` | 编辑类型 |
| DELETE | `/api/v1/admin/agent-types/:id` | 删除类型（仅非系统预置） |

### Agent 实例（用户）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/agents` | 我的 Agent 列表 |
| POST | `/api/v1/agents` | 创建实例 |
| GET | `/api/v1/agents/:id` | 实例详情 |
| PUT | `/api/v1/agents/:id` | 更新配置 |
| DELETE | `/api/v1/agents/:id` | 删除实例 |
| POST | `/api/v1/agents/:id/test` | 测试连通 |
| POST | `/api/v1/agents/:id/start` | 启动 |
| POST | `/api/v1/agents/:id/stop` | 停止 |
| GET | `/api/v1/agents/:id/logs` | 日志 |
| GET | `/api/v1/agent-types` | 可用类型列表（前台只读） |

### 项目（用户）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects` | 我的项目列表 |
| POST | `/api/v1/projects` | 创建项目 |
| GET | `/api/v1/projects/:id` | 项目详情 |
| PUT | `/api/v1/projects/:id` | 更新项目 |
| DELETE | `/api/v1/projects/:id` | 删除/归档项目 |

### 任务（用户）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/:pid/tasks` | 项目下的任务列表 |
| POST | `/api/v1/projects/:pid/tasks` | 创建任务 |
| GET | `/api/v1/tasks/:id` | 任务详情 |
| PUT | `/api/v1/tasks/:id` | 更新任务 |
| DELETE | `/api/v1/tasks/:id` | 删除任务 |

### Job（用户）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tasks/:tid/jobs` | 任务下的 Job 列表 |
| GET | `/api/v1/jobs/:id` | Job 详情 |
| POST | `/api/v1/jobs/:id/retry` | 重试 |
| POST | `/api/v1/jobs/:id/approve` | 审批通过 |
| POST | `/api/v1/jobs/:id/reject` | 审批拒绝 |

### 系统设置（Admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/settings` | 获取所有设置 |
| PUT | `/api/v1/admin/settings` | 批量更新设置 |

### 通知通道

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/notifications/channels` | 我的通道列表 |
| POST | `/api/v1/notifications/channels` | 创建通道 |
| PUT | `/api/v1/notifications/channels/:id` | 更新通道 |
| DELETE | `/api/v1/notifications/channels/:id` | 删除通道 |
| POST | `/api/v1/notifications/channels/:id/test` | 测试发送 |
| GET | `/api/v1/admin/notifications/channels` | 全局通道（Admin） |

### Token/费用统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/stats/dashboard` | Dashboard 汇总 |
| GET | `/api/v1/stats/projects/:id` | 项目统计 |
| GET | `/api/v1/stats/agents/:id` | Agent 统计 |
| GET | `/api/v1/admin/stats/global` | 全局统计（Admin） |

---

## 七、前端路由结构

### 前台（用户）

```
/                          → Dashboard（需登录）
/login                     → 登录页
/register                  → 注册页

/projects                  → 项目列表
/projects/:id              → 项目详情
/projects/:id/tasks        → 任务列表
/tasks/:id                 → 任务详情（含 Jobs）
/jobs/:id                  → Job 详情

/agents                    → Agent 实例列表
/agents/new                → 创建 Agent 实例
/agents/:id                → Agent 详情

/gateway                   → Gateway 监控（保留现有）

/settings                  → 个人设置
/settings/notifications    → 通知通道配置
```

### 后台（Admin）

```
/admin                     → 后台首页（概览）
/admin/users               → 用户管理
/admin/agent-types         → Agent 类型配置
/admin/settings            → 系统设置
/admin/notifications       → 全局通知配置
/admin/stats               → 全局统计
```

### 路由守卫

```typescript
// 未登录 → 重定向 /login
// 已登录但无 admin 权限 → 访问 /admin/* → 403
// 所有 /api/v1/admin/* → 后端验证 admin 角色
```

---

## 八、前端设计规范

> **完整规范文件**: `frontend/DESIGN_SPEC.md`（v1.0, 2026-03-13）
> **所有前端开发 Agent 必须阅读并遵循此规范，以下为核心摘要**

### 8.1 设计风格

以 **Linear.app** 和 **Vercel Dashboard** 为参考：
- 极致简洁、信息密度高、暗色主题
- 清晰的层次结构、精致的阴影和边框

### 8.2 Design Token 系统

所有颜色/间距/字体必须使用 Token，**禁止硬编码**。

**颜色系统**：
- 主色调：Indigo `#6366f1`
- 语义色：绿=成功 `#22c55e`、红=错误 `#ef4444`、黄=警告 `#f59e0b`
- 暗色主题中性色：`#0a0a0a`（背景）→ `#141414`（卡片）→ `#1a1a1a`（浮层）
- 边框：`rgba(255,255,255,0.06)` 默认 / `rgba(255,255,255,0.10)` hover

**间距系统**（基准 4px）：
- 组件内边距：16px / 24px
- 组件间距：24px
- 页面内边距：24px，最大宽度 1400px

**字体**：
- 主字体：Inter
- 等宽字体：JetBrains Mono（代码展示）
- 正文：14px Regular / 标题：20px Semibold / 辅助：12px

**圆角**：
- 按钮/卡片：8px / 大卡片/弹窗：12px / 小元素：4px

**阴影**（极微弱，靠背景色差分层）：
- 卡片：`0 1px 2px rgba(0,0,0,0.2)`
- 浮层：`0 4px 12px rgba(0,0,0,0.3)`
- 模态：`0 16px 48px rgba(0,0,0,0.5)`

### 8.3 Ant Design Token 覆盖

通过 `ConfigProvider` 覆盖默认样式，所有页面必须在其包裹下：

```typescript
// 核心覆盖：colorBgContainer: #141414, colorPrimary: #6366f1,
// colorBorder: rgba(255,255,255,0.06), colorText: #fafafa
// borderRadius: 8, fontSize: 14
// 具体配置见 frontend/DESIGN_SPEC.md 第四章
```

### 8.4 布局规范

```
┌─────────────────────────────────────────────────────────┐
│  Header (56px)                                          │
│  [Logo]  [搜索]                    [通知] [设置] [头像]   │
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  Content Area                                │
│ (240px)  │  ┌──────────────────────────────────────┐   │
│          │  │ Page Header [标题]     [操作按钮]      │   │
│          │  ├──────────────────────────────────────┤   │
│          │  │ Page Content (内边距 24px)             │   │
│          │  └──────────────────────────────────────┘   │
├──────────┴──────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────┘
```

### 8.5 组件规范

**卡片**：背景 `#141414`、边框 `1px rgba(255,255,255,0.06)`、圆角 `12px`、内边距 `24px`
**状态徽章**：圆角 `4px`、`2px 8px` 内边距、12px 字号、带颜色圆点
**表格**：表头背景 `#1a1a1a`、行高 `48px`、无斑马纹、Sticky 表头
**表单**：输入框高度 `36px`、Focus 边框 `#6366f1` + 外发光
**按钮层级**：Primary（主操作）/ Secondary（次要）/ Ghost（过滤）/ Danger（删除）/ Link（导航）

### 8.6 动画

- Hover/Active：`100ms ease-out`
- 展开/收起：`150ms`
- 页面过渡：`300ms`
- 元素进入：`200ms ease-out`（fadeIn + translateY 8px）

### 8.7 暗色/浅色主题

- **默认暗色主题**，所有规范中的颜色值均为暗色主题
- 浅色主题预留，后续切换时覆盖 Token 即可

### 8.8 Agent 开发强制约束

| 规则 | 说明 |
|------|------|
| **必须使用 Design Token** | 禁止硬编码颜色 `#333`、间距 `padding: 13px` |
| **必须使用 Ant Design 组件** | 优先 antd，自定义用 styled-components |
| **必须有 Hover 状态** | 所有可交互元素必须有 hover/focus/active |
| **必须有 Loading 状态** | 加载时显示 Skeleton 或 Spin |
| **必须有 Empty 状态** | 无数据时显示 Empty 组件 |
| **必须有 Error 状态** | 失败时显示错误信息 + 重试按钮 |
| **组件必须抽离** | 超 200 行必须拆分 |

**命名规范**：
- 组件文件：`PascalCase.tsx`（`TaskCard.tsx`）
- 样式组件：`PascalCase`（`const StyledCard = styled.div...`）
- Token 文件：`kebab-case.ts`（`color.ts`）
- 页面组件：`PascalCase + Page`（`TaskCenterPage.tsx`）

### 8.9 Token 文件目录

```
frontend/src/styles/tokens/
├── color.ts       → 颜色系统
├── spacing.ts     → 间距系统
├── typography.ts  → 字体系统
├── radius.ts      → 圆角系统
├── shadow.ts      → 阴影系统
└── animation.ts   → 动画系统

frontend/src/styles/
├── antd-theme.ts  → Ant Design ConfigProvider 配置
└── global.ts      → 全局样式、Keyframes
```

---

## 九、后端目录结构（第一轮改造后）

```
backend/
├── main.py                          # FastAPI 入口
├── database.py                      # 数据库连接 + 引擎（支持 SQLite/PG）
├── alembic/                         # 数据库迁移
│   ├── alembic.ini
│   ├── env.py
│   └── versions/
├── .env.example                     # 环境变量模板
├── app/
│   ├── __init__.py
│   ├── config.py                    # 配置管理（读取 .env）
│   ├── deps.py                      # 依赖注入（当前用户、DB session）
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py                  # Base + 公共字段
│   │   ├── user.py                  # User
│   │   ├── agent_type.py            # AgentType
│   │   ├── agent_instance.py        # AgentInstance
│   │   ├── agent_log.py             # AgentLog
│   │   ├── project.py               # Project
│   │   ├── task.py                  # Task
│   │   ├── job.py                   # Job
│   │   ├── cost.py                  # CostEntry, DailyCost
│   │   ├── heartbeat.py             # Heartbeat, HeartbeatLog
│   │   ├── gateway.py               # BridgeRecord, TaskRecord（保留）
│   │   ├── workflow.py              # Workflow, WorkflowTemplate（保留）
│   │   ├── system_setting.py        # SystemSetting
│   │   ├── notification.py          # NotificationChannel
│   │   └── legacy/                  # 搁置模型（保留不删）
│   │       ├── org_models.py
│   │       ├── role_models.py
│   │       ├── goal.py
│   │       ├── approval.py
│   │       └── audit_log.py
│   ├── schemas/                     # Pydantic 模型
│   │   ├── auth.py
│   │   ├── agent.py
│   │   ├── project.py
│   │   ├── task.py
│   │   ├── job.py
│   │   ├── stats.py
│   │   ├── settings.py
│   │   └── notification.py
│   ├── routers/
│   │   ├── auth.py                  # ✅ 新增
│   │   ├── admin.py                 # ✅ 新增
│   │   ├── agents.py                # 重构
│   │   ├── projects.py              # ✅ 新增
│   │   ├── tasks.py                 # 重构
│   │   ├── jobs.py                  # ✅ 新增
│   │   ├── gateway.py               # 保留
│   │   ├── heartbeats.py            # 改造
│   │   ├── stats.py                 # ✅ 新增
│   │   ├── settings.py              # ✅ 新增
│   │   ├── notifications.py         # ✅ 新增
│   │   └── ws.py                    # WebSocket（Agent 实时状态）
│   ├── services/
│   │   ├── auth.py                  # ✅ 新增（JWT, bcrypt）
│   │   ├── agent.py                 # 重构
│   │   ├── project.py               # ✅ 新增
│   │   ├── task.py                  # 重构
│   │   ├── job.py                   # ✅ 新增
│   │   ├── stats.py                 # ✅ 新增（汇总计算）
│   │   ├── notification.py          # ✅ 新增
│   │   └── gateway/                 # 保留现有
│   └── middleware/
│       ├── auth.py                  # ✅ 新增（JWT 验证中间件）
│       ├── tenant.py                # ✅ 新增（多租户隔离）
│       └── rate_limit.py            # ✅ 新增
└── tests/
    ├── test_auth.py
    ├── test_agents.py
    ├── test_projects.py
    ├── test_tasks.py
    └── test_jobs.py
```

### 前端目录结构（第一轮改造后）

```
frontend/
├── src/
│   ├── api/                         # API 客户端
│   │   ├── client.ts                # axios/fetch 封装（带 JWT 拦截器）
│   │   ├── auth.ts
│   │   ├── agents.ts
│   │   ├── projects.ts
│   │   ├── tasks.ts
│   │   ├── jobs.ts
│   │   ├── stats.ts
│   │   ├── settings.ts
│   │   └── notifications.ts
│   ├── components/                  # 公共组件
│   │   ├── Layout/
│   │   │   ├── MainLayout.tsx       # 主布局（Header + Sidebar + Content）
│   │   │   ├── Sidebar.tsx          # 侧边栏导航
│   │   │   ├── Header.tsx           # 顶部栏
│   │   │   └── AdminLayout.tsx      # Admin 后台布局
│   │   ├── Auth/
│   │   │   ├── ProtectedRoute.tsx   # 路由守卫
│   │   │   ├── AdminRoute.tsx       # Admin 路由守卫
│   │   │   └── GuestRoute.tsx       # 未登录路由
│   │   ├── common/
│   │   │   ├── StatusBadge.tsx      # 状态徽章
│   │   │   ├── EmptyState.tsx       # 空状态
│   │   │   ├── ErrorBlock.tsx       # 错误状态
│   │   │   └── PageHeader.tsx       # 页面标题栏
│   │   └── ...
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── agents/
│   │   │   ├── AgentListPage.tsx
│   │   │   ├── AgentNewPage.tsx
│   │   │   └── AgentDetailPage.tsx
│   │   ├── projects/
│   │   │   ├── ProjectListPage.tsx
│   │   │   ├── ProjectDetailPage.tsx
│   │   │   └── TaskListPage.tsx
│   │   ├── tasks/
│   │   │   ├── TaskDetailPage.tsx
│   │   │   └── JobDetailPage.tsx
│   │   ├── settings/
│   │   │   ├── SettingsPage.tsx
│   │   │   └── NotificationPage.tsx
│   │   └── admin/
│   │       ├── AdminDashboard.tsx
│   │       ├── UserManagePage.tsx
│   │       ├── AgentTypePage.tsx
│   │       ├── SystemSettingsPage.tsx
│   │       ├── AdminNotificationPage.tsx
│   │       └── AdminStatsPage.tsx
│   ├── stores/
│   │   ├── auth.ts                  # 用户认证状态
│   │   ├── agents.ts
│   │   ├── projects.ts
│   │   └── ui.ts                    # UI 状态（侧边栏折叠等）
│   ├── styles/
│   │   ├── tokens/                  # Design Token（必须使用）
│   │   │   ├── color.ts
│   │   │   ├── spacing.ts
│   │   │   ├── typography.ts
│   │   │   ├── radius.ts
│   │   │   ├── shadow.ts
│   │   │   └── animation.ts
│   │   ├── antd-theme.ts            # ConfigProvider 主题覆盖
│   │   └── global.ts                # 全局样式 + Keyframes
│   ├── types/
│   │   ├── auth.ts
│   │   ├── agent.ts
│   │   ├── project.ts
│   │   ├── task.ts
│   │   └── job.ts
│   ├── hooks/                       # 自定义 hooks
│   │   ├── useAuth.ts
│   │   └── usePagination.ts
│   ├── App.tsx
│   └── main.tsx
├── DESIGN_SPEC.md                   # ⭐ 前端设计规范（必读）
├── package.json
└── vite.config.ts
```

---

## 十、Docker 部署方案

### docker-compose.yml

```yaml
version: '3.8'

services:
  nexus-backend:
    build: ./backend
    ports:
      - "8081:8081"
    environment:
      - DATABASE_URL=sqlite:///./data/nexus.db   # 或 postgresql://...
      - JWT_SECRET=${JWT_SECRET}
      - JWT_ACCESS_EXPIRE_HOURS=24
      - JWT_REFRESH_EXPIRE_DAYS=7
      - ADMIN_EMAIL=${ADMIN_EMAIL:-admin@nexus.local}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-changeme}
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  nexus-frontend:
    build: ./frontend
    ports:
      - "9443:80"
    depends_on:
      - nexus-backend
    restart: unless-stopped
```

### .env.example

```bash
# === 数据库 ===
DATABASE_URL=sqlite:///./data/nexus.db
# DATABASE_URL=postgresql://nexus:nexus123@db:5432/nexus

# === JWT ===
JWT_SECRET=change-this-to-a-random-string
JWT_ACCESS_EXPIRE_HOURS=24
JWT_REFRESH_EXPIRE_DAYS=7

# === 首次启动初始化管理员 ===
ADMIN_EMAIL=admin@nexus.local
ADMIN_PASSWORD=changeme

# === Gateway ===
GATEWAY_WS_PORT=8765
GATEWAY_HEARTBEAT_INTERVAL=30

# === 日志 ===
LOG_LEVEL=INFO
```

### 首次启动流程

```python
# startup.py
async def init_app():
    # 1. 检查数据库，不存在则 create_all + 运行 migration
    # 2. 检查是否有 admin 用户，没有则用环境变量创建
    # 3. 插入系统预置 agent_types（cc, codex, opencode, openclaw）
    # 4. 插入默认 system_settings
```

---

## 十一、数据迁移策略（v2.4.0 → v3.0.0）

由于是结构性重构，不采用增量迁移，而是：

1. **新版本全新建表**（Alembic 生成新 schema）
2. **提供数据迁移脚本**（可选）：将 v2.4.0 的 agents/tasks 数据迁移到新结构
   - `agents` → `agent_instances`（自动归到 admin 用户，type 设为 "cc"）
   - `tasks` → `projects` + `tasks` + `jobs`（简单迁移，无层级分解）
3. **原表不删**，放入 `legacy/` 目录备用

---

## 十二、第一轮开发清单

### 后端
- [ ] 数据库抽象层（SQLite/PostgreSQL 切换）
- [ ] Alembic 配置 + 初始 migration
- [ ] User 模型 + JWT 认证（登录/注册/刷新）
- [ ] 多租户中间件（自动注入 user_id 过滤）
- [ ] AgentType 模型 + CRUD API（Admin）
- [ ] AgentInstance 模型 + CRUD API（用户）
- [ ] Project 模型 + CRUD API
- [ ] Task 模型 + CRUD API
- [ ] Job 模型 + CRUD API
- [ ] SystemSetting 模型 + API（Admin）
- [ ] NotificationChannel 模型 + API
- [ ] Stats 汇总 API（Dashboard/项目/Agent/全局）
- [ ] 首次启动初始化逻辑
- [ ] 系统预置 AgentType 数据（cc, codex, opencode, openclaw）

### 前端
- [ ] Design Token 系统搭建（`styles/tokens/` 6 个文件）
- [ ] Ant Design ConfigProvider 主题覆盖（`antd-theme.ts`）
- [ ] API 客户端重构（带 JWT 拦截器、自动刷新）
- [ ] 登录/注册页面
- [ ] 路由守卫（ProtectedRoute / AdminRoute / GuestRoute）
- [ ] 主布局（MainLayout + Sidebar + Header）
- [ ] Admin 后台布局（AdminLayout）
- [ ] Dashboard 基础版
- [ ] Agent 实例管理页面（列表 + 创建 + 详情）
- [ ] Agent 类型列表（前台只读）
- [ ] 项目管理页面（列表 + 详情）
- [ ] 任务管理页面（基础版）
- [ ] 个人设置页面
- [ ] 通知通道配置页面

### 部署
- [ ] Dockerfile（后端 + 前端）
- [ ] docker-compose.yml
- [ ] .env.example
- [ ] 数据迁移脚本
- [ ] README.md

---

## 十三、参考资料索引

| 文件 | 路径 | 用途 |
|------|------|------|
| 需求文档 | `docs/requirements-v1.3.md` | 功能需求 |
| 前端设计规范 | `frontend/DESIGN_SPEC.md` | 前端开发强制约束 |
| 现有后端模型 | `backend/app/models/orm_models.py` | 数据模型参考 |
| 现有 Gateway 模型 | `backend/app/models/gateway.py` | Gateway 参考 |
| 功能审计 | `docs/feature-audit.md` | v2.4.0 功能清单 |
| v2.4.0 验收报告 | `docs/reviews/acceptance-report-2026-03-14.md` | 已有功能验证 |

---

> **待老板审阅架构方案后，进入开发阶段。**
