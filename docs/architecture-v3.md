# Nexus V3 架构设计文档

> 版本: 1.0 | 日期: 2026-03-15 | 基于: requirements-v3-confirmation.md

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
| **前端页面层** | Dashboard | 可定制卡片布局，个人维度数据 |
| | ProjectCenter | 项目CRUD + 文档库 + Agent配置文件 + 任务文件管理 |
| | TaskCenter | 三层级纯监控视图，人工干预，批量操作 |
| | WorkflowEditor | React Flow 可视化编辑器，流程/模板管理 |
| | AgentPages | Agent CRUD + Agent类型管理 |
| | Settings | 个人设置 + Bridge管理 |
| | AdminPages | 管理概览/Gateway管理/用户管理/系统设置/通知配置 |
| **前端基础设施** | API Client | axios封装，JWT拦截，统一错误处理 |
| | Zustand Stores | auth/project/task/agent/workflow/notification/dashboard 状态 |
| | WebSocket | 工作流监控 + 任务日志实时推送 |
| **后端路由层** | Auth Router | 登录/注册/Token刷新/用户信息 |
| | Agent Router | Agent CRUD + 类型管理 + 配置Schema |
| | Project Router | 项目CRUD + 文档/配置文件/任务文件 |
| | Task Router | 任务CRUD + 三层级查询 + 人工干预 + 批量操作 |
| | Gateway Router | Bridge CRUD + WebSocket服务 + 任务分发 |
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

### 1.3 API 契约设计原则

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
- **Token刷新：** Access Token 过期时前端自动用 Refresh Token 换取新 Access Token

### 1.4 数据流

```
用户操作 → 前端页面 → API Client → FastAPI Router → Service → ORM → SQLite
                                                    ↓
                                              WebSocket Server ← 实时推送
                                                    ↓
                                              Notification Service → 外部通道
                                                    ↓
                                              oc-bridge ← Agent宿主 ← Agent工具执行
```

### 1.5 部署架构

```
用户浏览器 → Nginx (:9443)
               ├── / → 前端静态文件 (build/)
               └── /api/* → proxy_pass http://127.0.0.1:8082
                              └── FastAPI (uvicorn :8082)
                                      └── SQLite (data/nexus.db)
                                      └── uploads/ (本地文件存储)
```

---

## 二、数据库设计

### 2.1 新增表

#### 2.1.1 project_documents（项目文档表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| project_id | String(36) | FK→projects.id, NOT NULL | 所属项目 |
| doc_type | String(50) | NOT NULL | 文档类型: overview/architecture/spec/dependency/custom |
| title | String(255) | NOT NULL | 文档标题 |
| content | Text | | 文档内容（Markdown/纯文本） |
| file_path | String(500) | | 上传的文件路径（非文本文件时） |
| file_type | String(50) | | 文件MIME类型: md/pdf/docx/txt |
| file_size | Integer | | 文件大小（字节） |
| created_by | String(36) | FK→users.id | 创建者 |
| created_at | String | ISO8601 | 创建时间 |
| updated_at | String | ISO8601 | 更新时间 |

索引: `idx_project_docs_project_id`, `idx_project_docs_doc_type`

#### 2.1.2 agent_config_files（Agent配置文件表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| project_id | String(36) | FK→projects.id, NOT NULL | 所属项目 |
| agent_type_id | String(36) | FK→agent_types.id | Agent类型（关联模板） |
| config_type | String(100) | NOT NULL | 配置类型: CLAUDE.md/SOUL.md/AGENTS.md/opencode.json/custom |
| content | Text | | 配置文件内容 |
| is_template | Boolean | default false | 是否为项目级默认模板 |
| created_at | String | ISO8601 | 创建时间 |
| updated_at | String | ISO8601 | 更新时间 |

索引: `idx_agent_config_project_type`

#### 2.1.3 task_files（任务文件表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| task_id | String(36) | FK→tasks.id, NOT NULL | 所属任务 |
| file_type | String(50) | NOT NULL | 文件类型: prompt/input/reference/constraint/output |
| file_name | String(255) | NOT NULL | 文件名 |
| file_path | String(500) | NOT NULL | 文件存储路径 |
| file_size | Integer | | 文件大小（字节） |
| mime_type | String(100) | | MIME类型 |
| uploaded_by | String(36) | FK→users.id | 上传者 |
| created_at | String | ISO8601 | 上传时间 |

索引: `idx_task_files_task_id`, `idx_task_files_file_type`

#### 2.1.4 human_interventions（人工干预决策表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| task_id | String(36) | FK→tasks.id, NOT NULL | 关联任务 |
| workflow_execution_id | String(36) | FK→workflow_executions.id | 关联工作流执行 |
| node_id | String(100) | | 触发节点ID |
| status | String(20) | default 'pending' | pending/approved/rejected/modified |
| context | Text | | Agent提交的上下文（JSON：原因、代码片段等） |
| decision | String(20) | | 用户的决策类型: approve/reject/modify |
| comment | Text | | 用户意见/修改指令 |
| attachment_paths | Text | | 附件路径列表（JSON数组） |
| decided_by | String(36) | FK→users.id | 决策人 |
| decided_at | String | ISO8601 | 决策时间 |
| created_at | String | ISO8601 | 创建时间 |

索引: `idx_interventions_status`, `idx_interventions_task_id`

#### 2.1.5 workflow_executions（工作流执行实例表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| workflow_id | String(36) | FK→workflows.id | 来源工作流定义 |
| template_id | String(36) | FK→workflow_templates.id | 来源模板（可选） |
| name | String(255) | NOT NULL | 执行实例名称 |
| status | String(20) | NOT NULL | pending/running/paused/completed/failed/cancelled |
| current_node_id | String(100) | | 当前执行到的节点 |
| input_params | Text | JSON | 输入参数 |
| output_data | Text | JSON | 输出数据 |
| error_message | Text | | 错误信息 |
| started_at | String | ISO8601 | 开始时间 |
| completed_at | String | ISO8601 | 完成时间 |
| created_by | String(36) | FK→users.id | 创建者 |
| created_at | String | ISO8601 | 创建时间 |
| updated_at | String | ISO8601 | 更新时间 |

索引: `idx_wf_exec_status`, `idx_wf_exec_workflow_id`, `idx_wf_exec_created_by`

