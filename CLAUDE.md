# AI Agent Orchestration - 开发指南

## 项目概述

AI Agent 编排可视化工具，用于编排 Claude Code 的 Agent、创建开发工作流程、建立、追踪、管理开发任务。

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Python FastAPI
- **数据库**: SQLite

## 项目结构

```
agent-orchestration/
├── frontend/           # React 前端
│   ├── src/
│   │   ├── components/  # 组件
│   │   ├── pages/      # 页面
│   │   ├── api/        # API 调用
│   │   ├── hooks/      # React Hooks
│   │   ├── types/      # TypeScript 类型
│   │   └── styles/     # 样式
│   └── package.json
│
└── backend/          # FastAPI 后端
    ├── app/
    │   ├── routers/    # API 路由
    │   ├── models/     # Pydantic 模型
    │   ├── services/   # 业务逻辑
    │   └── utils/     # 工具函数
    └── requirements.txt
```

## 核心功能

### P0 - 必须实现

1. **可视化 Web 界面** - Agent 和任务管理
2. **Agent 编排** - 接入和管理 Claude Code Agent
3. **工作流创建** - 可视化创建开发工作流程
4. **任务追踪** - 任务进度、状态管理
5. **任务管理** - 创建、分配、执行、验收

### P1 - 重要

- Agent 状态监控（在线/离线/工作中）
- Agent 配置（模型、超时、技能）
- 工作流执行监控
- 断点续执
- 超时重试配置

### P2 - 可选

- Token 消耗统计
- Agent 性能统计
- 组织架构管理

---

## 开发规范

### 技能应用

1. 前端要使用frontend-design
2. 完成后上传github，系统gh cli已授权，自己创建仓库并提交。

### 代码规范

1. **TypeScript**
   - 启用 strict 模式
   - 使用 `interface` 而非 `type` 定义对象类型
   - 组件使用函数式组件 + Hooks
   - 避免使用 `any`，使用 `unknown` 代替

2. **Python (FastAPI)**
   - 使用 Pydantic v2 定义模型
   - 路由函数使用 async/await
   - 错误处理使用 HTTPException
   - 日志使用标准 logging 模块

3. **Git 提交规范**
   - feat: 新功能
   - fix: Bug 修复
   - docs: 文档更新
   - refactor: 代码重构
   - chore: 构建/工具更新

### API 设计规范

1. **RESTful 风格**
   - GET /api/resources - 获取列表
   - POST /api/resources - 创建资源
   - GET /api/resources/{id} - 获取单个
   - PUT /api/resources/{id} - 更新
   - DELETE /api/resources/{id} - 删除

2. **响应格式**
   ```json
   {
     "success": true,
     "data": {},
     "message": "操作成功"
   }
   ```

3. **错误响应**
   ```json
   {
     "success": false,
     "error": {
       "code": "ERROR_CODE",
       "message": "错误描述"
     }
   }
   ```

### 安全规范

1. **认证授权**
   - API 使用 Token 认证
   - 敏感操作需要验证权限
   - 禁止明文存储密码

2. **输入验证**
   - 所有用户输入必须验证
   - 使用白名单验证策略
   - 防止 SQL 注入

3. **日志记录**
   - 记录关键操作日志
   - 记录错误堆栈信息
   - 避免记录敏感信息

### 测试规范

1. **单元测试**
   - 覆盖率目标: 70%+
   - 测试文件放在 `__tests__` 目录
   - 使用 pytest (后端) / Vitest (前端)

2. **集成测试**
   - 测试 API 端点
   - 测试数据库操作
   - 使用测试数据库

### 部署规范

1. **环境变量**
   - 使用 `.env` 文件管理本地配置
   - 生产环境使用环境变量
   - 敏感信息不能提交到代码库

2. **Docker**
   - 使用多阶段构建减小镜像体积
   - 非 root 用户运行
   - 健康检查配置

---

## 开发指南

### 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 运行测试

```bash
# 后端
cd backend
pytest --cov=app

# 前端
cd frontend
npm test
```

### 构建生产版本

```bash
# 前端
cd frontend
npm run build

# 后端
cd backend
pip install -r requirements.txt
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

---

## API 端点

### Agent 管理
- `GET /api/agents` - 获取 Agent 列表
- `POST /api/agents` - 注册 Agent
- `GET /api/agents/{id}` - 获取 Agent 详情
- `PUT /api/agents/{id}` - 更新 Agent
- `DELETE /api/agents/{id}` - 删除 Agent

### 任务管理
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建任务
- `GET /api/tasks/{id}` - 获取任务详情
- `PUT /api/tasks/{id}` - 更新任务
- `DELETE /api/tasks/{id}` - 删除任务

### 工作流管理
- `GET /api/workflows` - 获取工作流列表
- `POST /api/workflows` - 创建工作流
- `GET /api/workflows/{id}` - 获取工作流详情
- `POST /api/workflows/{id}/execute` - 执行工作流
- `DELETE /api/workflows/{id}` - 删除工作流

---

## 参考

- 需求文档: `agent-orchestration-requirements.md`
- 架构文档: `agent-orchestration-architecture.md`
- 后续开发计划：`agent-orchestration-v2-plan`
