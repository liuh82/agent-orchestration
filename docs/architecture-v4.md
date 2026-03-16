# Nexus V4 架构设计文档

> 版本: 1.0 | 日期: 2026-03-16 | 基于: architecture-v3.md + 迭代二需求

---

## 一、整体架构

### 1.1 系统分层

```
┌─────────────────────────────────────────────────────┐
│                   Nginx 反向代理 (:9443)              │
│         TLS 终止 | 静态资源 | API 转发                 │
├──────────────────────┬──────────────────────────────┤
│   前端 (Vite/静态)    │     后端 (uvicorn :8082)      │
│                      │                              │
│  ┌────────────────┐  │  ┌────────────────────────┐  │
│  │  Pages/Views   │  │  │  Routers (FastAPI)     │  │
│  ├────────────────┤  │  ├────────────────────────┤  │
│  │  Components    │  │  │  Services (业务逻辑)   │  │
│  ├────────────────┤  │  ├────────────────────────┤  │
│  │  Stores(zustand│  │  │  Models (Pydantic/ORM) │  │
│  ├────────────────┤  │  ├────────────────────────┤  │
│  │  API Client    │  │  │  Database (SQLAlchemy) │  │
│  ├────────────────┤  │  ├────────────────────────┤  │
│  │  WebSocket Clt │◄─┼──┤  Gateway WS Server    │  │
│  └────────────────┘  │  ├────────────────────────┤  │
│                      │  │  Workflow Engine       │  │
│                      │  ├────────────────────────┤  │
│                      │  │  Notification Service  │  │
│                      │  └────────────────────────┘  │
├──────────────────────┴──────────────────────────────┤
│                SQLite (data/nexus.db)                │
│              + 本地文件系统 (uploads/)                 │
├─────────────────────────────────────────────────────┤
│              oc-bridge (远程 Agent 宿主)               │
│         WebSocket/HTTP/gRPC/Stdio 协议               │
└─────────────────────────────────────────────────────┘
```

### 1.2 模块划分与职责

| 层级 | 模块 | 职责 |
|------|------|------|
| **前端路由层** | MainLayout | 前台页面容器，侧边栏导航（Dashboard/Projects/Tasks/Workflows/Settings） |
| | AdminLayout | 后台页面容器，侧边栏导航（管理概览/Gateway/代理中心/用户管理/系统设置/通知配置） |
| **前端页面层** | Dashboard | 默认展示布局（个人维度数据），后台可配置 |
| | ProjectCenter | 项目CRUD + 任务创建（项目/独立任务）+ 文档库 + Agent配置文件 |
| | TaskCenter | 三层级纯监控视图，人工干预，批量操作 |
| | WorkflowEditor | React Flow 可视化编辑器（参照n8n），流程/模板管理 |
| | AgentPages | Agent CRUD + Agent类型管理（Tabs合并） |
| | Settings | 个人设置 + Bridge管理 |
| | AdminPages | 管理概览（合并全局统计）/Gateway管理/用户管理/系统设置/通知配置 |
| **前端基础设施** | API Client | axios封装，JWT拦截，统一错误处理 |
| | Zustand Stores | auth/project/task/agent/workflow/notification/dashboard 状态 |
| | WebSocket | 工作流监控 + 任务日志实时推送 |
| **后端路由层** | Auth Router | 登录/注册/Token刷新/用户信息 |
| | Agent Router | Agent CRUD + 类型管理 + 配置Schema |
| | Project Router | 项目CRUD + 任务创建 + 文档/配置文件 |
| | Task Router | 任务CRUD + 三层级查询 + 人工干预 + 批量操作 |
| | Bridge Router | Bridge CRUD + WebSocket服务 + 任务分发 |
| | Workflow Router | 工作流定义/模板/执行/监控/节点注册 |
| | Notification Router | 6通道配置 + 发送 + 触发规则 |
| | Stats Router | 指标聚合 + Dashboard数据 |
| | Admin Router | 用户管理 + 系统设置 + 全局统计 |
| **后端服务层** | AgentService | Agent生命周期管理，心跳上报处理 |
| | TaskService | 任务调度、执行跟踪、人工干预状态机 |
| | WorkflowEngine | Nexus自研引擎，节点注册/调度/状态机 |
| | NotificationService | 通道适配器 + 触发规则引擎 + 模板渲染 |
| | GatewayService | Bridge连接管理 + 任务分发 + 协议适配 |
| | AuthService | JWT签发/验证/刷新，密码哈希 |
| | FileService | 文件上传/下载/预览，存储管理 |
| **后端基础设施** | Database | SQLAlchemy 2.0 ORM + Alembic迁移 |
| | WebSocket Server | 工作流执行推送 + 任务日志流 |
| | Seed Service | 初始数据（admin用户、Agent类型、系统默认配置） |