#### 2.1.6 workflow_node_executions（节点执行记录表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| execution_id | String(36) | FK→workflow_executions.id, NOT NULL | 所属执行实例 |
| node_id | String(100) | NOT NULL | 节点定义中的ID |
| node_type | String(50) | NOT NULL | 节点类型: agent/condition/human/gateway/parallel/transform/notification/timer |
| node_config | Text | JSON | 节点配置快照 |
| status | String(20) | NOT NULL | waiting/running/completed/failed/skipped/paused |
| input_data | Text | JSON | 节点输入数据 |
| output_data | Text | JSON | 节点输出数据 |
| agent_id | String(36) | FK→agents.id | 执行此节点的Agent（agent类型节点） |
| task_id | String(36) | FK→tasks.id | 关联的任务（agent类型节点） |
| error_message | Text | | 错误信息 |
| started_at | String | ISO8601 | 开始时间 |
| completed_at | String | ISO8601 | 完成时间 |
| duration_ms | Integer | | 执行耗时（毫秒） |

索引: `idx_node_exec_execution_id`, `idx_node_exec_status`

#### 2.1.7 dashboard_layouts（Dashboard布局方案表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| user_id | String(36) | FK→users.id, NOT NULL | 所属用户 |
| scope | String(20) | NOT NULL | 'frontend' | 'admin' |
| name | String(100) | NOT NULL | 方案名称 |
| is_default | Boolean | default false | 是否默认方案 |
| layout | Text | JSON | 布局数据（卡片列表+位置+尺寸+配置） |
| created_at | String | ISO8601 | 创建时间 |
| updated_at | String | ISO8601 | 更新时间 |

索引: `idx_dashboard_layouts_user_scope`

#### 2.1.8 user_session_tokens（会话Token表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | String(36) | PK, UUID | 主键 |
| user_id | String(36) | FK→users.id, NOT NULL | 用户 |
| token_type | String(20) | NOT NULL | 'access' | 'refresh' |
| token_hash | String(255) | NOT NULL, UNIQUE | Token哈希值（不存明文） |
| device_info | String(255) | | 设备信息 |
| ip_address | String(45) | | IP地址 |
| expires_at | String | ISO8601 | 过期时间 |
| revoked_at | String | ISO8601 | 撤销时间（NULL=有效） |
| created_at | String | ISO8601 | 创建时间 |

索引: `idx_session_tokens_user`, `idx_session_tokens_hash`

### 2.2 现有表修改

#### 2.2.1 gateway_bridges 增加 user_id

```python
user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
```
- **目的：** Bridge 用户归属隔离，用户只能操作自己的 Bridge
- **迁移：** Optional 字段，现有数据 user_id 为 NULL，后续用户创建的 Bridge 自动填充
- **Alembic:**
  ```python
  op.add_column('gateway_bridges', sa.Column('user_id', sa.String(36), nullable=True))
  op.create_index('idx_gateway_bridges_user_id', 'gateway_bridges', ['user_id'])
  ```

#### 2.2.2 agents 表 bridge_url 改为 bridge_id

```python
# 新增
bridge_id: Mapped[Optional[str]] = mapped_column(String(255), ForeignKey('gateway_bridges.bridge_id'))
# 保留 bridge_url（过渡期），后续版本移除
```
- **目的：** Agent 创建时绑定 Bridge，用外键关联替代 URL 字符串
- **迁移：** 新增 bridge_id（Optional），保留 bridge_url 兼容旧数据
- **前端创建表单：** Bridge 下拉选择框替代 URL 输入框

#### 2.2.3 notification_channels config 字段扩展

现有 config 为单一 JSON 字符串，扩展为结构化配置：

```json
// 飞书
{ "webhook_url": "...", "secret": "..." }
// 钉钉
{ "webhook_url": "...", "secret": "...", "keyword": "..." }
// 企业微信
{ "webhook_url": "...", "corp_id": "...", "agent_id": "...", "secret": "..." }
// Slack
{ "webhook_url": "...", "channel": "...", "username": "..." }
// Discord
{ "webhook_url": "...", "username": "...", "avatar_url": "..." }
// 邮件
{ "smtp_host": "...", "smtp_port": 587, "username": "...", "password": "...", "use_tls": true, "from_email": "..." }
```

#### 2.2.4 通知类型名统一

- 后端当前用 `wecom`，前端用 `wechat_work` → **统一为 `wecom`**
- 前端修改类型名映射，后端不变

### 2.3 Alembic 迁移策略

```bash
# 初始化（如果还没有）
alembic init alembic

# 生成迁移
alembic revision --autogenerate -m "v3_add_project_docs_and_workflow_exec"

# 执行迁移
alembic upgrade head
```

**规则：**
1. 所有新增字段/表必须 Optional（nullable=True 或 default 值）
2. 不修改现有字段的类型或约束（只增不删）
3. 迁移脚本包含 upgrade() 和 downgrade()
4. 每个迁移脚本一个原子变更

---

## 三、后端 API 设计

### 3.1 认证 API（auth）

#### POST /api/v1/auth/login
- **请求：** `{ "email": "admin@example.com", "password": "Admin@2026" }`
- **响应：** `{ "code": 0, "data": { "access_token": "...", "refresh_token": "...", "expires_in": 1800, "user": { "id": "...", "email": "...", "name": "...", "role": "admin" } } }`
- **权限：** 无

#### POST /api/v1/auth/register
- **请求：** `{ "email": "user@example.com", "password": "xxx", "name": "张三" }`
- **响应：** `{ "code": 0, "data": { "user": { "id": "...", "email": "..." } } }`
- **权限：** 无

#### POST /api/v1/auth/refresh
- **请求：** `{ "refresh_token": "..." }`
- **响应：** `{ "code": 0, "data": { "access_token": "...", "expires_in": 1800 } }`
- **权限：** 有效 refresh_token

#### POST /api/v1/auth/logout
- **请求：** `{ "refresh_token": "..." }`（Header 中 Bearer access_token）
- **响应：** `{ "code": 0, "data": null }`
- **权限：** 已认证

#### GET /api/v1/auth/me
- **响应：** `{ "code": 0, "data": { "id": "...", "email": "...", "name": "...", "role": "admin" } }`
- **权限：** 已认证

#### PUT /api/v1/auth/password
- **请求：** `{ "old_password": "...", "new_password": "..." }`
- **响应：** `{ "code": 0 }`
- **权限：** 已认证

### 3.2 用户管理 API（admin）

