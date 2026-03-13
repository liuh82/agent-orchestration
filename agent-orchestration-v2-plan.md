# AI Agent Orchestration 开发方案 (v3.0)

> 基于 agent-orchestration 项目现状 + Paperclip 功能对比
> 更新日期：2026-03-13
> 当前版本：v2.3.5 (commit: c48bc60)
> 项目状态：**稳定，可进入 Phase 5 ORM 迁移开发**

---

## 一、架构设计

### 1.1 核心架构（宏观）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         前端层 (React + TypeScript)                     │
│   Dashboard │ Agents │ Tasks │ Workflows │ Org │ Approvals │ Audit │ HB   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       API Gateway (FastAPI)                            │
│   API Key 认证 │ 限流 │ 日志 │ 路由                                          │
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
│                         数据层 (SQLite → SQLAlchemy 2.0 ORM)          │
│   agents │ tasks │ workflows │ costs │ logs │ org │ goals │ approvals │ hb  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design |
| 后端 | Python FastAPI + Pydantic v2 |
| 数据库 | SQLite (WAL模式) + **SQLAlchemy 2.0 ORM + Alembic** (待迁移) |
| 状态管理 | Zustand + React Query |
| 工作流引擎 | Lobster Engine (可插拔) |
| 认证 | API Key (MVP) |

---

## 二、功能实现进度

### 2.1 Agent 管理模块

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/agents | GET | Agent列表 | ✅ 已实现 |
| /api/agents | POST | 创建Agent | ✅ 已实现 |
| /api/agents/{id} | GET | Agent详情 | ✅ 已实现 |
| /api/agents/{id} | PUT | 更新Agent | ✅ 已实现 |
| /api/agents/{id} | DELETE | 删除Agent | ✅ 已实现 |
| /api/agents/{id}/start | POST | 启动Agent | ✅ Phase1 |
| /api/agents/{id}/stop | POST | 停止Agent | ✅ Phase1 |
| /api/agents/{id}/logs | GET | 运行日志 | ✅ Phase1 |
| /api/agents/{id}/stats | GET | 性能统计 | ✅ Phase1 |
| /api/agents/{id}/heartbeat | POST | Agent心跳 | 🔲 未实现 |

### 2.2 Task 管理模块

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/tasks | GET | 任务列表(分页) | ✅ |
| /api/tasks | POST | 创建任务 | ✅ |
| /api/tasks/{id} | GET | 任务详情 | ✅ |
| /api/tasks/{id} | PUT | 更新任务 | ✅ |
| /api/tasks/{id} | DELETE | 删除任务 | ✅ |
| /api/tasks/{id}/execute | POST | 执行任务 | ✅ |
| /api/tasks/{id}/pause | POST | 暂停任务 | ✅ |
| /api/tasks/{id}/resume | POST | 恢复任务 | ✅ |
| /api/tasks/{id}/assign | POST | 分配Agent | ✅ Phase1 |
| /api/tasks/{id}/logs | GET | 任务日志 | 🔲 未实现 |

### 2.3 Workflow 管理模块

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/workflows | GET | 工作流列表 | ✅ |
| /api/workflows | POST | 创建工作流 | ✅ |
| /api/workflows/{id} | GET | 工作流详情 | ✅ |
| /api/workflows/{id} | PUT | 更新工作流 | ✅ |
| /api/workflows/{id} | DELETE | 删除工作流 | ✅ |
| /api/workflows/{id}/execute | POST | 执行工作流 | ✅ |
| /api/workflows/{id}/status/{exec_id} | GET | 执行状态 | ✅ |
| /api/workflows/{id}/logs/{exec_id} | GET | 执行日志 | ✅ |
| /api/workflows/templates | GET | 工作流模板 | ✅ |
| /api/workflows/visual-editor | GET | 可视化编辑器 | 🔲 未实现 |

### 2.4 Cost 成本控制模块

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/costs | GET | 成本列表 | ✅ |
| /api/costs/summary | GET | 成本汇总 | ✅ |
| /api/costs/by-agent | GET | 按Agent统计 | ✅ Phase1 |
| /api/costs/by-period | GET | 按时间段统计 | 🔲 未实现 |
| /api/costs/budget | GET/POST | 预算设置 | ✅ Phase1 |
| /api/costs/alert | POST | 超预算告警 | ✅ Phase1 |