### 1.3 核心业务模型变更（V4重点）

```
┌─────────────────────────────────────────────────────────────┐
│                      工作流模板层                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 Workflow Template                     │    │
│  │  - 可复用的任务模板                                    │    │
│  │  - 定义节点、连线、配置schema                           │    │
│  │  - 标记可覆盖的配置项 (config_override_schema)          │    │
│  │  - 支持子工作流 (sub_workflow_enabled)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │ 实例化
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      实例层                                  │
│  ┌───────────────────┐     ┌───────────────────────────┐    │
│  │      Project      │────►│         Task              │    │
│  │  (多任务容器,可选) │     │  (单任务实例)              │    │
│  │                   │     │  - workflow_snapshot       │    │
│  │  - 包含多个Task    │     │  - schedule_type          │    │
│  │  - 项目级文档      │     │  - schedule_config        │    │
│  │  - 项目级Agent配置 │     │  - 独立配置覆盖            │    │
│  │                   │     │  - 任务级文档              │    │
│  └───────────────────┘     └───────────────────────────┘    │
│                                      │                       │
│                                      ▼                       │
│                           ┌───────────────────┐             │
│                           │ TaskAgentConfig   │             │
│                           │ (实例级配置覆盖)   │             │
│                           └───────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

**关键变更：**
1. **工作流 → 任务**：工作流是模板，任务是实例
2. **项目是可选容器**：任务可以属于项目，也可以是独立任务
3. **配置继承与覆盖**：任务继承工作流模板配置，可覆盖特定项
4. **执行调度**：支持立即/定时(cron)/循环(interval)执行

### 1.4 API 契约设计原则

- **统一前缀：** `/api/v1/`（兼容层保留 `/api/` 别名）
- **统一响应格式：**
  ```json
  { "code": 0, "data": { ... }, "message": "success" }
  ```
- **错误码规范：**
  - `0` — 成功
  - `400` — 参数错误
  - `401` — 未认证
  - `403` — 无权限
  - `404` — 资源不存在
  - `409` — 冲突（如名称重复）
  - `500` — 服务器内部错误
- **分页规范：**
  ```json
  { "code": 0, "data": { "items": [...], "total": 100, "page": 1, "page_size": 20 } }
  ```
- **认证方式：** Bearer Token（Access Token），Header: `Authorization: Bearer <token>`

---

## 二、数据库设计

### 2.1 新增表

#### 2.1.1 task_agent_configs（任务Agent配置覆盖表）【V4新增】

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| task_id | String(36) | FK→tasks.id, NOT NULL | 所属任务 |
| workflow_node_id | String(100) | NOT NULL | 工作流节点ID |
| agent_type_id | String(36) | FK→agent_types.id | Agent类型 |
| config_override | Text | JSON | 覆盖的配置（基于 config_override_schema） |
| created_at | String | ISO8601 | 创建时间 |
| updated_at | String | ISO8601 | 更新时间 |

索引: `idx_task_agent_configs_task_id`, `idx_task_agent_configs_node_id`

#### 2.1.2 task_documents（任务文档表）【V4新增】

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| task_id | String(36) | FK→tasks.id, NOT NULL | 所属任务 |
| doc_type | String(50) | NOT NULL | 文档类型: prompt/reference/constraint/output/custom |
| title | String(255) | NOT NULL | 文档标题 |
| content | Text | | 文档内容（Markdown/纯文本） |
| file_path | String(500) | | 上传的文件路径（非文本文件时） |
| file_type | String(50) | | 文件MIME类型: md/pdf/docx/txt |
| file_size | Integer | | 文件大小（字节） |
| uploaded_by | String(36) | FK→users.id | 上传者 |
| created_at | String | ISO8601 | 创建时间 |
| updated_at | String | ISO8601 | 更新时间 |

索引: `idx_task_docs_task_id`, `idx_task_docs_doc_type`

### 2.2 现有表修改

#### 2.2.1 tasks 表增加字段【V4】

```python
# 新增字段
schedule_type: Mapped[Optional[str]] = mapped_column(
    String(20), nullable=True, default='once'
)  # once / cron / interval
schedule_config: Mapped[Optional[str]] = mapped_column(
    Text, nullable=True
)  # JSON: {"cron": "0 9 * * *"} 或 {"interval_seconds": 3600}
workflow_snapshot: Mapped[Optional[str]] = mapped_column(
    Text, nullable=True
)  # JSON: 创建时的workflow定义快照
workflow_id: Mapped[Optional[str]] = mapped_column(
    String(36), ForeignKey('workflows.id'), nullable=True
)  # 来源工作流
```

索引: `idx_tasks_schedule_type`, `idx_tasks_workflow_id`

#### 2.2.2 workflows 表增加字段【V4】

```python
# 新增字段
sub_workflow_enabled: Mapped[bool] = mapped_column(
    Boolean, default=False
)  # 是否允许作为子工作流被调用
version: Mapped[str] = mapped_column(
    String(20), default='1.0.0'
)  # 工作流版本号
```

#### 2.2.3 workflow_nodes 表增加字段【V4】

```python
# 新增字段
config_override_schema: Mapped[Optional[str]] = mapped_column(
    Text, nullable=True
)  # JSON Schema: 定义哪些配置项允许在实例创建时覆盖
```

**config_override_schema 示例：**
```json
{
  "type": "object",
  "properties": {
    "prompt": { "type": "string", "title": "执行指令" },
    "timeout": { "type": "integer", "title": "超时时间(秒)" },
    "model": { "type": "string", "title": "模型" }
  },
  "required": ["prompt"]
}
```

#### 2.2.4 project_documents 表修改【V4】

```python
# 增加 task_id 字段（可选），支持任务级文档
task_id: Mapped[Optional[str]] = mapped_column(
    String(36), ForeignKey('tasks.id'), nullable=True
)
```

#### 2.2.5 gateway_bridges 表（V3已有）

```python
user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
# 目的：Bridge 用户归属隔离
```

### 2.3 完整数据模型图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户与认证                                       │
│  ┌─────────────┐     ┌──────────────────────┐                               │
│  │   users     │────►│ user_session_tokens  │                               │
│  └─────────────┘     └──────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ owns
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Agent 层                                        │
│  ┌─────────────┐     ┌─────────────┐     ┌───────────────────┐              │
│  │ agent_types │◄────│   agents    │────►│  gateway_bridges  │              │
│  └─────────────┘     └─────────────┘     └───────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ executes
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           工作流模板层                                        │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐       │
│  │ workflows   │────►│ workflow_nodes   │────►│ workflow_templates  │       │
│  │ (含版本)    │     │ (含override schema)│    │                     │       │
│  └─────────────┘     └──────────────────┘     └─────────────────────┘       │
│         │                                                                    │
│         │ has many                                                           │
│         ▼                                                                    │
│  ┌───────────────────────┐     ┌───────────────────────────┐                │
│  │ workflow_executions   │────►│ workflow_node_executions  │                │
│  └───────────────────────┘     └───────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ instantiates
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           项目与任务层【V4重构】                               │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────────────┐        │
│  │  projects   │────►│     tasks       │────►│ task_agent_configs  │        │
│  │ (可选容器)  │     │ (含调度配置)    │     │ (配置覆盖)          │        │
│  └─────────────┘     │ (含workflow快照)│     └─────────────────────┘        │
│         │            └─────────────────┘              │                      │
│         │                    │                        │                      │
│         │                    │                        │                      │
│         ▼                    ▼                        ▼                      │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐          │
│  │ project_documents │ │  task_documents   │ │    jobs           │          │
│  │ (项目级文档)      │ │  (任务级文档)     │ │  (执行记录)       │          │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           通知与配置层                                        │
│  ┌───────────────────────┐     ┌─────────────────────┐                       │
│  │ notification_channels │     │ dashboard_layouts   │                       │
│  └───────────────────────┘     └─────────────────────┘                       │
│  ┌───────────────────────┐     ┌─────────────────────┐                       │
│  │ human_interventions   │     │  system_settings    │                       │
│  └───────────────────────┘     └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Alembic 迁移策略（清空重建）

```bash
# Step 1: 备份
cp backend/data/nexus.db backend/data/nexus.db.backup.$(date +%Y%m%d_%H%M%S)