#### GET /api/v1/admin/users
- **参数：** `?page=1&page_size=20&search=&status=&role=`
- **响应：** `{ "code": 0, "data": { "items": [...], "total": 100 } }`
- **权限：** admin

#### PUT /api/v1/admin/users/{user_id}/role
- **请求：** `{ "role": "admin" | "user" }`
- **权限：** admin

#### PUT /api/v1/admin/users/{user_id}/status
- **请求：** `{ "status": "active" | "disabled" }`
- **权限：** admin

#### DELETE /api/v1/admin/users/{user_id}
- **权限：** admin
- **备注：** 软删除

### 3.3 项目管理 API

#### GET /api/v1/projects
- **参数：** `?page=1&page_size=20&search=&status=`
- **权限：** 已认证（只返回自己的项目，admin看全部）
- **响应：** `{ "code": 0, "data": { "items": [{ "id", "name", "description", "status", "total_tasks", "completed_tasks", "total_tokens", "total_cost", "created_at" }], "total" } }`

#### POST /api/v1/projects
- **请求：** `{ "name": "...", "description": "..." }`
- **权限：** 已认证

#### GET /api/v1/projects/{project_id}
- **权限：** owner 或 admin

#### PUT /api/v1/projects/{project_id}
- **权限：** owner 或 admin

#### DELETE /api/v1/projects/{project_id}
- **权限：** owner 或 admin
- **备注：** 软删除（status → archived）

#### POST /api/v1/projects/{project_id}/archive
- **权限：** owner 或 admin

### 3.3.1 项目文档 API

#### GET /api/v1/projects/{project_id}/documents
- **参数：** `?doc_type=overview|architecture|spec|dependency|custom`
- **响应：** 文档列表

#### POST /api/v1/projects/{project_id}/documents
- **请求（文本）：** `{ "doc_type": "overview", "title": "项目概述", "content": "..." }`
- **请求（文件）：** `multipart/form-data { "doc_type", "title", "file" }`
- **权限：** owner 或 admin

#### GET /api/v1/projects/{project_id}/documents/{doc_id}
- **响应：** 文档内容或文件下载

#### PUT /api/v1/projects/{project_id}/documents/{doc_id}
- **权限：** owner 或 admin

#### DELETE /api/v1/projects/{project_id}/documents/{doc_id}
- **权限：** owner 或 admin

### 3.3.2 Agent配置文件 API

#### GET /api/v1/projects/{project_id}/agent-configs
- **参数：** `?agent_type_id=&config_type=`
- **响应：** 配置文件列表

#### POST /api/v1/projects/{project_id}/agent-configs
- **请求：** `{ "agent_type_id": "...", "config_type": "CLAUDE.md", "content": "..." }`
- **备注：** 如果 agent_type_id 对应的 config_type 已有模板，则覆盖；否则新建

#### GET /api/v1/projects/{project_id}/agent-configs/{config_id}
#### PUT /api/v1/projects/{project_id}/agent-configs/{config_id}
#### DELETE /api/v1/projects/{project_id}/agent-configs/{config_id}

### 3.3.3 任务文件 API

#### GET /api/v1/tasks/{task_id}/files
- **参数：** `?file_type=prompt|input|reference|constraint|output`
- **响应：** 文件列表

#### POST /api/v1/tasks/{task_id}/files
- **请求：** `multipart/form-data { "file_type": "prompt", "file" }`
- **权限：** owner 或 admin

#### GET /api/v1/tasks/{task_id}/files/{file_id}/download
- **响应：** 文件流下载

#### DELETE /api/v1/tasks/{task_id}/files/{file_id}

### 3.4 任务管理 API

#### GET /api/v1/tasks/tree
- **说明：** 三层级数据，一次返回
- **响应：**
  ```json
  {
    "code": 0,
    "data": [
      {
        "project_id": "...", "project_name": "...", "task_stats": { "running": 2, "completed": 5, "failed": 1 },
        "tasks": [
          {
            "id": "...", "title": "...", "status": "running", "agent": { "name": "...", "status": "..." },
            "progress": 60, "started_at": "...",
            "agent_executions": [
              { "agent_id": "...", "agent_name": "...", "status": "running", "logs": [...], "output_files": [...] }
            ]
          }
        ]
      }
    ]
  }
  ```

#### POST /api/v1/tasks/{task_id}/approve
- **请求：** `{ "decision": "approve", "comment": "..." }`
- **说明：** 人工干预审批通过

#### POST /api/v1/tasks/{task_id}/reject
- **请求：** `{ "decision": "reject", "comment": "修改意见..." }`
- **请求（带附件）：** `multipart/form-data { "decision": "reject", "comment": "...", "attachments": [...] }`

#### POST /api/v1/tasks/batch-action
- **请求：** `{ "task_ids": ["...", "..."], "action": "pause" | "cancel" }`

### 3.5 Agent 管理 API

#### GET /api/v1/agents
- **参数：** `?page=1&page_size=20&status=&type=`
- **权限：** 已认证（只返回自己的Agent，admin看全部）

#### POST /api/v1/agents
- **请求：** `{ "name": "...", "agent_type_id": "...", "bridge_id": "...", "model": "...", "timeout": 300, "max_retries": 3, "config": { ... } }`
- **权限：** 已认证
- **备注：** model 标注为"预期模型"，config 根据 agent_type 的 config_schema 自动生成

#### GET /api/v1/agents/{agent_id}
- **响应：** Agent详情 + 统计 + 绑定Bridge信息

#### PUT /api/v1/agents/{agent_id}
#### DELETE /api/v1/agents/{agent_id}

### 3.5.1 Agent类型管理 API

#### GET /api/v1/agent-types
- **响应：** 类型列表

#### POST /api/v1/agent-types（admin）
- **请求：** `{ "name": "...", "display_name": "Claude Code", "protocol": "stdio", "capabilities": [...], "preset_models": [...], "config_schema": { ... } }`

#### PUT /api/v1/agent-types/{type_id}（admin）
#### DELETE /api/v1/agent-types/{type_id}（admin）

#### GET /api/v1/agent-types/{type_id}/schema
- **响应：** 该类型的 JSON Schema（用于前端 @rjsf 渲染表单）

### 3.6 Gateway/Bridge 管理 API

#### 用户侧

#### GET /api/v1/bridges
- **权限：** 已认证（只返回自己的Bridge）
- **响应：** Bridge列表 + 状态 + 最后活跃时间

