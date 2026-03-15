# 开发提示词总览

> 基于 `docs/architecture-v3.md` 架构设计文档，按 Phase 分前后端生成开发提示词。
> 每个提示词文件独立可用，包含该任务所需的全部上下文，不依赖其他提示词文件。

## 提示词文件清单

| 文件 | Phase | 方向 | 任务 |
|------|-------|------|------|
| `phase0-frontend-fixes.md` | 0 | 前端 | 7个Bug修复 + 浅色主题 |
| `phase0-backend-migration.md` | 0 | 后端 | Alembic迁移 + 表结构调整 |
| `phase1-backend-auth.md` | 1 | 后端 | JWT双Token认证 + RBAC |
| `phase1-frontend-auth.md` | 1 | 前端 | Token拦截器 + 权限守卫 |
| `phase2-backend-crud.md` | 2 | 后端 | 项目/Agent/Bridge/文件 CRUD API |
| `phase2-frontend-crud.md` | 2 | 前端 | 项目中心/代理中心/Bridge管理页面 |
| `phase3-frontend-tasks.md` | 3 | 前端 | 任务中心三层级重构 + 人工干预 |
| `phase3-backend-tasks.md` | 3 | 后端 | 任务树查询 + 人工干预 API |
| `phase4-backend-notification.md` | 4 | 后端 | 6通道适配器 + 触发规则引擎 |
| `phase4-frontend-notification.md` | 4 | 前端 | 通知配置动态表单 |
| `phase5-backend-workflow.md` | 5 | 后端 | Nexus工作流引擎核心 |
| `phase5-frontend-workflow.md` | 5 | 前端 | React Flow编辑器 + 执行监控 |
| `phase6-frontend-dashboard.md` | 6 | 前端 | Dashboard可定制化 + 统计API对接 |

## 使用方式

1. 按 Phase 顺序执行，每个 Phase 先后端再前端
2. 将对应 `.md` 文件内容作为 programmer agent 的任务描述
3. programmer 完成后交由 tester agent 测试
4. 测试通过后进入下一个提示词

## 上下文控制策略

- 每个提示词聚焦单一任务，不包含无关上下文
- 代码引用只给文件路径和关键片段，不内联完整文件
- 依赖架构文档时用"参见 architecture-v3.md 第X章"引用
- 每个提示词包含：任务目标、文件清单、接口定义、约束条件、验收标准
