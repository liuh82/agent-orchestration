# Nexus 后端 — 第 4 轮：Admin + 配置 + 统计 + 种子数据

> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/backend/`
> **前置条件**: 第 1-3 轮已完成（基础设施 + 认证 + 核心业务）
> **完整文档参考**: `../docs/backend-dev-prompt.md`

---

## 任务清单

### 1. Admin Router — `app/routers/admin.py`

#### 用户管理（Admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/users` | 用户列表（分页） |
| PUT | `/api/v1/admin/users/:id/quota` | 修改配额 `{max_agents, max_projects, max_tasks}` |
| PUT | `/api/v1/admin/users/:id/role` | 修改角色 `{role: admin/user}` |
| PUT | `/api/v1/admin/users/:id/status` | 启用/禁用 `{is_active: true/false}` |

#### Agent 类型管理（Admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/agent-types` | 类型列表 |
| POST | `/api/v1/admin/agent-types` | 新增类型 |
| PUT | `/api/v1/admin/agent-types/:id` | 编辑类型 |
| DELETE | `/api/v1/admin/agent-types/:id` | 删除（仅非系统预置，is_system=False） |

**所有端点需要 `require_admin` 依赖注入。**

### 2. SystemSetting 模型 — `app/models/system_setting.py`

```python
class SystemSetting(Base, TimestampMixin):
    __tablename__ = "system_settings"
    
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)  # JSON 值
    description: Mapped[str | None] = mapped_column(Text)
    updated_by: Mapped[str | None] = mapped_column(String(36))
```

### 3. NotificationChannel 模型 — `app/models/notification.py`