#### POST /api/v1/bridges
- **请求：** `{ "name": "my-bridge" }`
- **响应：** `{ "code": 0, "data": { "bridge_id": "...", "api_key": "...", "ws_url": "ws://...", "setup_command": "oc-bridge setup --url ws://... --token ..." } }`
- **说明：** 系统生成 API Key + 配置指引

#### PUT /api/v1/bridges/{bridge_id}
#### DELETE /api/v1/bridges/{bridge_id}
- **权限：** owner

#### GET /api/v1/bridges/{bridge_id}/tasks
- **响应：** 该Bridge上的任务列表

#### 管理员侧

#### GET /api/v1/admin/bridges
- **权限：** admin
- **响应：** 全部用户的Bridge列表

#### GET /api/v1/admin/gateway/status
- **权限：** admin
- **响应：** `{ "total_connections": 5, "active_connections": 3, "total_tasks": 12, "system_load": "..." }`

#### DELETE /api/v1/admin/bridges/{bridge_id}
- **权限：** admin（删除非法连接）

### 3.7 工作流 API

#### 工作流定义

#### GET /api/v1/workflows
- **参数：** `?page=1&page_size=20&status=`
- **响应：** 工作流定义列表

#### POST /api/v1/workflows
- **请求：** `{ "name": "...", "description": "...", "engine": "nexus", "definition": { "nodes": [...], "edges": [...] }, "config": { ... } }`

#### PUT /api/v1/workflows/{workflow_id}
#### DELETE /api/v1/workflows/{workflow_id}

#### 模板

#### GET /api/v1/workflow-templates
- **参数：** `?category=`

#### POST /api/v1/workflow-templates
- **请求：** `{ "name": "...", "description": "...", "category": "development", "engine": "nexus", "definition": { ... } }`

#### PUT /api/v1/workflow-templates/{template_id}
#### DELETE /api/v1/workflow-templates/{template_id}

#### 执行

#### POST /api/v1/workflows/{workflow_id}/execute
- **请求：** `{ "name": "执行实例名称", "input_params": { ... } }`
- **响应：** `{ "code": 0, "data": { "execution_id": "..." } }`
- **说明：** 生成流程按钮对应的API

#### POST /api/v1/workflow-executions/{execution_id}/pause
#### POST /api/v1/workflow-executions/{execution_id}/resume
#### POST /api/v1/workflow-executions/{execution_id}/cancel

#### GET /api/v1/workflow-executions/{execution_id}
- **响应：** 执行实例详情 + 所有节点执行状态

#### GET /api/v1/workflow-executions/{execution_id}/nodes
- **响应：** 节点执行记录列表

#### 节点注册

#### GET /api/v1/workflow/node-types
- **响应：** 已注册的节点类型列表及各自的 Schema

### 3.8 通知 API

#### GET /api/v1/notifications/channels
- **参数：** `?channel_type=&is_active=`
- **权限：** admin 看全部，user 看自己的

#### POST /api/v1/notifications/channels
- **请求：** `{ "channel_type": "feishu", "name": "飞书通知", "config": { "webhook_url": "...", "secret": "..." }, "triggers": ["task.completed", "task.failed", "task.timeout", "human_intervention.pending"], "is_active": true }`

#### PUT /api/v1/notifications/channels/{channel_id}
- **说明：** 按通道类型展示不同的配置表单字段

#### DELETE /api/v1/notifications/channels/{channel_id}

#### POST /api/v1/notifications/channels/{channel_id}/test
- **说明：** 发送测试消息验证配置

#### GET /api/v1/notifications/triggers
- **响应：** 可用的触发事件列表
- `task.completed`, `task.failed`, `task.timeout`, `task.running`, `human_intervention.pending`, `human_intervention.resolved`

### 3.9 Dashboard API

#### GET /api/v1/stats/personal
- **权限：** 已认证
- **响应：** 个人维度统计卡片数据

#### GET /api/v1/stats/global
- **权限：** admin
- **响应：** 全局维度统计卡片数据

#### GET /api/v1/stats/recent-tasks
- **参数：** `?limit=10`

### 3.9.1 Dashboard布局 API

#### GET /api/v1/dashboard/layouts
- **参数：** `?scope=frontend|admin`
- **权限：** 已认证（返回自己的布局方案）

#### POST /api/v1/dashboard/layouts
- **请求：** `{ "scope": "frontend", "name": "默认布局", "is_default": true, "layout": { "cards": [{ "type": "task_stats", "x": 0, "y": 0, "w": 6, "h": 4, "config": {} }] } }`

#### PUT /api/v1/dashboard/layouts/{layout_id}
#### DELETE /api/v1/dashboard/layouts/{layout_id}
#### POST /api/v1/dashboard/layouts/{layout_id}/set-default

### 3.10 系统设置 API

#### GET /api/v1/admin/settings
- **权限：** admin
- **响应：** 所有设置键值对

#### PUT /api/v1/admin/settings
- **请求：** `{ "settings": { "heartbeat_interval": 60, "max_concurrent_tasks": 5, "job_default_timeout": 300, "default_model": "" } }`

### 3.11 文件上传/下载 API

#### POST /api/v1/files/upload
- **请求：** `multipart/form-data { "file" }`
- **响应：** `{ "code": 0, "data": { "file_id": "...", "file_path": "uploads/2026/03/15/xxx.md", "file_size": 1024, "mime_type": "text/markdown" } }`

#### GET /api/v1/files/{file_id}
- **响应：** 文件流下载（带 Content-Disposition）

#### GET /api/v1/files/{file_id}/preview
- **响应：** 文件内容（文本文件返回内容，图片返回缩略图URL）

---

## 四、前端架构

### 4.1 路由设计

```
/                     → 重定向到 /dashboard
/login                → LoginPage
/register             → RegisterPage

--- 前台（MainLayout）---
/dashboard            → DashboardPage
/projects             → ProjectListPage
/projects/:id         → ProjectDetailPage（Tab: 概述/任务/文档库/Agent配置/文件管理）
/tasks                → TaskCenterPage（三层级）
/workflows            → WorkflowListPage（流程实例 + 模板库）
/workflows/new        → WorkflowEditorPage（新建/编辑）
/workflows/:id/edit   → WorkflowEditorPage（编辑模板）
/workflows/executions/:id → WorkflowMonitorPage（监控视图）
/agents               → AgentListPage（前台只看自己的）
/agents/:id           → AgentDetailPage
/settings             → SettingsPage（个人设置 + Bridge管理）

--- 后台（AdminLayout）---
/admin                → AdminDashboardPage（管理概览）
/admin/gateway        → AdminGatewayPage
/admin/agents         → AdminAgentPage（代理中心，含Agent类型子Tab）
/admin/users          → AdminUserPage
/admin/settings       → SystemSettingsPage
/admin/notifications  → AdminNotificationPage

--- 404 ---
*                     → NotFoundPage
```

