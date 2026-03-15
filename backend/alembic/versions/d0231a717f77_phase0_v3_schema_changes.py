"""Phase 0: v3 schema changes — add columns + pre-create tables

Revision ID: d0231a717f77
Revises: fe0f015c0d18
Create Date: 2026-03-15

- gateway_bridges: add user_id column + index
- agents: add bridge_id column + index
- Pre-create 8 tables for future phases: project_documents, agent_config_files,
  task_files, human_interventions, workflow_executions, workflow_node_executions,
  dashboard_layouts, user_session_tokens
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'd0231a717f77'
down_revision: Union[str, Sequence[str], None] = 'b53902250590'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _col_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    cols = [c['name'] for c in inspect(conn).get_columns(table)]
    return column in cols


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    return table in inspect(conn).get_table_names()


def upgrade() -> None:
    # ── 变更 1: gateway_bridges 增加 user_id ──────────────────────────
    if not _col_exists('gateway_bridges', 'user_id'):
        op.add_column('gateway_bridges', sa.Column('user_id', sa.String(36), nullable=True))
        op.create_index('idx_gateway_bridges_user_id', 'gateway_bridges', ['user_id'])

    # ── 变更 2: agents 表增加 bridge_id ───────────────────────────────
    if not _col_exists('agents', 'bridge_id'):
        op.add_column('agents', sa.Column('bridge_id', sa.String(255), nullable=True))
        op.create_index('idx_agents_bridge_id', 'agents', ['bridge_id'])

    # ── 新增表: project_documents ─────────────────────────────────────
    if not _table_exists('project_documents'):
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

    # ── 新增表: agent_config_files ────────────────────────────────────
    if not _table_exists('agent_config_files'):
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

    # ── 新增表: task_files ────────────────────────────────────────────
    if not _table_exists('task_files'):
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

    # ── 新增表: human_interventions ───────────────────────────────────
    if not _table_exists('human_interventions'):
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

    # ── 新增表: workflow_executions ───────────────────────────────────
    if not _table_exists('workflow_executions'):
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

    # ── 新增表: workflow_node_executions ──────────────────────────────
    if not _table_exists('workflow_node_executions'):
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

    # ── 新增表: dashboard_layouts ─────────────────────────────────────
    if not _table_exists('dashboard_layouts'):
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

    # ── 新增表: user_session_tokens ───────────────────────────────────
    if not _table_exists('user_session_tokens'):
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


def downgrade() -> None:
    # 删除新增表（逆序）
    op.drop_table('user_session_tokens')
    op.drop_table('dashboard_layouts')
    op.drop_table('workflow_node_executions')
    op.drop_table('workflow_executions')
    op.drop_table('human_interventions')
    op.drop_table('task_files')
    op.drop_table('agent_config_files')
    op.drop_table('project_documents')

    # 删除新增列
    op.drop_index('idx_agents_bridge_id')
    op.drop_column('agents', 'bridge_id')

    op.drop_index('idx_gateway_bridges_user_id')
    op.drop_column('gateway_bridges', 'user_id')
