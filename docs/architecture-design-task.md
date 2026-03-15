# Nexus V3 架构设计任务书

## 任务目标
基于 `docs/requirements-v3-confirmation.md` 需求确认书，输出完整详尽的架构设计文档。

## 项目上下文

### 技术栈
- **后端：** Python 3.11.6 + FastAPI + SQLAlchemy 2.0 + SQLite (data/nexus.db, 31张表)
- **前端：** React 18 + TypeScript + Ant Design 5 + styled-components + zustand + react-query + react-router-dom 6
- **工作流编辑器：** react-flow-renderer（已有依赖，但需升级为 reactflow）
- **表单生成：** @rjsf/core（待引入）
- **通信：** WebSocket（Gateway/工作流监控）、REST API（CRUD）
- **部署：** Nginx 反向代理，后端 uvicorn :8082，前端 Vite dev :5174

### 现有代码结构

**后端路由（backend/main.py）：**
- Legacy: /api/agents, /api/tasks, /api/workflows, /api/cost, /api/org, /api/heartbeats, /api/gateway
- V1 业务: /api/v1/agents, /api/v1/agent-types, /api/v1/projects, /api/v1/tasks, /api/v1/jobs
- V1 管理: /api/v1/admin, /api/v1/admin/settings, /api/v1/notifications, /api/v1/stats
- 兼容层: /api/* → /api/v1/* 的重复注册

**现有 ORM 模型（31张表）：**
- agents, agent_logs, task_assignments, tasks（核心业务表）
- gateway_bridges, gateway_tasks（Bridge/Gateway 表）
- projects（项目表，已有 user_id, name, description, spec, workflow_id, status, 统计字段）
- notification_channels（通知通道表）
- system_settings（系统设置 key-value 表）
- workflows, workflow_templates（工作流定义和模板表）
- users（用户认证表）
- budgets, cost_alerts, daily_costs, cost_entries（成本相关）
- heartbeats, heartbeat_logs（心跳调度）
- roles, members, departments, org_chart_nodes（组织架构）
- goals, goal_alignments（目标管理）
- approvals, approval_history（审批流）
- audit_logs（审计日志）

**前端目录结构：**
```
frontend/src/
├── api/           # API 客户端
├── components/
│   ├── Auth/      # 认证组件
│   ├── Layout/    # MainLayout, AdminLayout
│   └── common/    # StatusBadge 等通用组件
├── pages/
│   ├── admin/     # 后台页面
│   ├── agents/    # Agent CRUD
│   ├── auth/      # 登录注册
│   ├── dashboard/ # Dashboard
│   ├── projects/  # 项目管理
│   ├── settings/  # 设置
│   └── tasks/     # 任务管理
├── stores/        # zustand 状态管理
├── styles/tokens/ # 设计令牌
├── types/         # TypeScript 类型
├── config/        # 配置
└── utils/         # 工具函数
```

### 数据库连接
- SQLite, 文件: data/nexus.db
- SQLAlchemy 2.0 Mapped 声明式
- 迁移工具: Alembic（新增字段必须 Optional 向后兼容）

### API 响应格式
```json
{ "code": 0, "data": ..., "message": "..." }
```

### 现有前端主题
- 后台 AdminLayout: 浅色主题（header #334155, content 需改为 #f5f5f5）
- 前台 MainLayout: 当前背景色 rgb(10,10,10) 纯黑（需改为浅色）
- 统一浅色主题，禁止纯黑背景

### Python 版本兼容性
- 服务器: Python 3.11.6
- CC 开发环境: Python 3.9
- 需注意语法兼容（如 `str | None` 在 3.9 不支持，需用 `Optional[str]`）

---

## 架构设计要求

### 1. 整体架构
- 清晰的前后端分层架构图（文字描述）
- 模块划分和职责边界
- 前后端 API 契约设计
- 数据流和状态管理方案

### 2. 数据库设计
- **新增表设计：** 项目文档表、Agent配置文件表、任务文件表、人工干预决策表、工作流执行实例表、工作流节点执行记录表、Dashboard布局方案表
- **现有表修改：**
  - gateway_bridges 增加 user_id 字段（归属隔离）
  - agents 表 bridge_url 改为 bridge_id 关联
  - tasks 表确认 workflow_id 字段（已有 Optional[str]）
  - notification_channels config 字段扩展为支持各通道独立配置字段
- **每个表需要：** 表名、字段名、类型、约束、索引、关系说明
- **Alembic 迁移策略：** 所有新增字段 Optional

### 3. 后端 API 设计
按模块列出所有 API 端点，每个端点包含：
- HTTP 方法 + 路径
- 请求参数/Body
- 响应格式
- 权限要求（admin/user/owner）
- 备注

需要覆盖的模块：
- 认证（JWT 双Token：Access 30min + Refresh 7d）
- 用户管理（CRUD、禁用、角色分配）
- 项目管理（CRUD、文档库、Agent配置文件、任务文件）
- 任务管理（三层级查询、人工干预、批量操作）
- Agent 管理（CRUD + 类型管理 + 配置Schema）
- Gateway/Bridge 管理（用户隔离 CRUD + 管理员全局视图）
- 工作流引擎（定义CRUD、模板、节点注册、执行、监控）
- 通知通道（6通道配置、发送、触发规则）
- Dashboard 统计（指标聚合 API、布局方案 CRUD）
- 系统设置
- 文件上传/下载

### 4. 前端架构
- **路由设计：** 所有页面路由和权限守卫
- **状态管理方案：** zustand store 划分
- **组件架构：** 页面级组件、业务组件、通用组件层次
- **API 层设计：** 请求封装、错误处理、Token 刷新拦截器
- **Dashboard 可定制化方案：** 拖拽布局库选型、数据持久化

### 5. 工作流引擎设计（Nexus Workflow Engine）
- **引擎架构：** 调度器、节点执行器、状态机
- **节点注册机制：** 插件式节点类型注册、schema 版本化
- **执行模型：** 顺序执行、条件分支、并行执行、人工干预暂停
- **状态管理：** 工作流实例状态、节点执行状态
- **WebSocket 推送方案：** 实时状态更新、日志流
- **与任务系统集成：** 工作流触发任务、任务反馈到工作流

### 6. 通知系统设计
- **通道适配器模式：** 统一接口，各通道独立实现
- **6个通道的具体实现方案：** 飞书/钉钉/企业微信/Slack/Discord/邮件
- **触发规则引擎：** 事件驱动，绑定任务状态变化
- **模板系统：** 通知内容模板化

### 7. 安全设计
- JWT 双Token 认证流程（Access + Refresh）
- Token 存储（httpOnly cookie 方案）
- RBAC 权限模型（admin/user 角色）
- 输入校验和命令注入防护
- XSS 防护策略
- 依赖安全更新方案

### 8. 关键技术决策
- Dashboard 拖拽库选型（对比 dnd-kit / react-beautiful-dnd / grid-layout 等）
- react-flow-renderer 升级为 @xyflow/react 的迁移策略
- @rjsf/core + antd 主题集成方案
- WebSocket 库选型（后端 fastapi WebSocket / 前端原生或 socket.io-client）
- 文件存储方案（本地文件系统 / 对象存储）

### 9. 开发分阶段规划
- 按依赖关系拆分为可独立交付的阶段
- 每个阶段的具体交付物和验收标准
- Bug修复安排（7个已知Bug的修复时机）
- 建议的阶段划分（如：基础修复 → 认证安全 → 核心 CRUD → 工作流引擎 → 高级功能）

---

## 输出要求

1. **输出文件路径：** `docs/architecture-v3.md`
2. **格式：** Markdown，结构清晰，层次分明
3. **详尽程度：** 每个设计决策都要说明原因，每个 API 都有完整定义
4. **约束清晰：** 明确标注技术约束、兼容性要求、不做什么
5. **边界清晰：** 哪些是本次迭代范围，哪些明确排除
6. **可直接执行：** 程序员拿到文档后可以直接开始编码，不需要再问架构问题

## 约束与规则
- 新增 DB 字段必须 Optional（向后兼容）
- Python 语法兼容 3.9（用 Optional[str] 不用 str | None）
- 前端统一浅色主题
- API 响应格式统一 `{ code: 0, data: ..., message: "..." }`
- 测试工作交给 tester agent 执行
- 功能实现走迭代优化流程，助手不得直接开发