# Step 2: 删除旧数据
rm -rf alembic/versions/*.py
rm backend/data/nexus.db

# Step 3: 生成新迁移
cd backend
alembic revision --autogenerate -m "v4 schema rebuild"

# Step 4: 执行迁移
alembic upgrade head

# Step 5: 创建种子数据（admin账号）
python -m app.seed
```

---

## 三、后端 API 设计

### 3.1 认证 API（auth）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/v1/auth/login` | 登录 | 无 |
| POST | `/api/v1/auth/register` | 注册 | 无 |
| POST | `/api/v1/auth/refresh` | 刷新token | refresh_token |
| POST | `/api/v1/auth/logout` | 登出 | 已认证 |
| GET | `/api/v1/auth/me` | 当前用户 | 已认证 |
| PUT | `/api/v1/auth/me` | 更新信息 | 已认证 |
| PUT | `/api/v1/auth/password` | 改密码 | 已认证 |

### 3.2 用户管理 API（admin）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/admin/users` | 用户列表 | admin |
| PUT | `/api/v1/admin/users/{user_id}/role` | 修改角色 | admin |
| PUT | `/api/v1/admin/users/{user_id}/status` | 启用/禁用 | admin |
| DELETE | `/api/v1/admin/users/{user_id}` | 删除用户 | admin |
| POST | `/api/v1/admin/users/{user_id}/reset-password` | **重置密码【V4新增】** | admin |

**重置密码请求：**
```json
{ "new_password": "NewSecurePassword@123" }
```

### 3.3 项目管理 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/projects` | 项目列表 | 已认证（owner隔离） |
| POST | `/api/v1/projects` | 创建项目 | 已认证 |
| GET | `/api/v1/projects/{project_id}` | 项目详情 | owner/admin |
| PUT | `/api/v1/projects/{project_id}` | 更新项目 | owner/admin |
| DELETE | `/api/v1/projects/{project_id}` | 删除项目 | owner/admin |
| POST | `/api/v1/projects/{project_id}/archive` | 归档项目 | owner/admin |

### 3.3.1 项目文档 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects/{project_id}/documents` | 文档列表 |
| POST | `/api/v1/projects/{project_id}/documents` | 创建文档 |
| GET | `/api/v1/projects/{project_id}/documents/{doc_id}` | 文档详情 |
| PUT | `/api/v1/projects/{project_id}/documents/{doc_id}` | 更新文档 |
| DELETE | `/api/v1/projects/{project_id}/documents/{doc_id}` | 删除文档 |

### 3.4 任务管理 API【V4重构】

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/tasks/tree` | 三层级任务树 | 已认证 |
| GET | `/api/v1/tasks` | 任务列表 | 已认证（owner隔离） |
| POST | `/api/v1/tasks` | **创建任务（绑定工作流）【V4】** | 已认证 |
| GET | `/api/v1/tasks/{task_id}` | 任务详情 | owner/admin |
| PUT | `/api/v1/tasks/{task_id}` | 更新任务 | owner/admin |
| DELETE | `/api/v1/tasks/{task_id}` | 删除任务 | owner/admin |
| POST | `/api/v1/tasks/{task_id}/approve` | 审批通过 | owner/admin |
| POST | `/api/v1/tasks/{task_id}/reject` | 审批驳回 | owner/admin |
| POST | `/api/v1/tasks/batch-action` | 批量操作 | 已认证 |

**创建任务请求（V4）：**
```json
{
  "title": "实现用户登录功能",
  "description": "基于工作流模板创建",
  "project_id": "可选，不填则为独立任务",
  "workflow_id": "工作流模板ID",
  "config_overrides": [
    {
      "workflow_node_id": "agent1",
      "config_override": { "prompt": "自定义指令...", "timeout": 600 }
    }
  ],
  "schedule_type": "once",
  "schedule_config": {}
}
```

### 3.4.1 任务配置覆盖 API【V4新增】

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tasks/{task_id}/configs` | 获取任务配置覆盖列表 |
| POST | `/api/v1/tasks/{task_id}/configs` | 创建/更新配置覆盖 |
| DELETE | `/api/v1/tasks/{task_id}/configs/{config_id}` | 删除配置覆盖 |

### 3.4.2 任务文档 API【V4新增】

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tasks/{task_id}/documents` | 任务文档列表 |
| POST | `/api/v1/tasks/{task_id}/documents` | 创建任务文档 |
| GET | `/api/v1/tasks/{task_id}/documents/{doc_id}` | 文档详情 |
| DELETE | `/api/v1/tasks/{task_id}/documents/{doc_id}` | 删除文档 |

### 3.5 Agent 管理 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/agents` | Agent列表 | 已认证（owner隔离） |
| POST | `/api/v1/agents` | 创建Agent | 已认证 |
| GET | `/api/v1/agents/{agent_id}` | Agent详情 | owner/admin |
| PUT | `/api/v1/agents/{agent_id}` | 更新Agent | owner/admin |
| DELETE | `/api/v1/agents/{agent_id}` | 删除Agent | owner/admin |

### 3.5.1 Agent类型管理 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/agent-types` | 类型列表 | 已认证 |
| POST | `/api/v1/agent-types` | 创建类型 | admin |
| PUT | `/api/v1/agent-types/{type_id}` | 更新类型 | admin |
| DELETE | `/api/v1/agent-types/{type_id}` | 删除类型 | admin |
| GET | `/api/v1/agent-types/{type_id}/schema` | 配置Schema | 已认证 |

### 3.6 Gateway/Bridge 管理 API

#### 用户侧

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/bridges` | Bridge列表 | 已认证（owner隔离） |
| POST | `/api/v1/bridges` | **创建Bridge【V4完善】** | 已认证 |
| GET | `/api/v1/bridges/{bridge_id}` | **Bridge详情【V4新增】** | owner |
| PUT | `/api/v1/bridges/{bridge_id}` | **更新Bridge【V4新增】** | owner |
| DELETE | `/api/v1/bridges/{bridge_id}` | **删除Bridge【V4新增】** | owner |
| GET | `/api/v1/bridges/{bridge_id}/tasks` | Bridge上的任务 | owner |

**创建Bridge请求：**
```json
{
  "name": "my-bridge",
  "bridge_type": "websocket",
  "host": "localhost",
  "port": 8080,
  "protocol": "websocket",
  "auth_config": { "token": "xxx" }
}
```

#### 管理员侧

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/admin/bridges` | 全部Bridge | admin |
| GET | `/api/v1/admin/gateway/status` | Gateway状态 | admin |
| DELETE | `/api/v1/admin/bridges/{bridge_id}` | 删除非法连接 | admin |

### 3.7 工作流 API【V4重构】

#### 工作流定义

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/workflows` | 工作流列表 |
| POST | `/api/v1/workflows` | 创建工作流 |
| GET | `/api/v1/workflows/{workflow_id}` | 工作流详情 |
| PUT | `/api/v1/workflows/{workflow_id}` | 更新工作流 |
| DELETE | `/api/v1/workflows/{workflow_id}` | 删除工作流 |

#### 模板

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/workflow-templates` | 模板列表 |
| POST | `/api/v1/workflow-templates` | 创建模板 |
| PUT | `/api/v1/workflow-templates/{template_id}` | 更新模板 |
| DELETE | `/api/v1/workflow-templates/{template_id}` | 删除模板 |

#### 执行

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/workflows/{workflow_id}/execute` | 执行工作流 |
| GET | `/api/v1/workflow-executions/{execution_id}` | 执行详情 |
| POST | `/api/v1/workflow-executions/{execution_id}/pause` | 暂停执行 |
| POST | `/api/v1/workflow-executions/{execution_id}/resume` | 恢复执行 |
| POST | `/api/v1/workflow-executions/{execution_id}/cancel` | 取消执行 |
| GET | `/api/v1/workflow-executions/{execution_id}/nodes` | 节点执行记录 |

#### 节点注册

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/workflow/node-types` | 节点类型列表及Schema |

### 3.8 通知 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/notifications/channels` | 通知通道列表 |
| POST | `/api/v1/notifications/channels` | 创建通道 |
| PUT | `/api/v1/notifications/channels/{channel_id}` | 更新通道 |
| DELETE | `/api/v1/notifications/channels/{channel_id}` | 删除通道 |
| POST | `/api/v1/notifications/channels/{channel_id}/test` | 测试发送 |
| GET | `/api/v1/notifications/triggers` | 触发事件列表 |
| GET | `/api/v1/notifications/channels/schema/{channel_type}` | **通道配置Schema【V4新增】** |

### 3.9 Dashboard API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/stats/personal` | 个人统计 | 已认证 |
| GET | `/api/v1/stats/global` | 全局统计 | admin |
| GET | `/api/v1/stats/recent-tasks` | 最近任务 | 已认证 |
| GET | `/api/v1/dashboard/layouts` | 布局方案列表 | 已认证 |
| POST | `/api/v1/dashboard/layouts` | 创建布局方案 | 已认证 |
| PUT | `/api/v1/dashboard/layouts/{layout_id}` | 更新布局 | owner |
| DELETE | `/api/v1/dashboard/layouts/{layout_id}` | 删除布局 | owner |

### 3.10 系统设置 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/admin/settings` | 系统设置 | admin |
| PUT | `/api/v1/admin/settings` | 更新设置 | admin |

---

## 四、前端架构

### 4.1 路由设计【V4更新】

```
/                     → 重定向到 /dashboard
/login                → LoginPage
/register             → RegisterPage

--- 前台（MainLayout）---
/dashboard            → DashboardPage（默认展示布局）
/projects             → ProjectListPage
/projects/:id         → ProjectDetailPage（Tab: 概述/任务/文档库/Agent配置）
                      │   概述页：创建任务入口、项目全貌展示
/tasks                → TaskCenterPage（三层级监控视图）
/workflows            → WorkflowListPage（工作流 + 模板库）
/workflows/new        → WorkflowEditorPage（新建，参照n8n）
/workflows/:id/edit   → WorkflowEditorPage（编辑）
/workflows/executions/:id → WorkflowMonitorPage
/agents               → AgentListPage（Tabs: 代理列表 | 类型管理）【V4合并】
/agents/:id           → AgentDetailPage（表单化配置）
/settings             → SettingsPage（个人设置 + Bridge管理）

--- 后台（AdminLayout）---
/admin                → AdminDashboardPage（管理概览，合并原全局统计）【V4合并】
/admin/gateway        → AdminGatewayPage（Bridge CRUD）
/admin/agents         → AdminAgentPage（Tabs: 代理列表 | 类型管理）【V4合并】
/admin/users          → AdminUserPage（含重置密码）【V4新增功能】
/admin/settings       → SystemSettingsPage（含Dashboard布局配置）
/admin/notifications  → AdminNotificationPage（6通道配置）

--- 404 ---
*                     → NotFoundPage
```

### 4.2 前端页面变更【V4重点】

#### 4.2.1 项目中心合并任务创建

**入口变更：**
- 项目列表页增加「创建」按钮
- 点击后弹出 Modal：选择「创建项目」或「创建独立任务」
- 选择后进入工作流模板选择
- 选择模板后填写基本信息 + 配置覆盖
- 支持选择执行方式（立即/定时/循环）

**项目详情页变更：**
- 概述 Tab 增加「创建任务」入口
- 展示项目全貌：任务数/状态、文档数、关联工作流、执行历史
- 描述长文字支持截断+展开/收起

#### 4.2.2 后台首页合并统计页

- 删除独立的 AdminStatsPage
- AdminDashboard 直接展示统计卡片
- 卡片：用户数、项目数、任务数、Agent数、Token消耗、最近活动

#### 4.2.3 代理中心合并Agent类型

- 代理中心改为 Tabs 布局
- Tab 1：代理列表（CRUD）
- Tab 2：类型管理（原 AgentTypePage 功能）
- 删除独立的 /admin/agent-types 路由

#### 4.2.4 工作流编辑器重写（参照n8n）

**左侧节点面板：**
1. **触发器节点**
   - 手动触发（Manual Trigger）
   - 定时触发（Cron Trigger）
   - Webhook 触发（Webhook Trigger）

2. **Agent 节点**
   - 配置：Agent类型、prompt、模型、温度、max_token、超时
   - config_override_schema 标记

3. **逻辑控制节点**
   - IF 条件分支（多输出端口）
   - Switch 多路分支
   - Loop 循环
   - Wait 等待

4. **工作流节点**
   - Sub Workflow（子工作流调用）

5. **数据节点**
   - HTTP Request
   - Code（Python/JS）
   - Set/Transform

6. **输出节点**
   - Output（输出结果）

**画布功能：**
- 拖拽连线
- 自动布局
- 缩放平移 + Mini map
- 撤销/重做（Ctrl+Z / Ctrl+Shift+Z）
- 节点复制/粘贴
- 多选批量删除
- 网格背景

**右侧配置面板：**
- 点击节点打开
- 动态渲染配置表单
- JSON/YAML 高级编辑模式切换
- 配置验证

#### 4.2.5 Dashboard默认展示

**默认布局（首次访问）：**
- 统计卡片：我的任务数、进行中任务、已完成任务、总Agent数
- 最近任务列表：最近5个任务
- Agent状态概览：在线/离线数量
- 最近活动：最近系统事件

**配置入口：**
- 前台 Dashboard 无配置按钮
- 后台系统设置中增加布局配置

### 4.3 状态管理（Zustand Stores）

| Store | 职责 | 关键State |
|-------|------|-----------|
| `useAuthStore` | 认证状态 | user, tokens, login(), logout(), refresh() |
| `useProjectStore` | 项目列表/详情/筛选 | projects, currentProject, filters |
| `useTaskStore` | 任务树/筛选/批量选择 | taskTree, selectedTasks, batchAction() |
| `useAgentStore` | Agent列表/类型 | agents, agentTypes, currentAgent |
| `useWorkflowStore` | 工作流定义/模板/执行 | workflows, templates, executions, editorState |
| `useNotificationStore` | 通知通道配置 | channels, triggers |
| `useDashboardStore` | Dashboard布局/卡片数据 | layout, cards, defaultLayout |
| `useBridgeStore` | Bridge列表/状态 | bridges, bridgeStatus |

### 4.4 组件架构

```
src/
├── components/
│   ├── Layout/
│   │   ├── MainLayout.tsx
│   │   ├── AdminLayout.tsx
│   │   └── Sidebar.tsx
│   ├── common/
│   │   ├── StatusBadge.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── FileUploader.tsx
│   │   ├── FilePreview.tsx
│   │   ├── JsonEditor.tsx
│   │   └── SchemaForm.tsx          # @rjsf 封装
│   ├── dashboard/
│   │   ├── DashboardGrid.tsx       # react-grid-layout
│   │   ├── cards/
│   │   │   ├── TaskStatsCard.tsx
│   │   │   ├── TokenUsageCard.tsx
│   │   │   ├── CostCard.tsx
│   │   │   ├── ActiveProjectsCard.tsx
│   │   │   ├── AgentStatusCard.tsx
│   │   │   └── RecentTasksCard.tsx
│   │   └── LayoutManager.tsx
│   ├── project/
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectDetail.tsx
│   │   ├── CreateTaskModal.tsx     # 【V4新增】任务创建Modal
│   │   ├── WorkflowTemplateSelector.tsx  # 【V4新增】工作流选择器
│   │   ├── ConfigOverridePanel.tsx  # 【V4新增】配置覆盖面板
│   │   ├── DocumentManager.tsx
│   │   └── FileManager.tsx
│   ├── task/
│   │   ├── TaskTree.tsx
│   │   ├── TaskDetail.tsx
│   │   ├── HumanIntervention.tsx
│   │   └── BatchActions.tsx
│   ├── workflow/
│   │   ├── WorkflowEditor.tsx      # 【V4重写】主编辑器
│   │   ├── NodePanel.tsx           # 【V4重写】左侧节点面板
│   │   ├── NodeConfigPanel.tsx     # 【V4重写】右侧配置面板
│   │   ├── Canvas.tsx              # 【V4新增】画布组件
│   │   ├── Toolbar.tsx
│   │   ├── nodes/                  # 【V4重写】节点类型组件
│   │   │   ├── TriggerNode.tsx
│   │   │   ├── AgentNode.tsx
│   │   │   ├── ConditionNode.tsx
│   │   │   ├── LoopNode.tsx
│   │   │   ├── SubWorkflowNode.tsx
│   │   │   ├── HttpRequestNode.tsx
│   │   │   ├── CodeNode.tsx
│   │   │   ├── TransformNode.tsx
│   │   │   ├── NotificationNode.tsx
│   │   │   └── OutputNode.tsx
│   │   ├── WorkflowMonitor.tsx
│   │   └── TemplateLibrary.tsx
│   ├── agent/
│   │   ├── AgentTabs.tsx           # 【V4新增】代理中心Tabs
│   │   ├── AgentList.tsx
│   │   ├── AgentDetail.tsx
│   │   ├── AgentForm.tsx           # 表单化配置
│   │   ├── AgentTypeList.tsx       # 类型管理Tab
│   │   └── AgentTypeForm.tsx
│   ├── notification/
│   │   ├── ChannelList.tsx
│   │   ├── ChannelForm.tsx         # 动态表单
│   │   └── TestSendButton.tsx
│   ├── bridge/
│   │   ├── BridgeList.tsx
│   │   ├── BridgeForm.tsx          # 【V4新增】Bridge CRUD表单
│   │   ├── BridgeSetup.tsx
│   │   └── BridgeStatus.tsx
│   └── admin/
│       ├── AdminStatsCards.tsx     # 【V4合并】统计卡片
│       └── ResetPasswordModal.tsx  # 【V4新增】重置密码Modal
```

---

## 五、工作流引擎设计（Nexus Workflow Engine）

### 5.1 节点类型【V4完整版】

| 节点类型 | 名称 | 说明 | config_override_schema支持 |
|----------|------|------|---------------------------|
| manual_trigger | 手动触发 | 用户手动启动 | - |
| cron_trigger | 定时触发 | Cron表达式 | - |
| webhook_trigger | Webhook触发 | HTTP触发 | - |
| agent | Agent执行 | 调用Agent执行任务 | prompt, timeout, model |
| if | IF条件 | 条件分支（2输出） | - |
| switch | Switch分支 | 多路分支 | - |
| loop | 循环 | 循环执行 | - |
| wait | 等待 | 等待时间/Webhook | - |
| sub_workflow | 子工作流 | 调用其他工作流 | input_params |
| http_request | HTTP请求 | 调用外部API | url, headers, body |
| code | 代码执行 | Python/JS代码 | code |
| transform | 数据转换 | 变量映射 | - |
| notification | 通知 | 发送通知 | - |
| output | 输出 | 输出结果 | - |

### 5.2 工作流定义格式

```json
{
  "id": "wf-uuid",
  "name": "代码审查工作流",
  "version": "1.0.0",
  "sub_workflow_enabled": false,
  "nodes": [
    {
      "id": "trigger1",
      "type": "manual_trigger",
      "position": { "x": 100, "y": 100 },
      "config": {}
    },
    {
      "id": "agent1",
      "type": "agent",
      "position": { "x": 300, "y": 100 },
      "config": {
        "agent_type_id": "claude-code",
        "prompt": "审查代码...",
        "timeout": 600
      },
      "config_override_schema": {
        "type": "object",
        "properties": {
          "prompt": { "type": "string", "title": "执行指令" },
          "timeout": { "type": "integer", "title": "超时时间(秒)" }
        }
      }
    },
    {
      "id": "check1",
      "type": "if",
      "position": { "x": 500, "y": 100 },
      "config": {
        "expression": "{{agent1.output.exit_code}} == 0"
      }
    },
    {
      "id": "notify1",
      "type": "notification",
      "position": { "x": 700, "y": 50 },
      "config": { "channel_id": "xxx" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "trigger1", "target": "agent1" },
    { "id": "e2", "source": "agent1", "target": "check1" },
    { "id": "e3", "source": "check1", "target": "notify1", "sourceHandle": "true" }
  ]
}
```

### 5.3 执行模型

```
1. 用户创建任务 → 选择工作流模板
2. 系统生成 workflow_snapshot（快照）
3. 根据任务配置覆盖节点配置
4. 调度器从触发节点开始执行
5. 每个节点执行产生 workflow_node_execution 记录
6. 通过 WebSocket 推送状态
7. 遇到人工干预 → 暂停 → 等待审批
8. 所有节点完成 → 任务状态更新
```

---

## 六、通知系统设计

### 6.1 通道配置 Schema API

```
GET /api/v1/notifications/channels/schema/{channel_type}
```

**返回示例（飞书）：**
```json
{
  "code": 0,
  "data": {
    "channel_type": "feishu",
    "schema": {
      "type": "object",
      "properties": {
        "webhook_url": { "type": "string", "title": "Webhook URL" },
        "secret": { "type": "string", "title": "签名密钥" }
      },
      "required": ["webhook_url"]
    },
    "ui_schema": {
      "secret": { "ui:widget": "password" }
    }
  }
}
```

### 6.2 六通道配置字段

| 通道 | 配置字段 |
|------|----------|
| 飞书 | webhook_url, secret |
| 钉钉 | webhook_url, secret, keyword |
| 企业微信 | webhook_url |
| Slack | webhook_url, channel, username |
| Discord | webhook_url, username, avatar_url |
| 邮件 | smtp_host, smtp_port, username, password, use_tls, from_email |

---

## 七、安全设计

### 7.1 JWT 双Token 认证

- Access Token: 30分钟有效，内存存储
- Refresh Token: 7天有效，httpOnly Cookie

### 7.2 RBAC 权限

```python
ROLES = {
    "admin": ["*"],
    "user": [
        "projects:own", "tasks:own", "agents:own", "bridges:own",
        "workflows:own", "notifications:own", "settings:own"
    ]
}
```

### 7.3 输入校验

- Pydantic 模型校验
- SQLAlchemy 参数化查询
- 文件上传白名单 + 大小限制（10MB）

---

## 八、开发任务规划

### 迭代二任务列表

| 任务ID | 任务名称 | 依赖 | 说明 |
|--------|----------|------|------|
| T1 | 更新架构设计文档 | - | 本文档 |
| T2 | 数据库清空重建 | T1 | Alembic迁移 + 种子数据 |
| T3 | 后台管理页修复 | - | 合并统计页 + 代理中心Tabs + 重置密码 |
| T4 | Dashboard默认展示 | - | 默认布局 + 配置入口移后台 |
| T5 | 通知系统完善 | - | 配置Schema API + 6通道完善 |
| T6 | Gateway Bridge CRUD | - | 完整CRUD接口 + 前端页面 |
| T7 | Bridge用户隔离 | - | user_id字段 + 权限隔离 |
| T8 | 工作流编辑器重写 | - | 参照n8n，完整重写 |
| T9 | 工作流引擎完善 | T8 | 子工作流 + 新节点类型 |
| T10 | 任务实例化机制 | T2, T8 | 创建流程 + 配置覆盖 + 定时执行 |

---

## 九、技术约束汇总

| 约束 | 说明 |
|------|------|
| Python 版本 | 3.9+ （用 Optional[str] 不用 str \| None） |
| 新增字段 | 必须 Optional（nullable=True） |
| 前端主题 | 统一浅色，禁止纯黑背景 |
| API 响应 | `{ code: 0, data: ..., message: "..." }` |
| 数据库 | SQLite，单文件 data/nexus.db |
| 文件大小限制 | 10MB |
| Access Token | 30分钟 |
| Refresh Token | 7天 |

---

## 附录：与V3的主要差异

| 变更项 | V3 | V4 |
|--------|----|----|
| 任务创建 | 独立创建 | 基于工作流模板实例化 |
| 项目/任务关系 | 项目包含任务 | 项目是可选容器，任务可独立 |
| 任务调度 | 仅立即执行 | 立即/定时(cron)/循环(interval) |
| 配置覆盖 | 无 | 支持 task_agent_configs |
| 后台统计 | 独立页面 | 合并到管理概览 |
| 代理中心 | 分离页面 | Tabs合并 |
| 工作流编辑器 | 基础功能 | 参照n8n重写 |
| Bridge管理 | 仅查看/删除 | 完整CRUD |
| Dashboard | 需配置 | 默认展示 |