### 2.5 Org 组织架构模块

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/org/chart | GET | 组织架构图 | ✅ 后端+前端 |
| /api/org/roles | GET/POST | 角色管理 | ✅ 后端+前端 |
| /api/org/members | GET/POST | 成员管理 | ✅ 后端+前端 |
| /api/goals | GET/POST | 目标管理 | ✅ 后端+前端 |
| /api/goals/align | POST | 目标对齐 | ✅ 后端+前端 |

### 2.6 Governance 治理模块

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/approvals | GET | 待审批列表 | ✅ 后端+前端 |
| /api/approvals/{id} | POST | 审批操作 | ✅ 后端+前端 |
| /api/approvals/history | GET | 审批历史 | ✅ 后端+前端 |
| /api/audit/logs | GET | 审计日志 | ✅ 后端+前端 |

### 2.7 Heartbeat 心跳模块

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| /api/heartbeats | GET | 心跳配置列表 | ✅ 后端+前端 |
| /api/heartbeats | POST | 创建心跳任务 | ✅ 后端+前端 |
| /api/heartbeats/{id} | PUT | 更新心跳配置 | ✅ 后端+前端 |
| /api/heartbeats/{id}/trigger | POST | 手动触发 | ✅ 后端+前端 |
| /api/heartbeats/{id}/disable | POST | 禁用心跳 | ✅ 后端+前端 |
| /api/heartbeats/{id}/enable | POST | 启用心跳 | ✅ 后端+前端 |
| /api/heartbeats/{id}/logs | GET | 执行日志 | ✅ 后端+前端 |
| /api/heartbeats/stats | GET | 统计信息 | ✅ 后端+前端 |

---

## 三、版本发布记录

### v2.0 — Phase 1 核心功能 ✅ (2026-03-09)

- Agent CRUD + 启停 + 日志 + 统计
- Task CRUD + 分配
- Workflow CRUD + 执行
- Cost 按Agent统计 + 预算 + 告警
- 前端基础页面

### v2.1 — Phase 2 后端扩展 ✅ (2026-03-12)

- Org Chart 组织架构后端
- Goal Alignment 目标对齐后端
- Governance 审批流程 + 审计日志后端
- 后端 pytest 23/23 通过

### v2.2 — Phase 2.5 + Phase 3 ✅ (2026-03-12)

- 前端 Org / Goals / Approvals / Audit 页面
- 后端 Heartbeats 心跳模块
- 后端 pytest 23/23 通过

### v2.3 — 审查修复第一轮 ✅ (2026-03-13)

**修复内容（8 commits: c1cc91e → 9f685ef）：**
- 🔴 SQL 注入修复 — 字段白名单 + 参数化查询
- 🔴 单例线程安全 — 双重检查锁定 + threading.Lock()
- 🔴 API Key 认证中间件 — MVP 版本 (auth.py)
- 🔴 前端轮询清理 — 配置常量化（30s）
- 🟡 数据库连接管理 — 上下文管理器
- 🟡 前端防抖 — asyncDebounce
- 🟡 未使用参数清理
- 🟡 前端错误处理统一

### v2.3.4 — 前端清理 ✅ (2026-03-13)

- 清理未使用的 import 和变量（Audit/Heartbeats/Org/org.ts）
- types/index.ts 类型扩展
- 前端 TypeScript 0 error，build 成功

### v2.3.5 — 审查修复验证通过 ✅ (2026-03-13)

- TEST_REPORT_LOCAL.md 确认：后端 23/23 pytest 通过（本地 Python 3.9.10 交叉验证）
- 前端 0 error，build 成功（1.7MB JS, gzip 544KB）
- API 功能测试全部通过
- **版本状态: 稳定**

---

## 四、测试报告汇总

### 4.1 测试报告 1（2026-03-12，本地测试）

- 后端 3/3 通过（仅 Agent 测试）
- 前端构建成功
- **报告文件**: `TEST_REPORT.md`

### 4.2 测试报告 2（2026-03-12，首次完整测试）

