# Nexus — AI Agent 编排平台 文档索引

> **GitHub**: `liuh82/agent-orchestration` (private)
> **当前版本**: 迭代三完成（2026-03-18）
> **技术栈**: FastAPI + React + TypeScript + SQLite + Redis
> **部署**: 服务器端（宝塔+Nginx），前端静态构建

---

## 📁 文档结构

### 需求文档
| 文件 | 说明 |
|------|------|
| `requirements-v1.3.md` | 需求 v1.3 |
| `requirements-v2.md` | 需求 v2 |
| `requirements-v3-confirmation.md` | 需求 v3 确认 |

### 架构设计
| 文件 | 说明 |
|------|------|
| `architecture-v1.md` | 架构 v1 |
| `architecture-v3.md` | 架构 v3 |
| `architecture-v4.md` | 架构 v4（当前） |
| `architecture-design-task.md` | 架构设计任务 |
| `claude-code-desktop-architecture.md` | Claude Code Desktop 架构（独立项目） |

### 迭代一（基础架构）
| 文件 | 说明 |
|------|------|
| `frontend-r1-infrastructure.md` | 前端基础设施 |
| `frontend-r2-auth-layout.md` | 前端认证+布局 |
| `frontend-r3-core-pages.md` | 前端核心页面 |
| `frontend-r4-settings-admin.md` | 前端设置+管理 |
| `backend-r1-infrastructure.md` | 后端基础设施 |
| `backend-r2-auth.md` | 后端认证 |
| `backend-r3-business.md` | 后端业务逻辑 |
| `backend-r4-admin-config.md` | 后端管理+配置 |

### 迭代一 开发 Prompt（v1）
| 文件 | 说明 |
|------|------|
| `dev-tasks-fix-admin-agent-redirect.md` | 修复管理员 Agent 重定向 |
| `dev-tasks-fix-agent-list-redirect.md` | 修复 Agent 列表重定向 |
| `dev-tasks-fix-all-issues.md` | 修复所有问题 |
| `dev-tasks-fix-api-paths.md` | 修复 API 路径 |
| `dev-tasks-fix-backend-500s.md` | 修复后端 500 错误 |
| `dev-tasks-fix-create-task.md` | 修复任务创建 |
| `dev-tasks-fix-db.md` | 修复数据库 |
| `dev-tasks-fix-orm-startup.md` | 修复 ORM 启动 |
| `dev-tasks-fix-statusbadge-crash.md` | 修复状态徽章崩溃 |
| `dev-tasks-playwright-run.md` | Playwright 测试 |
| `dev-tasks-v5-backend.md` | V5 后端开发 |
| `dev-tasks-v5-e2e-test.md` | V5 端到端测试 |
| `dev-tasks-v5-frontend.md` | V5 前端开发 |
| `dev-tasks-v5-review-fixes.md` | V5 评审修复 |

### 迭代二（T1-T10）
| 文件 | 说明 |
|------|------|
| `dev-prompts/phase0-backend-migration.md` | P0 数据库迁移 |
| `dev-prompts/phase0-frontend-fixes.md` | P0 前端修复 |
| `dev-prompts/phase0-test.md` | P0 测试 |
| `dev-prompts/phase1-backend-auth.md` | T1 后端认证 |
| `dev-prompts/phase1-frontend-auth.md` | T1 前端认证 |
| `dev-prompts/phase2-backend-crud.md` | T2 后端 CRUD |
| `dev-prompts/phase2-frontend-crud.md` | T2 前端 CRUD |
| `dev-prompts/phase3-backend-tasks.md` | T3 后端任务 |
| `dev-prompts/phase3-frontend-tasks.md` | T3 前端任务 |
| `dev-prompts/phase4-backend-notification.md` | T4 后端通知 |
| `dev-prompts/phase4-frontend-notification.md` | T4 前端通知 |
| `dev-prompts/phase5-backend-workflow.md` | T5 后端工作流 |
| `dev-prompts/phase5-frontend-workflow.md` | T5 前端工作流 |
| `dev-prompts/phase6-frontend-dashboard.md` | T6 前端 Dashboard |
| `dev-prompts/README.md` | dev-prompts 索引 |
| `dev-prompts/security-fix-command-injection.md` | 命令注入修复 |