**权限守卫逻辑：**
- `/admin/*` → 检查 role === 'admin'，否则重定向到 `/`
- 所有其他路由 → 检查已认证，否则重定向到 `/login`

### 4.2 状态管理（Zustand Stores）

| Store | 职责 | 关键State |
|-------|------|-----------|
| `useAuthStore` | 认证状态 | user, tokens, login(), logout(), refresh() |
| `useProjectStore` | 项目列表/详情/筛选 | projects, currentProject, filters, fetchProjects() |
| `useTaskStore` | 任务树/筛选/批量选择 | taskTree, selectedTasks, batchAction() |
| `useAgentStore` | Agent列表/类型 | agents, agentTypes, currentAgent |
| `useWorkflowStore` | 工作流定义/模板/执行 | workflows, templates, executions, currentEditor |
| `useNotificationStore` | 通知通道配置 | channels, triggers |
| `useDashboardStore` | Dashboard布局/卡片数据 | layout, cards, setLayout() |
| `useBridgeStore` | Bridge列表/状态 | bridges, bridgeStatus |

### 4.3 组件架构

```
src/
├── components/
│   ├── Layout/
│   │   ├── MainLayout.tsx          # 前台容器
│   │   ├── AdminLayout.tsx         # 后台容器
│   │   └── Sidebar.tsx             # 通用侧边栏
│   ├── common/
│   │   ├── StatusBadge.tsx         # 状态徽章
│   │   ├── ConfirmDialog.tsx       # 确认弹窗
│   │   ├── FileUploader.tsx        # 文件上传组件
│   │   ├── FilePreview.tsx         # 文件预览组件
│   │   ├── JsonEditor.tsx          # JSON编辑器（带Schema验证）
│   │   └── SchemaForm.tsx          # @rjsf 封装组件
│   ├── dashboard/
│   │   ├── DashboardGrid.tsx       # 拖拽网格容器
│   │   ├── cards/                  # 各类型卡片组件
│   │   │   ├── TaskStatsCard.tsx
│   │   │   ├── TokenUsageCard.tsx
│   │   │   ├── CostCard.tsx
│   │   │   ├── ActiveProjectsCard.tsx
│   │   │   ├── AgentStatusCard.tsx
│   │   │   └── RecentTasksCard.tsx
│   │   └── LayoutManager.tsx       # 布局方案管理
│   ├── project/
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectDetail.tsx
│   │   ├── DocumentManager.tsx     # 文档库
│   │   ├── AgentConfigEditor.tsx   # Agent配置文件编辑
│   │   └── FileManager.tsx         # 任务文件管理
│   ├── task/
│   │   ├── TaskTree.tsx            # 三层级展示
│   │   ├── TaskDetail.tsx
│   │   ├── HumanIntervention.tsx   # 人工干预面板
│   │   └── BatchActions.tsx        # 批量操作工具栏
│   ├── workflow/
│   │   ├── WorkflowEditor.tsx      # React Flow 主编辑器
│   │   ├── NodePanel.tsx           # 左侧节点面板
│   │   ├── NodeConfigPanel.tsx     # 右侧节点配置面板
│   │   ├── Toolbar.tsx             # 顶部工具栏（生成流程/保存模板）
│   │   ├── nodes/                  # 各节点类型组件
│   │   │   ├── AgentNode.tsx
│   │   │   ├── ConditionNode.tsx
│   │   │   ├── HumanNode.tsx
│   │   │   ├── ParallelNode.tsx
│   │   │   ├── TransformNode.tsx
│   │   │   ├── NotificationNode.tsx
│   │   │   └── TimerNode.tsx
│   │   ├── WorkflowMonitor.tsx     # 执行监控视图
│   │   └── TemplateLibrary.tsx     # 模板库
│   ├── agent/
│   │   ├── AgentList.tsx
│   │   ├── AgentDetail.tsx
│   │   ├── AgentForm.tsx           # 创建/编辑表单（SchemaForm）
│   │   ├── AgentTypeList.tsx       # 类型管理子Tab
│   │   └── AgentTypeForm.tsx
│   ├── notification/
│   │   ├── ChannelList.tsx
│   │   ├── ChannelForm.tsx         # 动态表单（按通道类型）
│   │   └── TestSendButton.tsx
│   └── bridge/
│       ├── BridgeList.tsx
│       ├── BridgeSetup.tsx         # 添加Bridge引导
│       └── BridgeStatus.tsx
```

### 4.4 API 层设计

```typescript
// src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截：注入 Access Token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截：统一错误处理 + Token 自动刷新
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await useAuthStore.getState().refreshToken();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    }
    if (error.response?.status === 403) {
      // 跳转到无权限页面
    }
    return Promise.reject(error.response?.data || error);
  }
);

// 模块化 API 文件
// src/api/auth.ts, src/api/agents.ts, src/api/projects.ts, ...
```

### 4.5 Dashboard 可定制化方案

**选型：react-grid-layout**
- 成熟稳定的网格布局库，支持拖拽、缩放
- 与 React 18 兼容良好
- 社区活跃，Star 数高

**实现方案：**
```typescript
// 布局数据结构
interface DashboardLayout {
  cards: Array<{
    id: string;
    type: 'task_stats' | 'token_usage' | 'cost' | 'active_projects' | 'agent_status' | 'recent_tasks';
    x: number;    // 列位置
    y: number;    // 行位置
    w: number;    // 宽度（格子数）
    h: number;    // 高度（格子数）
    config: Record<string, unknown>;  // 卡片特定配置
  }>;
}
```

**持久化：** 保存到后端 `dashboard_layouts` 表，通过 API 同步
**响应式：** `react-grid-layout` 内置响应式断点支持
**折叠/展开：** 每张卡片右上角有折叠按钮，折叠后高度变为最小值

---

## 五、工作流引擎设计（Nexus Workflow Engine）