- 后端 9/23 通过，10 失败，4 错误
- 代码覆盖率 57%
- 主要问题：数据模型属性映射、fixture 缺失、Pydantic V2 兼容
- **报告文件**: `test-report.md`

### 4.3 测试报告 3（2026-03-12，修复后）

- 后端 **23/23 通过**，0 失败，0 错误 ✅
- 代码覆盖率 57%
- 修复内容：Pydantic V2 迁移、fixture 补充、数据模型修复、API 路由修复
- **报告文件**: `backend/test-report.md`

### 4.4 服务器端验证（2026-03-13）

- 后端 pytest 23/23 通过（Python 3.11）
- 前端 tsc --noEmit 0 error
- 前端 npm run build 成功

### 4.5 审查修复后本地验证（2026-03-13）✅

- 测试环境：Python 3.9.10, pytest 8.4.2, macOS
- 后端 pytest **23/23 通过**（0.52s）
- 前端 TypeScript **0 error**
- 前端 build **成功**（输出 1.7MB JS, gzip 544KB）
- API 功能测试：httpx.ASGITransport 全端点通过
- **结论**: **PASS** — 审查修复正确实现
- **报告文件**: `TEST_REPORT_LOCAL.md`

**已确认修复的问题：**
1. ✅ 后端数据库表结构优化
2. ✅ 前端 TypeScript 类型错误
3. ✅ 认证中间件实现
4. ✅ 未使用的导入和变量清理

**建议事项：**
- 生产环境应更换 API Key（当前使用开发默认值）
- 前端代码分割优化（当前 1.7MB）
- 考虑添加集成测试用例

---

## 五、代码审查记录

### 5.1 审查 1（2026-03-12 初审）

- 结构清晰，技术栈正确
- 无认证授权（中等风险）
- SQLite 无连接池（低风险）
- **结论**: 通过，可合并

### 5.2 审查 2（2026-03-13 Phase 2.5 + Phase 3）

**审查范围**: 24 个文件，新增 3829 行

| 严重程度 | 数量 | 主要问题 |
|----------|------|----------|
| 🔴 严重 | 4 | SQL注入、单例不安全、无认证、轮询泄漏 |
| 🟡 质量 | 8 | 类型验证缺失、防抖、连接管理、错误处理 |
| 🔵 API | 4 | 无分页、同步触发、无版本控制 |
| 🟢 建议 | 6 | JWT、rate limiting、虚拟滚动 |

**评分**: 代码质量⭐⭐⭐ / API设计⭐⭐⭐ / 安全性⭐⭐ → ⭐⭐⭐⭐ / 可维护性⭐⭐⭐⭐

**修复状态**: 🔴 4/4 全部修复，🟡 3/5 已修复 → **可合并**

---

## 六、下一步开发计划

### Phase 5：数据库层 ORM 迁移 🔴 当前重点

<<<<<<< HEAD
**背景**: 后端 12 个 service 文件共 **216 处原生 SQL**，全部使用 `cursor.execute` / `fetchall` / `sqlite3` 裸操作。`sqlalchemy==2.0.23` 已在 requirements.txt 中但从未使用。

**目标**: 全面迁移到 SQLAlchemy 2.0 ORM + Alembic 迁移，彻底消除原生 SQL，支持多数据库（SQLite/PostgreSQL/MySQL）。

**开发原则**: 不急于上线，追求架构完美。宁可影响进度，也要保证系统功能的质量和可扩展性。

=======
**背景**: 后端 4 个 SQLite 数据库（tasks.db/costs.db/workflows.db/agents.db），12 个 service 文件共 **147 处原生 SQL**，全部使用 `cursor.execute` / `fetchall` / `sqlite3` 裸操作。`sqlalchemy==2.0.23` 已在 requirements.txt 中但从未使用。

**目标**: 合并 4 个数据库到单一 tasks.db（21 表），全面迁移到 SQLAlchemy 2.0 ORM + Alembic 迁移，彻底消除原生 SQL。

**开发原则**: 不急于上线，追求架构完美。宁可影响进度，也要保证系统功能的质量和可扩展性。

**详细设计文档**: `docs/orm-migration-design.md`（含数据合并策略、ORM 模型、迁移脚本、验收标准）

