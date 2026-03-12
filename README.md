# AI Agent 编排可视化工具

一个用于编排 Claude Code Agent、创建开发工作流程、管理开发任务的可视化工具。

## 功能特性

### 核心功能 (P0)
- ✅ **可视化 Web 界面** - Agent 和任务管理
- ✅ **Agent 编排** - 接入和管理 Claude Code Agent
- ✅ **工作流创建** - 可视化创建开发工作流程
- ✅ **任务追踪** - 任务进度、状态管理
- ✅ **任务管理** - 创建、分配、执行、验收

### 重要功能 (P1)
- ✅ **Agent 状态监控**（在线/离线/工作中）
- ✅ **Agent 配置**（模型、超时、技能）
- ✅ **工作流执行监控**
- ✅ **Lobster 工作流引擎集成**
- ✅ **成本控制**（Token 统计、预算告警）

### 可选功能 (P2)
- 🔄 多 Agent 角色定义
- 🔄 组织架构管理
- 🔄 GitHub 集成

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Python FastAPI
- **数据库**: SQLite (可扩展至 PostgreSQL)
- **工作流引擎**: Lobster

## 快速开始

### 方法一：使用启动脚本（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd agent-orchestration

# 运行启动脚本
./start.sh
```

### 方法二：手动启动

#### 后端启动

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --port 8080
```

#### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 访问应用

- **前端界面**: http://localhost:3000
- **后端API**: http://localhost:8080
- **API文档**: http://localhost:8080/docs

## 项目结构

```
agent-orchestration/
├── backend/               # Python FastAPI 后端
│   ├── app/
│   │   ├── models/        # 数据模型
│   │   ├── routers/       # API 路由
│   │   ├── services/      # 业务逻辑
│   │   └── utils/         # 工具函数
│   ├── tests/             # 测试文件
│   └── requirements.txt   # Python 依赖
├── frontend/              # React 前端
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── pages/         # 页面
│   │   ├── api/           # API 调用
│   │   ├── hooks/         # React Hooks
│   │   ├── stores/        # 状态管理
│   │   ├── styles/        # 样式
│   │   └── types/         # TypeScript 类型
│   ├── package.json       # Node.js 依赖
│   └── vite.config.ts     # Vite 配置
├── Dockerfile            # Docker 镜像构建文件
├── docker-compose.yml    # Docker Compose 配置
└── start.sh              # 启动脚本
```

## API 接口

### Agent 管理
- `GET /api/agents` - 获取 Agent 列表
- `POST /api/agents` - 创建 Agent
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

### 成本控制
- `GET /api/cost/report` - 获取成本报告
- `POST /api/cost/budgets` - 创建预算配置
- `GET /api/cost/alerts` - 获取成本告警
- `POST /api/cost/record` - 记录成本

## 工作流引擎

### Lobster 引擎
- 支持 typed JSON pipeline
- 支持审批门禁
- 适合确定性流程

### 扩展性
- 支持多工作流引擎
- 可插拔的引擎适配器
- 引擎注册表管理

## 成本控制

- 自动记录 Token 消耗
- 多维度成本统计
- 预算告警机制
- 自定义价格配置

## 开发指南

### 添加新的工作流引擎

1. 在 `app/services/` 创建引擎适配器
2. 实现 `WorkflowEngine` 接口
3. 在 `workflow_engine_registry.py` 注册引擎
4. 更新工作流模型支持新引擎

### 添加新的数据模型

1. 在 `app/models/` 创建模型文件
2. 使用 Pydantic 定义模型
3. 在 `app/services/` 创建对应的数据库服务
4. 在 `app/routers/` 添加 API 路由

### 添加新的前端页面

1. 在 `src/pages/` 创建页面组件
2. 添加路由配置
3. 更新导航菜单

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t agent-orchestrator .

# 运行容器
docker run -p 8080:8080 agent-orchestrator

# 使用 Docker Compose
docker-compose up -d
```

### 生产环境部署

1. 配置环境变量
2. 使用 PostgreSQL 数据库
3. 启用 HTTPS
4. 配置反向代理

## 测试

```bash
# 后端测试
cd backend
pytest --cov=app

# 前端测试
cd frontend
npm test
```

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 创建 Pull Request

## 许可证

MIT License

## 更新日志

### v1.0.0 (2026-03-12)
- 初始版本发布
- 基础 Agent 管理
- 任务管理系统
- 工作流编辑器
- Lobster 引擎集成
- 成本控制模块