### 5.1 引擎架构

```
┌────────────────────────────────────────────────┐
│              WorkflowEngine (核心调度器)          │
├────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌───────────────────────┐   │
│  │ NodeRegistry  │  │ ExecutionStateManager │   │
│  │ (节点注册表)  │  │ (执行状态机)           │   │
│  └──────────────┘  └───────────────────────┘   │
│  ┌──────────────┐  ┌───────────────────────┐   │
│  │ TaskBridge    │  │ EventPublisher        │   │
│  │ (任务桥接)    │  │ (事件发布→WebSocket)  │   │
│  └──────────────┘  └───────────────────────┘   │
├────────────────────────────────────────────────┤
│              NodeExecutor (节点执行器)           │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │Agent   │ │Condition│ │Human  │ │Parallel │  │
│  │Executor│ │Executor │ │Executor│ │Executor │  │
│  └────────┘ └────────┘ └────────┘ └────────┘  │
│  ┌────────┐ ┌────────┐ ┌────────┐             │
│  │Transform│ │Notifi. │ │Timer  │             │
│  │Executor│ │Executor│ │Executor│             │
│  └────────┘ └────────┘ └────────┘             │
└────────────────────────────────────────────────┘
```

### 5.2 节点注册机制

```python
# backend/app/services/workflow_engine/registry.py

class NodeRegistry:
    """插件式节点类型注册表"""

    _nodes: Dict[str, NodeTypeDefinition] = {}

    @classmethod
    def register(cls, node_type: str, schema_version: str = "1.0"):
        """装饰器：注册节点类型"""
        def decorator(node_class):
            cls._nodes[node_type] = NodeTypeDefinition(
                type=node_type,
                schema_version=schema_version,
                executor_class=node_class,
                config_schema=node_class.CONFIG_SCHEMA,
                input_schema=node_class.INPUT_SCHEMA,
                output_schema=node_class.OUTPUT_SCHEMA,
            )
            return node_class
        return decorator

    @classmethod
    def get_node_types(cls) -> List[NodeTypeDefinition]:
        return list(cls._nodes.values())

    @classmethod
    def get_executor(cls, node_type: str) -> Type[BaseNodeExecutor]:
        return cls._nodes[node_type].executor_class


# 注册示例
@NodeRegistry.register("agent", "1.0")
class AgentNodeExecutor(BaseNodeExecutor):
    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "agent_id": {"type": "string", "title": "选择Agent"},
            "prompt": {"type": "string", "title": "执行指令"},
            "timeout": {"type": "integer", "title": "超时(秒)", "default": 300},
            "max_retries": {"type": "integer", "title": "最大重试", "default": 1},
        },
        "required": ["agent_id", "prompt"]
    }
```

**Schema 版本化规则：**
- 每个节点类型有 `schema_version`（如 "1.0"、"1.1"、"2.0"）
- 次版本号（1.0→1.1）向下兼容，可无缝升级
- 主版本号（1.0→2.0）为破坏性变更，需迁移工具
- 已保存的工作流定义中包含 schema_version，加载时做兼容性检查

### 5.3 执行模型

```
工作流定义 (JSON):
{
  "nodes": [
    { "id": "start", "type": "timer", "config": { "cron": "0 9 * * 1" } },
    { "id": "agent1", "type": "agent", "config": { "agent_id": "...", "prompt": "..." } },
    { "id": "check", "type": "condition", "config": { "expression": "{{agent1.output.exit_code}} == 0" } },
    { "id": "human1", "type": "human", "config": { "timeout": 86400 } },
    { "id": "notify", "type": "notification", "config": { "channel_id": "..." } }
  ],
  "edges": [
    { "from": "start", "to": "agent1" },
    { "from": "agent1", "to": "check" },
    { "from": "check", "to": "human1", "condition": "false" },
    { "from": "check", "to": "notify", "condition": "true" },
    { "from": "human1", "to": "agent1", "label": "重新执行" },
    { "from": "human1", "to": "notify", "label": "发送通知" }
  ]
}
```

**执行流程：**
1. 从起始节点（无入边的节点）开始
2. 调度器取当前可执行的节点
3. 创建 `workflow_node_executions` 记录
4. 通过 `NodeExecutor` 执行节点逻辑
5. 将输出数据传递给下游节点
6. 通过 WebSocket 推送执行状态
7. 遇到人工干预节点 → 暂停，等待用户决策
8. 遇到条件分支 → 评估条件，选择分支路径
9. 遇到并行节点 → 同时执行多个分支
10. 所有节点完成 → 工作流状态更新为 completed

### 5.4 状态机

```
工作流实例状态:
pending → running → paused → running → completed
                   → cancelled
                   → failed

节点执行状态:
waiting → running → completed
                  → failed
                  → paused (人工干预)
                  → skipped (条件分支未选中)
```

### 5.5 WebSocket 推送方案

**后端：** FastAPI 内置 WebSocket

```python
# backend/app/services/workflow_engine/event_publisher.py

class WorkflowEventPublisher:
    """工作流事件发布到 WebSocket"""

    async def publish(self, execution_id: str, event: dict):
        await ws_manager.broadcast(f"workflow:{execution_id}", event)

# 事件类型:
# { "type": "node.status_changed", "node_id": "agent1", "status": "running", "timestamp": "..." }
# { "type": "node.output", "node_id": "agent1", "output": { ... } }
# { "type": "node.log", "node_id": "agent1", "log": { "level": "info", "message": "..." } }
# { "type": "execution.status_changed", "status": "completed" }
# { "type": "human_intervention.required", "node_id": "human1", "context": { ... } }
```

**前端：**

```typescript
// src/utils/websocket.ts
class WorkflowWebSocket {
  private ws: WebSocket | null = null;

  connect(executionId: string) {
    this.ws = new WebSocket(`ws://${location.host}/api/v1/ws/workflow/${executionId}`);
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // 根据 data.type 更新 zustand store
    };
  }
}
```

### 5.6 与任务系统集成

```
工作流执行 → 调度 Agent 节点 → 创建 Task（关联 workflow_execution_id）
Task 执行完成 → 回调工作流引擎 → 推进到下一个节点
Task 遇到人工干预 → 暂停工作流 → 等待审批 → 继续/终止
```

---

## 六、通知系统设计

### 6.1 通道适配器模式

```python
# backend/app/services/notification/adapters/base.py

