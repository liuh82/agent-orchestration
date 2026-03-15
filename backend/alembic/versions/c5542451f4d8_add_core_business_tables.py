"""add_core_business_tables

Revision ID: c5542451f4d8
Revises: cef43be9a050
Create Date: 2026-03-15 12:41:09.081306

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'c5542451f4d8'
down_revision: Union[str, Sequence[str], None] = 'cef43be9a050'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add core business tables and columns (idempotent)."""
    conn = op.get_bind()
    existing = inspect(conn).get_table_names()

    if 'agent_types' not in existing:
        op.create_table('agent_types',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('display_name', sa.String(length=255), nullable=False),
            sa.Column('protocol', sa.String(length=50), nullable=False),
            sa.Column('config_schema', sa.Text(), nullable=True),
            sa.Column('capabilities', sa.Text(), nullable=True),
            sa.Column('default_models', sa.Text(), nullable=True),
            sa.Column('is_system', sa.Boolean(), nullable=False),
            sa.Column('created_by', sa.String(length=36), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name'),
        )

    if 'agent_instances' not in existing:
        op.create_table('agent_instances',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('type_id', sa.String(length=36), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('model', sa.String(length=100), nullable=True),
            sa.Column('config', sa.Text(), nullable=True),
            sa.Column('task_count', sa.Integer(), nullable=False),
            sa.Column('completed_tasks', sa.Integer(), nullable=False),
            sa.Column('failed_tasks', sa.Integer(), nullable=False),
            sa.Column('total_tokens', sa.Integer(), nullable=False),
            sa.Column('total_cost', sa.Float(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False),
            sa.Column('last_seen_at', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'name', name='uq_user_agent_name'),
        )
        with op.batch_alter_table('agent_instances', schema=None) as batch_op:
            batch_op.create_index('idx_agent_instances_user_id', ['user_id'], unique=False)

    if 'projects' not in existing:
        op.create_table('projects',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('spec', sa.Text(), nullable=True),
            sa.Column('workflow_id', sa.String(length=36), nullable=True),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('total_tasks', sa.Integer(), nullable=False),
            sa.Column('completed_tasks', sa.Integer(), nullable=False),
            sa.Column('total_tokens', sa.Integer(), nullable=False),
            sa.Column('total_cost', sa.Float(), nullable=False),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'name', name='uq_user_project_name'),
        )

    if 'jobs' not in existing:
        op.create_table('jobs',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('task_id', sa.String(length=36), nullable=False),
            sa.Column('project_id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('agent_inst_id', sa.String(length=36), nullable=True),
            sa.Column('name', sa.String(length=255), nullable=True),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('priority', sa.String(length=20), nullable=False),
            sa.Column('prompt', sa.Text(), nullable=True),
            sa.Column('action_params', sa.Text(), nullable=True),
            sa.Column('result', sa.Text(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('input_files', sa.Text(), nullable=True),
            sa.Column('output_files', sa.Text(), nullable=True),
            sa.Column('messages', sa.Text(), nullable=True),
            sa.Column('node_data', sa.Text(), nullable=True),
            sa.Column('spec', sa.Text(), nullable=True),
            sa.Column('prompt_tokens', sa.Integer(), nullable=False),
            sa.Column('completion_tokens', sa.Integer(), nullable=False),
            sa.Column('retry_count', sa.Integer(), nullable=False),
            sa.Column('max_retries', sa.Integer(), nullable=False),
            sa.Column('timeout_seconds', sa.Integer(), nullable=False),
            sa.Column('started_at', sa.String(), nullable=True),
            sa.Column('completed_at', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )

    # ── Add new columns to existing 'tasks' table (idempotent) ──
    existing_cols = {row[1] for row in conn.execute(sa.text("PRAGMA table_info(tasks)")).fetchall()}
    new_cols = {
        'project_id': sa.Column('project_id', sa.String(length=36), nullable=True),
        'user_id': sa.Column('user_id', sa.String(length=36), nullable=True),
        'parent_task_id': sa.Column('parent_task_id', sa.String(length=36), nullable=True),
        'name': sa.Column('name', sa.String(length=255), nullable=True),
        'spec': sa.Column('spec', sa.Text(), nullable=True),
        'depends_on': sa.Column('depends_on', sa.Text(), nullable=True),
        'assigned_agent': sa.Column('assigned_agent', sa.String(length=36), nullable=True),
        'total_jobs': sa.Column('total_jobs', sa.Integer(), nullable=False, server_default='0'),
        'completed_jobs': sa.Column('completed_jobs', sa.Integer(), nullable=False, server_default='0'),
        'total_tokens': sa.Column('total_tokens', sa.Integer(), nullable=False, server_default='0'),
        'total_cost': sa.Column('total_cost', sa.Float(), nullable=False, server_default='0.0'),
    }
    cols_to_add = {k: v for k, v in new_cols.items() if k not in existing_cols}
    if cols_to_add:
        with op.batch_alter_table('tasks', schema=None) as batch_op:
            for col_name, col_def in cols_to_add.items():
                batch_op.add_column(col_def)


def downgrade() -> None:
    """Remove core business tables and columns."""
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        for col in ['project_id', 'user_id', 'parent_task_id', 'name', 'spec',
                    'depends_on', 'assigned_agent', 'total_jobs', 'completed_jobs',
                    'total_tokens', 'total_cost']:
            batch_op.drop_column(col)

    op.drop_table('jobs')
    op.drop_table('projects')
    with op.batch_alter_table('agent_instances', schema=None) as batch_op:
        batch_op.drop_index('idx_agent_instances_user_id')
    op.drop_table('agent_instances')
    op.drop_table('agent_types')