```python
class NotificationChannel(Base, TimestampMixin):
    __tablename__ = "notification_channels"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str | None] = mapped_column(String(36))  # NULL = 全局
    channel_type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    config: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    triggers: Mapped[str | None] = mapped_column(Text)  # JSON
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

### 4. Settings Router — `app/routers/settings.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/settings` | 获取所有设置（key-value 对） |
| PUT | `/api/v1/admin/settings` | 批量更新 `{settings: {key: value, ...}}` |

### 5. Notification Router — `app/routers/notifications.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/notifications/channels` | 我的通道列表 |
| POST | `/api/v1/notifications/channels` | 创建 `{channel_type, name, config, triggers}` |
| PUT | `/api/v1/notifications/channels/:id` | 更新 |
| DELETE | `/api/v1/notifications/channels/:id` | 删除 |
| POST | `/api/v1/notifications/channels/:id/test` | 测试发送（实际发一条消息验证） |
| GET | `/api/v1/admin/notifications/channels` | 全局通道（Admin） |

**测试发送逻辑**：根据 channel_type 调用对应 webhook：
- feishu: POST `config.webhook_url` with `{"msg_type": "text", "content": {"text": "Nexus 通知测试"}}`
- dingtalk: POST `config.webhook_url` with `{"msgtype": "text", "text": {"content": "Nexus 通知测试"}}`
- wecom: POST `config.webhook_url` with `{"msgtype": "text", "text": {"content": "Nexus 通知测试"}}`

### 6. Stats Router — `app/routers/stats.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/stats/dashboard` | Dashboard 汇总 |
| GET | `/api/v1/stats/projects/:id` | 项目统计 |
| GET | `/api/v1/stats/agents/:id` | Agent 统计 |
| GET | `/api/v1/admin/stats/global` | 全局统计（Admin） |

**Dashboard 统计响应示例**：
```json
{
  "agents": {"total": 5, "online": 3, "offline": 2},
  "projects": {"total": 8, "active": 5, "completed": 3},
  "tasks": {"total": 45, "pending": 10, "running": 5, "completed": 25, "failed": 5},
  "jobs": {"total": 120, "pending": 15, "running": 8, "completed": 90, "failed": 7},
  "tokens": {"total": 5000000, "today": 50000, "this_week": 300000, "this_month": 2000000},
  "cost": {"total": 120.5, "today": 5.2, "this_week": 35.0, "this_month": 80.0}
}
```

**统计逻辑**：
- agents: 从 `agent_instances` 查 current_user 的，按 status group by
- projects: 从 `projects` 查，按 status group by
- tasks: 从 `tasks` 查，按 status group by
- jobs: 从 `jobs` 查，按 status group by
- tokens: 从 `jobs` 汇总 `prompt_tokens + completion_tokens`，today/week/month 用 created_at 过滤
- cost: 从 `cost_entries` 汇总，today/week/month 过滤

### 7. 种子数据 — `app/services/seed.py`

在 `main.py` 的 `@app.on_event("startup")` 中调用：

```python
async def init_app():
    # 1. 运行 Alembic upgrade
    # 2. 创建 admin 用户（如果不存在）
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        admin = User(
            email=settings.ADMIN_EMAIL,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            name="Admin",
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
    
    # 3. 插入系统预置 AgentType（如果不存在）
    preset_types = [
        {"name": "cc", "display_name": "Claude Code", "protocol": "local_process",
         "capabilities": '["coding", "refactoring", "debugging"]',
         "default_models": '["claude-3-sonnet", "claude-3-opus"]'},
        {"name": "codex", "display_name": "Codex", "protocol": "local_process",
         "capabilities": '["coding", "testing"]',
         "default_models": '["gpt-4", "gpt-3.5-turbo"]'},
        {"name": "opencode", "display_name": "OpenCode", "protocol": "local_process",
         "capabilities": '["coding"]',
         "default_models": '["deepseek-coder", "qwen-coder"]'},
        {"name": "openclaw", "display_name": "OpenClaw", "protocol": "websocket",
         "capabilities": '["orchestration", "scheduling"]',
         "default_models": '["minimax-M2.5"]'},
    ]
    for t in preset_types:
        exists = db.query(AgentType).filter(AgentType.name == t["name"]).first()
        if not exists:
            db.add(AgentType(**t, is_system=True))
    db.commit()
```

### 8. 改造现有模型（加 user_id）

以下表需要增加 `user_id` 字段并创建 migration：
- `cost_entries` → `user_id VARCHAR(36)`
- `daily_costs` → `user_id VARCHAR(36)`
- `budgets` → `user_id VARCHAR(36)`
- `heartbeats` → `user_id VARCHAR(36)`
- `agent_logs` → 改为引用 `agent_instances(id)`（原引用 `agents(id)`）

### 9. 改造现有 routers

- `routers/heartbeats.py`：查询加 `user_id` 过滤
- 现有 `routers/agents.py`：**暂时重命名为 `routers/agents_legacy.py`**，新 agents.py 已在第 3 轮创建
- 现有 `routers/tasks.py`：**暂时重命名为 `routers/tasks_legacy.py`**

在 main.py 中注册新 router，旧 router 注释掉。

### 10. Alembic Migration

```bash
alembic revision --autogenerate -m "add_settings_notifications_add_user_id_to_existing"
alembic upgrade head
```

---

## 输出要求

1. Admin 能查看/管理用户和 Agent 类型
2. 系统设置 CRUD 正常
3. 通知通道 CRUD + 测试发送
4. Dashboard 统计数据正确
5. 首次启动自动创建 admin + 预置 AgentType
6. 现有表已加 user_id
7. 所有 migration 可重复运行

**测试命令**：
```bash
# Admin 获取全局统计
curl http://localhost:8081/api/v1/admin/stats/global \
  -H "Authorization: Bearer <admin_token>"

# 获取 Dashboard
curl http://localhost:8081/api/v1/stats/dashboard \
  -H "Authorization: Bearer <user_token>"

# 创建通知通道
curl -X POST http://localhost:8081/api/v1/notifications/channels \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"channel_type":"feishu","name":"飞书通知","config":"{\"webhook_url\":\"https://open.feishu.cn/...\"}"}'
```

---

## ⚠️ 注意

- Admin 端点必须用 `require_admin` 守卫
- 种子数据幂等（重复运行不报错）
- 现有 router 重命名而不是删除（保留兼容）
- 通知测试发送要 try-catch，失败返回友好错误
- 本轮是后端最后一轮，完成后后端第一轮迭代结束