class BaseNotificationAdapter(ABC):
    """通知通道适配器基类"""

    channel_type: str

    @abstractmethod
    async def send(self, config: dict, message: NotificationMessage) -> bool:
        """发送通知"""
        pass

    @abstractmethod
    async def validate_config(self, config: dict) -> tuple[bool, str]:
        """验证配置是否有效"""
        pass

    @abstractmethod
    def get_config_schema(self) -> dict:
        """返回该通道的配置 JSON Schema（前端表单用）"""
        pass
```

### 6.2 六通道实现

#### 飞书 (FeishuAdapter)
- **协议：** POST https://open.feishu.cn/open-apis/bot/v2/hook/{webhook_id}
- **签名：** 对请求体做 HMAC-SHA256，将签名放在 header `X-Lark-Signature`
- **消息格式：** `{ "msg_type": "interactive" | "text", "content": { "text": "..." } }`

#### 钉钉 (DingtalkAdapter)
- **协议：** POST https://oapi.dingtalk.com/robot/send?access_token={token}
- **加签：** timestamp + "\n" + secret → HMAC-SHA256 → sign 参数
- **消息格式：** `{ "msgtype": "text", "text": { "content": "..." } }`

#### 企业微信 (WeComAdapter)
- **协议：** POST https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={key}
- **消息格式：** `{ "msgtype": "text", "text": { "content": "..." } }`
- **类型名统一：** 后端 `wecom`，前端同步为 `wecom`

#### Slack (SlackAdapter)
- **协议：** POST {webhook_url}
- **消息格式：** `{ "text": "..." }` 或 Blocks 格式
- **认证：** 无需额外认证（Webhook URL 本身包含鉴权）

#### Discord (DiscordAdapter)
- **协议：** POST {webhook_url}
- **消息格式：** `{ "content": "...", "username": "Nexus", "avatar_url": "..." }`
- **Embed 支持：** `{ "embeds": [{ "title": "...", "description": "...", "color": 3447003 }] }`

#### 邮件 (EmailAdapter)
- **协议：** SMTP
- **配置：** host, port, username, password, use_tls, from_email
- **依赖：** `aiosmtplib`（异步SMTP客户端）
- **消息格式：** HTML 邮件模板

### 6.3 触发规则引擎

```python
# 事件驱动
TRIGGER_EVENTS = {
    "task.completed": "任务完成",
    "task.failed": "任务失败",
    "task.timeout": "任务超时",
    "task.running": "任务开始执行",
    "human_intervention.pending": "人工干预待审批",
    "human_intervention.resolved": "人工干预已处理",
}

# 在 Service 层触发
class NotificationTrigger:
    @staticmethod
    async def emit(event: str, context: dict):
        channels = await get_active_channels_for_event(event)
        for channel in channels:
            adapter = get_adapter(channel.channel_type)
            message = render_template(channel, event, context)
            await adapter.send(channel.config, message)
```

### 6.4 通知内容模板

```python
# 使用 Python 字符串模板
TEMPLATES = {
    "task.completed": "✅ 任务完成\n任务: {task_title}\nAgent: {agent_name}\n耗时: {duration}",
    "task.failed": "❌ 任务失败\n任务: {task_title}\nAgent: {agent_name}\n错误: {error}",
    "human_intervention.pending": "⏳ 需要人工审批\n任务: {task_title}\nAgent: {agent_name}\n原因: {context}",
}
```

---

## 七、安全设计

### 7.1 JWT 双Token 认证流程

```
1. 用户登录 → 验证密码
2. 生成 Access Token (JWT, 30min有效)
3. 生成 Refresh Token (JWT, 7天有效)
4. Access Token → 通过响应体返回（前端内存保存）
5. Refresh Token → 通过 httpOnly Cookie 返回
6. 后续请求 → Header: Authorization: Bearer <access_token>
7. Access Token 过期 → 401 → 前端自动调用 /auth/refresh（携带Cookie中的Refresh Token）
8. Refresh Token 过期 → 重定向登录页
```

**JWT Payload：**
```json
// Access Token
{ "sub": "user_id", "role": "admin", "type": "access", "exp": 1740000000, "jti": "uuid" }

// Refresh Token
{ "sub": "user_id", "type": "refresh", "exp": 1740604800, "jti": "uuid" }
```

### 7.2 Token 存储方案

- **Access Token：** 前端 JavaScript 内存（zustand store），不持久化到 localStorage
- **Refresh Token：** httpOnly + Secure + SameSite=Lax Cookie，防止 XSS 窃取
- **后端 Token 记录：** `user_session_tokens` 表存储 token_hash，支持撤销

### 7.3 RBAC 权限模型

```python
# 简单两角色模型
ROLES = {
    "admin": ["*"],  # 所有权限
    "user": [
        "projects:own", "tasks:own", "agents:own", "bridges:own",
        "workflows:own", "notifications:own", "settings:own",
        "dashboard:own"
    ]
}

# 装饰器/依赖
def require_role(role: str):
    async def dependency(current_user = Depends(get_current_user)):
        if current_user.role != role and current_user.role != "admin":
            raise HTTPException(403, "无权限")
        return current_user
    return dependency