>>>>>>> 7117a1164eaa3014ab8e6302f4c66eb3ad97e9e8
#### 5.0 数据库迁移策略：Alembic

**决策：使用 Alembic 管理数据库版本**

- `alembic init alembic` — 初始化迁移目录
- `alembic revision --autogenerate -m "initial"` — 生成初始迁移脚本
- `alembic upgrade head` — 执行迁移
- 支持 `downgrade` 回滚
- 数据库 URL 通过环境变量 `DATABASE_URL` 配置，支持切换后端

**多数据库支持设计**：
```python
# .env 或环境变量
DATABASE_URL=sqlite+aiosqlite:///./agent_orchestration.db  # 开发
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost/db  # 生产
# DATABASE_URL=mysql+aiomysql://user:pass@localhost/db      # MySQL
```

**新增依赖**:
- `alembic` — 数据库迁移
- `aiosqlite` — SQLite async driver（与现有 async 路由兼容）
- 未来可选：`asyncpg`（PostgreSQL）、`aiomysql`（MySQL）

#### 5.1 创建 ORM 模型（18个表）

在 `app/models/` 下新建 ORM 模型，对应现有数据库表：

| ORM 模型 | 数据库表 |
|----------|----------|
| Agent | agents |
| AgentLog | agent_logs |
| Task | tasks |
| TaskAssignment | task_assignments |
| Workflow | workflows |
| OrgNode | org_nodes |
| Role | roles |
| Member | members |
| Goal | goals |
| GoalAlignment | goal_alignments |
| Approval | approvals |
| ApprovalHistory | approval_history |
| AuditLog | audit_logs |
| Heartbeat | heartbeats |
| HeartbeatLog | heartbeat_logs |
| CostRecord | cost_records |
| Budget | budgets（如独立表）|
| + 其他根据 CREATE TABLE 确认的表 |

使用 SQLAlchemy 2.0 声明式映射（`DeclarativeBase` + `Mapped`），字段与现有表完全一致。
**注意**: 不同数据库的方言差异在 ORM 层屏蔽，Service 层不需要关心。

#### 5.2 创建数据库会话管理

在 `app/database.py` 中：
- `engine` — `create_engine(DATABASE_URL)`，根据 URL 自动选择方言
- SQLite 启动时开启 WAL 模式（通过 event listener）
- `SessionLocal` — sessionmaker
- `get_db()` — FastAPI 依赖注入
- `Base` — 所有 ORM 模型的基类

#### 5.3 重写 12 个 Service

| 文件 | 原生 SQL 处数 |
|------|-------------|
| heartbeat.py | 42 |
| budget_service.py | 39 |
| agent.py | 38 |
| goal.py | 38 |
| approval.py | 36 |
| member.py | 33 |
| org_chart.py | 27 |
| audit.py | 31 |
| workflow.py | 31 |
| role.py | 26 |
| cost.py | 24 |
| task.py | 18 |

**重写规则**:
- `SELECT` → `session.query()` 或 `session.execute(select(...))`
- `INSERT` → `session.add()`
- `UPDATE` → 修改 ORM 对象属性
- `DELETE` → `session.delete()`
- `cursor.fetchone()` → `.scalar()` / `.first()`
- `cursor.fetchall()` → `.scalars().all()`
- 条件过滤 → `.where()` / `.filter()`
- 分页 → `.offset().limit()`
- 事务 → Session 自动管理，异常时 `session.rollback()`
- 完全删除 `_get_connection()` 和手动 `sqlite3.connect()`

#### 5.4 更新 Router 层

所有 router 改为依赖注入：
```python
from app.database import get_db

@router.get("/agents")
def get_agents(db: Session = Depends(get_db)):
    return agent_service.get_agents(db)
```

#### 5.5 验收标准

1. **零原生 SQL** — `grep -rn "cursor.execute\|cursor.fetchall\|cursor.fetchone\|sqlite3.connect\|_get_connection" app/services/` 返回空
2. **pytest 23/23 通过**
3. **前端 tsc 0 error，build 成功**
4. **启动无报错**
5. **所有 API 端点返回正确**
6. **Alembic 迁移正常** — `alembic upgrade head` / `alembic downgrade -1` 无报错
7. **数据库可切换** — 修改 `DATABASE_URL` 后应用正常启动

