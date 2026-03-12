# AI Agent Orchestration 完整开发方案 (v2.0)

> 基于 agent-orchestration 项目现状 + Paperclip 功能对比
> 日期：2026-03-12

---

## 一、架构设计

### 1.1 核心架构（宏观）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         前端层 (React + TypeScript)                     │
│   Dashboard │ Agents │ Tasks │ Workflows │ Costs │ Settings              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       API Gateway (FastAPI)                            │
│   认证 │ 限流 │ 日志 │ 路由                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  Agent      │          │  Task       │          │  Workflow   │
│  Service    │          │  Service    │          │  Service    │
└──────────────┘          └──────────────┘          └──────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         数据层 (SQLite)                              │
│   agents │ tasks │ workflows │ costs │ logs │ org_chart               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design |
| 后端 | Python FastAPI + Pydantic v2 |
| 数据库 | SQLite (可扩展 PostgreSQL) + SQLAlchemy 2.0 |
| 状态管理 | Zustand + React Query |
| 工作流引擎 | Lobster Engine (可插拔) |

---

## 二、完整功能清单

### 2.1 Agent 管理模块（核心功能）

| 序号 | 接口 | 方法 | 功能描述 | 状态 |
|------|------|------|----------|------|
| 1 | /api/agents | GET | 获取Agent列表 | ✅ 已实现 |
| 2 | /api/agents | POST | 创建Agent | ✅ 已实现 |
| 3 | /api/agents/{id} | GET | 获取单个Agent详情 | ✅ 已实现 |
| 4 | /api/agents/{id} | PUT | 更新Agent | ✅ 已实现 |
| 5 | /api/agents/{id} | DELETE | 删除Agent | ✅ 已实现 |
| 6 | /api/agents/{id}/start | POST | 启动Agent | ✅ Phase1已完成 |
| 7 | /api/agents/{id}/stop | POST | 停止Agent | ✅ Phase1已完成 |
| 8 | /api/agents/{id}/logs | GET | 获取Agent运行日志 | ✅ Phase1已完成 |
| 9 | /api/agents/{id}/stats | GET | 获取Agent性能统计 | ✅ Phase1已完成 |
| 10 | /api/agents/{id}/heartbeat | POST | Agent心跳 | 🔲 未实现 |

### 2.2 Task 管理模块（核心功能）

| 序号 | 接口 | 方法 | 功能描述 | 状态 |
|------|------|------|----------|------|
| 1 | /api/tasks | GET | 获取任务列表(支持分页) | ✅ 已实现 |
| 2 | /api/tasks | POST | 创建任务 | ✅ 已实现 |
| 3 | /api/tasks/{id} | GET | 获取任务详情 | ✅ 已实现 |
| 4 | /api/tasks/{id} | PUT | 更新任务 | ✅ 已实现 |
| 5 | /api/tasks/{id} | DELETE | 删除任务 | ✅ 已实现 |
| 6 | /api/tasks/{id}/execute | POST | 执行任务 | ✅ 已实现 |
| 7 | /api/tasks/{id}/pause | POST | 暂停任务 | ✅ 已实现 |
| 8 | /api/tasks/{id}/resume | POST | 恢复任务 | ✅ 已实现 |
| 9 | /api/tasks/{id}/logs | GET | 获取任务日志 | 🔲 未实现 |
| 10 | /api/tasks/{id}/assign | POST | 分配任务给Agent | ✅ Phase1已完成 |

### 2.3 Workflow 管理模块（核心功能）