```

### 7.4 输入校验

- **Pydantic 模型：** 所有 API 入参使用 Pydantic BaseModel 自动校验
- **SQL 注入：** SQLAlchemy ORM 参数化查询，不拼接 SQL
- **命令注入：** 用户输入（如项目路径）必须经过白名单校验，禁止 shell 元字符
- **文件上传：** 校验文件类型白名单、文件大小限制（10MB）、文件名消毒

### 7.5 XSS 防护

- **React 默认转义：** JSX 自动转义 HTML
- **用户内容渲染：** 使用 `DOMPurify` 清理 HTML 内容
- **CSP Header：** Nginx 配置 Content-Security-Policy

### 7.6 依赖安全更新

- **vite/esbuild：** 升级到最新稳定版，消除已知 CVE
- **定期审计：** `npm audit` + `pip audit` 纳入 CI

---

## 八、关键技术决策

### 8.1 Dashboard 拖拽库：react-grid-layout

**选型理由：**
- 成熟稳定（GitHub 19k+ Stars），React 生态中最流行的网格布局库
- 原生支持拖拽、缩放、响应式断点
- 与 React 18 + Ant Design 兼容良好
- API 简洁，布局数据结构简单（JSON 可序列化）
- 备选方案对比：
  - `dnd-kit` — 更底层，需自行实现网格逻辑，工作量太大
  - `react-beautiful-dnd` — 已停止维护，不推荐
  - `@hello-pangea/dnd` — dnd-kit fork，同上问题

### 8.2 React Flow 升级：react-flow-renderer → @xyflow/react

**理由：**
- `react-flow-renderer` 已停止维护（最后更新 2023）
- `@xyflow/react` 是官方继任者，API 兼容但有改进
- 支持更多自定义节点类型、更好的性能
- **迁移策略：** 更新 import 路径 + 调整少量 API 变更

```bash
npm uninstall react-flow-renderer
npm install @xyflow/react
# import { ReactFlow, Node, Edge } from '@xyflow/react'
```

### 8.3 @rjsf/core + Ant Design 主题集成

```bash
npm install @rjsf/core @rjsf/utils @rjsf/validator-ajv8 antd
```

```typescript
import Form from "@rjsf/core";
import { RJSFSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";

// Antd 主题 widgets（使用 @rjsf/antd 或自定义）
import { antdWidgets } from "./components/common/SchemaForm";

function AgentConfigForm({ schema, formData, onChange }) {
  return (
    <Form
      schema={schema}
      formData={formData}
      onChange={onChange}
      validator={validator}
      widgets={antdWidgets}
      liveValidate
    />
  );
}
```

### 8.4 WebSocket 方案

- **后端：** FastAPI 内置 `WebSocket`（无需额外库）
- **前端：** 原生 `WebSocket` API（无需 socket.io）
- **理由：** 系统只需简单的发布-订阅模式，不需要 socket.io 的房间/命名空间等高级功能
- **连接管理：** 前端自动重连 + 指数退避

### 8.5 文件存储方案

- **本次迭代：** 本地文件系统 `uploads/{year}/{month}/{day}/{uuid}.{ext}`
- **文件大小限制：** 10MB
- **文件类型白名单：** .md, .txt, .pdf, .docx, .json, .yaml, .py, .js, .ts, .png, .jpg, .gif
- **后续迭代：** 可迁移到对象存储（S3/MinIO），通过抽象 FileStorage 接口切换

---

## 九、开发分阶段规划

### Phase 0: 基础修复与环境准备（1-2天）

**交付物：**
- 修复 7 个已知 Bug
- 前端统一浅色主题
- 后端 Bridge 表增加 user_id（Alembic 迁移）
- Agent 表增加 bridge_id
- notification_channels 类型名统一 wecom
- 升级 react-flow-renderer → @xyflow/react

**验收标准：**
- 所有 Bug 修复，后台/前台浅色主题正常
- 数据库迁移成功，现有数据不受影响
- 前端编译无错误

### Phase 1: 安全认证改造（2-3天）

**交付物：**
- JWT 双Token 认证（Access + Refresh）
- httpOnly Cookie 存储 Refresh Token
- 前端 Token 自动刷新拦截器
- RBAC 权限中间件
- Token 撤销机制

**验收标准：**
- 登录/注册/刷新/登出流程正常
- Token 过期自动刷新，用户无感知
- admin/user 权限隔离正确
- 安全审计 3 项修复完成

### Phase 2: 核心 CRUD 功能（3-5天）

**交付物：**
- 项目管理 CRUD + 文档库 API + 前端页面
- Agent CRUD + Agent 类型管理 + 配置 Schema 表单
- Bridge 用户隔离 CRUD + 管理员全局视图
- 任务文件上传/下载 API
- @rjsf/core 集成

**验收标准：**
- 项目创建/编辑/删除正常，文档可上传下载
- Agent 创建时可选择 Bridge，配置根据 Schema 自动生成表单
- Bridge 用户隔离正确，管理员可看全部
- 任务文件可上传预览下载

### Phase 3: 任务中心重构（2-3天）

**交付物：**
- 三层级任务视图（项目→任务→Agent执行明细）
- 人工干预交互面板
- 批量操作
- 任务详情页增强（日志/文件/会话）

**验收标准：**
- 三层级数据正确展示
- 人工干预审批/驳回/修改意见流程完整
- 批量暂停/取消正常
- 任务详情页信息完整

### Phase 4: 通知系统（2天）

**交付物：**
- 6 通道适配器实现
- 通道配置表单（按类型动态渲染）
- 触发规则引擎
- 测试发送功能

**验收标准：**
- 6 个通道都能发送测试消息
- 通道配置按类型展示不同表单
- 任务状态变化触发通知

### Phase 5: 工作流引擎（5-7天）

**交付物：**
- Nexus Workflow Engine 核心（调度器+状态机）
- 7 种节点类型实现
- React Flow 可视化编辑器
- 模板库
- 执行监控 WebSocket 推送
- "生成流程"和"保存为模板"功能

**验收标准：**
- 可视化编辑器拖拽/连线/配置正常
- 工作流可执行，节点按顺序运行
- 条件分支、并行执行、人工干预正确
- WebSocket 实时推送状态更新
- 模板库可保存/加载/复用

### Phase 6: Dashboard 可定制化（2-3天）

**交付物：**
- react-grid-layout 集成
- 6 种统计卡片组件
- 布局方案 CRUD API
- 前后台 Dashboard 区分（个人/全局）

**验收标准：**
- 卡片可拖拽排列
- 布局方案可保存/切换
- admin 和 user 看到不同维度的数据

### Phase 7: 集成测试与打磨（2-3天）

**交付物：**
- 端到端测试（Playwright）
- UI 打磨（字体大小、间距、对齐）
- 性能优化
- 安全扫描

---

## 附录：不纳入本次迭代

1. oc-bridge 发布到 npm registry
2. 模型路由 / 成本预估
3. capabilities 标签用于任务匹配约束

## 附录：技术约束汇总

| 约束 | 说明 |
|------|------|
| Python 版本 | 服务器 3.11.6，CC开发环境 3.9 → 用 Optional[str] 不用 str \| None |
| 新增字段 | 必须 Optional（nullable=True），Alembic 迁移 |
| 前端主题 | 统一浅色，禁止纯黑背景 |
| API 响应 | `{ code: 0, data: ..., message: "..." }` |
| 数据库 | SQLite，单文件 data/nexus.db |
| 文件大小限制 | 10MB |
| Access Token 有效期 | 30分钟 |
| Refresh Token 有效期 | 7天 |