### 迭代三（工作流改造 + oc-bridge + 安全审计）
| 文件 | 说明 |
|------|------|
| `dev-prompts/v2/iteration3-plan.md` | 迭代三计划 |
| `dev-prompts/v2/task-t1-architecture.md` | T1 架构 |
| `dev-prompts/v2/task-t2-db-migration.md` | T2 数据库 |
| `dev-prompts/v2/task-t3-admin-fixes.md` | T3 管理修复 |
| `dev-prompts/v2/task-t4-dashboard.md` | T4 Dashboard |
| `dev-prompts/v2/task-t5-notification.md` | T5 通知 |
| `dev-prompts/v2/task-t6-gateway-bridge.md` | T6 Gateway Bridge |
| `dev-prompts/v2/task-t8-workflow-editor.md` | T8 工作流编辑器 |
| `dev-prompts/v2/task-t8-ui-polish.md` | T8 UI 精化 |
| `dev-prompts/v2/task-t9-workflow-engine.md` | T9 工作流引擎 |
| `dev-prompts/v2/task-t10-task-instance.md` | T10 任务实例化 |
| `dev-prompts/v2/workflow-node-redesign.md` | 工作流节点改造方案 |
| `dev-prompts/v2/workflow-review-result.md` | 改造方案评审结果 |
| `dev-prompts/v2/review-workflow-redesign.md` | 评审 prompt |
| `dev-prompts/v3/workflow-p0-fixes.md` | P0 修复 prompt |
| `dev-prompts/v3/workflow-integration.md` | T2.1 集成验证 |
| `dev-prompts/v3/workflow-frontend-adapter.md` | T2.2 前端适配 |
| `dev-prompts/v3/security-fixes.md` | 安全审计修复 |
| `dev-prompts/v3/workflow-p1-enhancements.md` | P1 增强 |
| `dev-prompts/v3/oc-bridge-stage2.md` | oc-bridge 阶段2 |
| `dev-prompts/v3/oc-bridge-stage3.md` | oc-bridge 阶段3 |

### 其他文档
| 文件 | 说明 |
|------|------|
| `CLAUDE-CODE-GUIDE.md` | Claude Code 执行指南 |
| `NEW_CLAUDE.md` | 新版 CLAUDE.md |
| `workflow-schema.md` | 工作流 schema 定义 |
| `workflow-tutorial.md` | 工作流教程 |
| `cc-fix-prompts-v2.md` | 修复 prompt v2 |
| `test-report-full.md` | 完整测试报告 |
| `superpowers/` | Agent 超能力文档 |

---

## 🔑 关键代码路径

### 后端
```
backend/
├── main.py                          # 入口
├── app/
│   ├── database.py                  # 数据库（SQLite + 自动迁移）
│   ├── models/                      # ORM 模型
│   ├── routers/                     # API 路由
│   │   ├── gateway.py               # Gateway WebSocket 端点
│   │   └── workflows.py             # 工作流 CRUD
│   └── services/
│       ├── workflow_engine/
│       │   ├── engine.py            # 执行引擎（核心）
│       │   ├── variable_resolver.py # 变量解析（含 outputAlias）
│       │   ├── registry.py          # 节点注册表
│       │   └── nodes/               # 节点实现
│       │       ├── input.py         # 输入节点
│       │       ├── agent.py         # Agent 节点（含 Git 集成）
│       │       ├── fork.py          # Fork 分发节点
│       │       ├── join.py          # Join 等待节点
│       │       ├── context_output.py # 上下文输出
│       │       ├── result_output.py # 结果输出
│       │       └── code_node.py     # 代码执行（沙箱）
│       └── gateway/
│           ├── ws_server.py         # WebSocket 服务器
│           ├── bridge_manager.py    # Bridge 连接管理
│           ├── task_router.py       # 任务路由
│           └── db_gateway.py        # 数据库 Gateway
├── bridges/oc-bridge/               # oc-bridge 客户端
│   └── src/
│       ├── agent/claude-code.ts     # Claude Code 调用
│       ├── task/task-manager.ts     # 任务管理
│       ├── websocket/connection.ts  # WebSocket 连接
│       ├── utils/retry.ts           # 断线重连
│       └── storage/state.ts         # 状态持久化
└── data/nexus.db                    # SQLite 数据库
```

### 前端
```
frontend/
├── src/
│   ├── types/workflow.ts            # 类型定义（含 NODE_META）
│   ├── stores/useWorkflowStore.ts   # 工作流状态管理
│   ├── components/workflow/
│   │   ├── NodeConfigPanel.tsx      # 节点配置面板（2049行）
│   │   ├── BaseNode.tsx             # 基础节点渲染
│   │   └── nodes/                   # 节点组件
│   │       ├── InputNode.tsx
│   │       ├── AgentNode.tsx
│   │       ├── ForkNode.tsx
│   │       ├── JoinNode.tsx
│   │       ├── ContextOutputNode.tsx
│   │       └── ResultOutputNode.tsx
│   └── pages/workflows/
│       └── WorkflowEditorPage.tsx   # 工作流编辑器页面
└── dist/                            # 构建产物（nginx 静态服务）
```

---

## 🚀 运维命令

```bash
# 后端启动
cd /root/.openclaw/workspace/agent-orchestration/backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8082

# 前端构建
cd frontend && npm run build

# oc-bridge 启动
cd bridges/oc-bridge && npx tsx src/cli/start.ts

# Claude Code 路径
/root/.nvm/versions/node/v22.22.0/bin/claude

# 数据库备份
cp data/nexus.db data/nexus.db.bak

# 日志
tail -f /tmp/nexus-backend.log
tail -f /tmp/oc-bridge.log
```

---

## 📊 迭代历史

| 迭代 | 时间 | 内容 | 状态 |
|------|------|------|------|
| 一 | 2026-03 初 | 基础架构（V1→V2→V3） | ✅ 完成 |
| 二 | 2026-03 中 | T1-T10 全部完成 | ✅ 完成 |
| 三 | 2026-03-18 | oc-bridge + 工作流改造 + 安全审计 | ✅ 完成 |

---

*最后更新：2026-03-18*