| 序号 | 接口 | 方法 | 功能描述 | 状态 |
|------|------|------|----------|------|
| 1 | /api/workflows | GET | 获取工作流列表 | ✅ 已实现 |
| 2 | /api/workflows | POST | 创建工作流 | ✅ 已实现 |
| 3 | /api/workflows/{id} | GET | 获取工作流详情 | ✅ 已实现 |
| 4 | /api/workflows/{id} | PUT | 更新工作流 | ✅ 已实现 |
| 5 | /api/workflows/{id} | DELETE | 删除工作流 | ✅ 已实现 |
| 6 | /api/workflows/{id}/execute | POST | 执行工作流 | ✅ 已实现 |
| 7 | /api/workflows/status/{exec_id} | GET | 获取执行状态 | ✅ 已实现 |
| 8 | /api/workflows/logs/{exec_id} | GET | 获取执行日志 | ✅ 已实现 |
| 9 | /api/workflows/templates | GET | 获取工作流模板 | ✅ 已实现 |
| 10 | /api/workflows/visual-editor | GET | 可视化编辑器数据 | 🔲 未实现 |

### 2.4 Cost 成本控制模块（扩展功能）

| 序号 | 接口 | 方法 | 功能描述 | 状态 |
|------|------|------|----------|------|
| 1 | /api/costs | GET | 获取成本列表 | ✅ 已实现 |
| 2 | /api/costs/summary | GET | 获取成本汇总 | ✅ 已实现 |
| 3 | /api/costs/by-agent | GET | 按Agent统计成本 | ✅ Phase1已完成 |
| 4 | /api/costs/by-period | GET | 按时间段统计 | 🔲 未实现 |
| 5 | /api/costs/budget | GET/POST | 预算设置 | ✅ Phase1已完成 |
| 6 | /api/costs/alert | POST | 超预算告警 | ✅ Phase1已完成 |

### 2.5 Org 组织架构模块（Paperclip核心功能）

| 序号 | 接口 | 方法 | 功能描述 | 状态 |
|------|------|------|----------|------|
| 1 | /api/org/chart | GET | 获取组织架构图 | 🔲 未实现 |
| 2 | /api/org/roles | GET | 获取角色列表 | 🔲 未实现 |
| 3 | /api/org/roles | POST | 创建角色 | 🔲 未实现 |
| 4 | /api/org/members | GET | 获取成员列表 | 🔲 未实现 |
| 5 | /api/org/members | POST | 添加成员 | 🔲 未实现 |
| 6 | /api/goals | GET | 获取目标列表 | 🔲 未实现 |
| 7 | /api/goals | POST | 创建目标 | 🔲 未实现 |
| 8 | /api/goals/align | POST | 目标对齐 | 🔲 未实现 |

### 2.6 Governance 治理模块（Paperclip核心功能）

| 序号 | 接口 | 方法 | 功能描述 | 状态 |
|------|------|------|----------|------|
| 1 | /api/approvals | GET | 待审批列表 | 🔲 未实现 |
| 2 | /api/approvals/{id} | POST | 审批操作 | 🔲 未实现 |
| 3 | /api/approvals/history | GET | 审批历史 | 🔲 未实现 |
| 4 | /api/audit/logs | GET | 审计日志 | 🔲 未实现 |

### 2.7 Heartbeat 心跳模块（Paperclip核心功能）

| 序号 | 接口 | 方法 | 功能描述 | 状态 |
|------|------|------|----------|------|
| 1 | /api/heartbeats | GET | 获取心跳配置 | 🔲 未实现 |
| 2 | /api/heartbeats | POST | 创建心跳任务 | 🔲 未实现 |
| 3 | /api/heartbeats/{id} | PUT | 更新心跳配置 | 🔲 未实现 |
| 4 | /api/heartbeats/{id}/disable | POST | 禁用心跳 | 🔲 未实现 |

---

## 三、Paperclip 核心功能对比

| Paperclip功能 | agent-orchestration状态 | 优先级 |
|---------------|----------------------|--------|
| ✅ Bring Your Own Agent | ✅ Phase1已完成 | P0 |
| ✅ Goal Alignment | 🔲 未实现 | P1 |
| ✅ Heartbeats | 🔲 未实现 | P1 |
| ✅ Cost Control | ✅ Phase1已完成 | P0 |
| ✅ Multi-Company | 🔲 未实现 | P2 |
| ✅ Ticket System | ⚠️ 基础实现 | P0 |
| ✅ Governance | 🔲 未实现 | P1 |
| ✅ Org Chart | 🔲 未实现 | P1 |
| ✅ Mobile Ready | 🔲 未实现 | P2 |

