# Phase 0 - 后端：数据库迁移 + 表结构调整

## 任务目标

使用 Alembic 对数据库进行结构变更，新增/修改表字段，确保向后兼容。

## 前置条件

- 确认已初始化 Alembic（如未初始化，执行 `alembic init alembic`）
- 当前数据库：`data/nexus.db`（SQLite），31张表

## 迁移变更清单

### 变更 1：gateway_bridges 增加 user_id

```python
# migration: add user_id to gateway_bridges
def upgrade():
    op.add_column('gateway_bridges', sa.Column('user_id', sa.String(36), nullable=True))
    op.create_index('idx_gateway_bridges_user_id', 'gateway_bridges', ['user_id'])

def downgrade():
    op.drop_index('idx_gateway_bridges_user_id')
    op.drop_column('gateway_bridges', 'user_id')
```

同时更新 ORM 模型 `backend/app/models/gateway.py`：
```python
user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
```

### 变更 2：agents 表增加 bridge_id

```python
def upgrade():
    op.add_column('agents', sa.Column('bridge_id', sa.String(255), nullable=True))
    op.create_index('idx_agents_bridge_id', 'agents', ['bridge_id'])

def downgrade():
    op.drop_index('idx_agents_bridge_id')
    op.drop_column('agents', 'bridge_id')
```

更新 ORM 模型 `backend/app/models/orm_models.py` Agent 类：
```python
bridge_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
# 注意：保留 bridge_url 字段不做删除，过渡期共存
```

### 变更 3：notification_channels 类型名统一

此变更不需要数据库迁移，只需：
1. 确认后端 notification 模型中 channel_type 的值是 `wecom`
2. 前端（Phase 0 前端修复中处理）统一为 `wecom`
3. 在 API 响应层做映射（如果存在兼容问题）

## 新增表（为后续 Phase 预创建）

> 以下表在后续 Phase 使用，但提前创建空表避免后续迁移堆积。

### project_documents

```python
def upgrade():
    op.create_table(
        'project_documents',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('doc_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text, nullable=True),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('file_type', sa.String(50), nullable=True),
        sa.Column('file_size', sa.Integer, nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.String, nullable=True),
        sa.Column('updated_at', sa.String, nullable=True),
    )
    op.create_index('idx_project_docs_project_id', 'project_documents', ['project_id'])
    op.create_index('idx_project_docs_doc_type', 'project_documents', ['doc_type'])
```

### agent_config_files

```python
def upgrade():
    op.create_table(
        'agent_config_files',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('agent_type_id', sa.String(36), nullable=True),
        sa.Column('config_type', sa.String(100), nullable=False),
        sa.Column('content', sa.Text, nullable=True),
        sa.Column('is_template', sa.Boolean, default=False),
        sa.Column('created_at', sa.String, nullable=True),
        sa.Column('updated_at', sa.String, nullable=True),
    )
    op.create_index('idx_agent_config_project_type', 'agent_config_files', ['project_id', 'config_type'])
```

### task_files

```python
def upgrade():
    op.create_table(
        'task_files',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('task_id', sa.String(36), sa.ForeignKey('tasks.id'), nullable=False),
        sa.Column('file_type', sa.String(50), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_size', sa.Integer, nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('uploaded_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.String, nullable=True),
    )
    op.create_index('idx_task_files_task_id', 'task_files', ['task_id'])
    op.create_index('idx_task_files_file_type', 'task_files', ['file_type'])
```

### human_interventions

```python
def upgrade():
    op.create_table(
        'human_interventions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('task_id', sa.String(36), sa.ForeignKey('tasks.id'), nullable=False),
        sa.Column('workflow_execution_id', sa.String(36), nullable=True),
        sa.Column('node_id', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('context', sa.Text, nullable=True),
        sa.Column('decision', sa.String(20), nullable=True),
        sa.Column('comment', sa.Text, nullable=True),
        sa.Column('attachment_paths', sa.Text, nullable=True),
        sa.Column('decided_by', sa.String(36), nullable=True),
        sa.Column('decided_at', sa.String, nullable=True),
        sa.Column('created_at', sa.String, nullable=True),
    )
    op.create_index('idx_interventions_status', 'human_interventions', ['status'])
    op.create_index('idx_interventions_task_id', 'human_interventions', ['task_id'])
```