### Phase 6：功能补齐（P2）

8. **Multi-Company** — 多公司数据隔离
9. **Mobile 适配** — 响应式 UI
10. **Workflow 可视化编辑器**
11. **按时间段成本统计**
12. **Agent 心跳独立接口**

### Phase 7：优化改进

13. **JWT 认证** — 替换 API Key MVP
14. **Rate Limiting** — 100 req/min
15. **前端代码分割** — 当前 JS 1.17MB，需 dynamic import
16. **CI/CD 集成** — 自动化测试 + 构建
17. **Pydantic ConfigDict 迁移** — 消除 V2 弃用警告
18. **测试覆盖率提升** — 目标 70%+

---

## 七、Paperclip 核心功能对比

| Paperclip 功能 | agent-orchestration 状态 | 优先级 |
|---------------|----------------------|--------|
| Bring Your Own Agent | ✅ Phase1 | P0 ✅ |
| Goal Alignment | ✅ 后端+前端 | P1 ✅ |
| Heartbeats | ✅ 后端+前端 | P1 ✅ |
| Cost Control | ✅ Phase1 | P0 ✅ |
| Governance | ✅ 后端+前端 | P1 ✅ |
| Org Chart | ✅ 后端+前端 | P1 ✅ |
| Ticket System | ⚠️ 基础实现 | P0 |
| Multi-Company | 🔲 未实现 | P2 |
| Mobile Ready | 🔲 未实现 | P2 |

---

## 八、技术规范

### 8.1 统一响应格式

```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

### 8.2 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数错误"
  }
}
```

### 8.3 分页响应

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

## 九、非功能性需求

### 9.1 安全要求

- ✅ API Key 认证（MVP 已实现）
- 🔲 JWT/Session 认证（待 Phase 7）
- 🔲 Rate Limiting（待 Phase 7）
- 🔲 CSRF 保护
- ✅ SQL 注入防御（参数化查询）

### 9.2 代码规范

- ❌ 禁止硬编码 SQL — 必须使用 SQLAlchemy ORM（Phase 5 完成后强制）
- ❌ 禁止硬编码密钥 — 从环境变量读取
- ❌ 禁止明文存储密码
- ✅ API 文档注释（FastAPI 自动生成）

---

## 十、Git 提交历史

| Commit | 日期 | 说明 |
|--------|------|------|
| c48bc60 | 2026-03-13 | docs: 添加TEST_REPORT_LOCAL测试报告 |
| 2717ee9 | 2026-03-13 | docs: 更新开发计划至v3.0 |
| cb6979f | 2026-03-13 | docs: 更新开发计划 - 补充版本记录和ORM迁移计划 |
| 0fe326a | 2026-03-13 | fix: 修复前端TypeScript类型错误和未使用变量 |
| f3f4d8e | 2026-03-13 | Merge remote-tracking branch |
| 264be35 | 2026-03-13 | chore: 更新配置和任务数据 |
| 2b8241e | 2026-03-13 | fix: 清理前端未使用的 import 和变量 |
| 9f685ef | 2026-03-13 | fix: 修复TypeScript编译错误 |
| f48b762 | 2026-03-13 | fix: 前端防抖 |
| c4dfcdd | 2026-03-13 | fix: 数据库连接管理 |
| 3abb74b | 2026-03-13 | fix: 前端轮询清理 |
| de42d74 | 2026-03-13 | feat: 添加API Key认证中间件 |
| 83661ab | 2026-03-13 | fix: 单例线程安全修复 |
| 5af7ff5 | 2026-03-13 | fix: SQL注入修复 |
| c1cc91e | 2026-03-13 | fix: 修复安全和性能问题 |
| d05b77b | 2026-03-13 | chore: 添加依赖 |
| 14a8695 | 2026-03-12 | feat: Phase 2.5 前端 + Phase 3 Heartbeats |
| efca492 | 2026-03-12 | fix: lifespan handler, WAL mode |
| 52312b8 | 2026-03-11 | feat: Phase 2 组织架构 |