---

## 四、后续开发计划

### Phase 1: 完善核心功能 (P0) ✅ 已完成

1. **Agent管理增强**
   - 实现Agent启动/停止 ✅
   - 添加Agent日志查看 ✅
   - 添加Agent性能统计 ✅

2. **Task管理增强**
   - 任务分配给Agent ✅

3. **Cost成本控制**
   - 按Agent统计成本 ✅
   - 预算设置 ✅
   - 超预算告警 ✅

### Phase 2: 组织架构 (P1)

4. **Org Chart**
   - 组织架构图
   - 角色管理
   - 成员管理

5. **Goal Alignment**
   - 目标创建
   - 目标对齐

6. **Governance**
   - 审批流程
   - 审计日志

### Phase 3: 自动化 (P1)

7. **Heartbeats**
   - 定时任务配置
   - 自动执行

### Phase 4: 扩展功能 (P2)

8. **Multi-Company**
   - 多公司数据隔离
   - 公司切换

9. **Mobile适配**
   - 响应式UI
   - 移动端优化

---

## 五、技术优化项

### 5.1 数据库层优化

**问题**：当前代码中存在大量硬编码 SQL 语句，耦合度高，难以维护

**解决方案**：采用 SQLAlchemy 2.0 + 独立 SQL 模板

| 方案 | 优点 | 缺点 |
|------|------|------|
| ORM (SQLAlchemy) | 自动建表、迁移、类型安全 | 学习曲线、灵活度略降 |
| 独立 .sql 文件 | SQL 可读、可复用 | 需手动管理参数 |
| **混合方案** | 保留灵活性的同时减少硬编码 | 复杂度中等 |

**推荐实现**：
```python
# 抽离 SQL 到单独模块
from sqlalchemy import text
from .sql_templates import agents_sql, tasks_sql

# 使用
result = session.execute(text(agents_sql['list']), {'limit': 10})
```

**文件结构**：
```
backend/app/
├── sql_templates/
│   ├── __init__.py
│   ├── agents.py      # Agent 相关 SQL 模板
│   ├── tasks.py       # Task 相关 SQL 模板
│   └── costs.py       # Cost 相关 SQL 模板
```

---

## 六、接口规范示例

### 6.1 统一响应格式

```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

### 6.2 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数错误"
  }
}
```

### 6.3 分页响应

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total": 100
  }
}
```

---

## 七、非功能性需求

### 7.1 日志规范

| 级别 | 使用场景 |
|------|----------|
| DEBUG | 详细调试信息 |
| INFO | 请求参数、响应状态 |
| WARNING | 性能警告 |
| ERROR | 错误堆栈 |

### 7.2 监控指标

- API QPS
- 响应时间 (P50/P95/P99)
- Agent运行状态
- 任务执行成功率
- 成本消耗

### 7.3 安全要求

- 认证：Token/Bearer Auth
- 权限：角色-based访问控制
- 审计：所有操作记录日志
- 脱敏：敏感数据加密存储

---

## 八、禁止/限制项

1. **禁止明文存储密码** - 使用hash存储
2. **禁止硬编码密钥** - 从环境变量读取
3. **禁止直接返回AI原始响应** - 需过滤敏感词
4. **禁止无限制执行** - 超时和次数限制
5. **禁止硬编码SQL** - 使用 SQLAlchemy 或独立 SQL 文件

---

## 九、状态说明

| 状态 | 含义 |
|------|------|
| ✅ 已实现 | 功能完成，可直接使用 |
| ✅ Phase1已完成 | Phase 1 开发已完成 |
| ⚠️ 基础实现 | 有基础框架，需要完善 |
| 🔲 未实现 | 尚未开发 |