### workflow_executions + workflow_node_executions

```python
def upgrade():
    op.create_table(
        'workflow_executions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('workflow_id', sa.String(36), sa.ForeignKey('workflows.id'), nullable=True),
        sa.Column('template_id', sa.String(36), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('current_node_id', sa.String(100), nullable=True),
        sa.Column('input_params', sa.Text, nullable=True),
        sa.Column('output_data', sa.Text, nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('started_at', sa.String, nullable=True),
        sa.Column('completed_at', sa.String, nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.String, nullable=True),
        sa.Column('updated_at', sa.String, nullable=True),
    )
    op.create_index('idx_wf_exec_status', 'workflow_executions', ['status'])
    op.create_index('idx_wf_exec_workflow_id', 'workflow_executions', ['workflow_id'])

    op.create_table(
        'workflow_node_executions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('execution_id', sa.String(36), sa.ForeignKey('workflow_executions.id'), nullable=False),
        sa.Column('node_id', sa.String(100), nullable=False),
        sa.Column('node_type', sa.String(50), nullable=False),
        sa.Column('node_config', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('input_data', sa.Text, nullable=True),
        sa.Column('output_data', sa.Text, nullable=True),
        sa.Column('agent_id', sa.String(36), nullable=True),
        sa.Column('task_id', sa.String(36), nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('started_at', sa.String, nullable=True),
        sa.Column('completed_at', sa.String, nullable=True),
        sa.Column('duration_ms', sa.Integer, nullable=True),
    )
    op.create_index('idx_node_exec_execution_id', 'workflow_node_executions', ['execution_id'])
    op.create_index('idx_node_exec_status', 'workflow_node_executions', ['status'])
```

### dashboard_layouts + user_session_tokens

```python
def upgrade():
    op.create_table(
        'dashboard_layouts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('scope', sa.String(20), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('is_default', sa.Boolean, default=False),
        sa.Column('layout', sa.Text, nullable=True),
        sa.Column('created_at', sa.String, nullable=True),
        sa.Column('updated_at', sa.String, nullable=True),
    )
    op.create_index('idx_dashboard_layouts_user_scope', 'dashboard_layouts', ['user_id', 'scope'])

    op.create_table(
        'user_session_tokens',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('token_type', sa.String(20), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('device_info', sa.String(255), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('expires_at', sa.String, nullable=True),
        sa.Column('revoked_at', sa.String, nullable=True),
        sa.Column('created_at', sa.String, nullable=True),
    )
    op.create_index('idx_session_tokens_user', 'user_session_tokens', ['user_id'])
    op.create_index('idx_session_tokens_hash', 'user_session_tokens', ['token_hash'], unique=True)
```

## ORM 模型文件

每个新表需要创建对应的 SQLAlchemy ORM 模型文件：
```
backend/app/models/project_document.py
backend/app/models/agent_config_file.py
backend/app/models/task_file.py
backend/app/models/human_intervention.py
backend/app/models/workflow_execution.py
backend/app/models/dashboard_layout.py
backend/app/models/user_session_token.py
```

每个模型文件参考现有模型 `backend/app/models/project.py` 的写法（使用 `Base` + `TimestampMixin`）。

## 约束

- **Python 语法兼容 3.9**：用 `Optional[str]`，不用 `str | None`
- **所有新增字段 Optional**：`nullable=True`
- **Alembic 脚本必须包含 upgrade() 和 downgrade()**
- **不修改现有表字段类型**（只增不改不删）
- **迁移执行前先备份数据库**：`cp data/nexus.db data/nexus.db.bak`

## 验收标准

- [ ] `alembic upgrade head` 执行成功，无报错
- [ ] `alembic downgrade -1` 后再 `alembic upgrade head` 可逆
- [ ] 现有数据完整（登录、查询Agent、查询项目等不报错）
- [ ] `gateway_bridges` 表新增 `user_id` 列，现有数据值为 NULL
- [ ] `agents` 表新增 `bridge_id` 列
- [ ] 8 张新表创建成功
- [ ] ORM 模型可正常导入，`from app.models.xxx import Xxx` 不报错
