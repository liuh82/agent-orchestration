"""t10a_task_instantiation_schema

Revision ID: 664eeb429794
Revises: a1b2c3d4e5f6
Create Date: 2026-03-16 23:55:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "664eeb429794"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add config_overrides to projects ──
    op.add_column("projects", sa.Column("config_overrides", sa.Text(), nullable=True))

    # ── Add schedule fields to tasks ──
    op.add_column("tasks", sa.Column("workflow_snapshot", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("schedule_type", sa.String(20), nullable=True))
    op.add_column("tasks", sa.Column("schedule_config", sa.Text(), nullable=True))

    # ── Create task_agent_configs table ──
    op.create_table(
        "task_agent_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("task_id", sa.String(36), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column("workflow_node_id", sa.String(100), nullable=False),
        sa.Column("agent_type_id", sa.String(36), nullable=True),
        sa.Column("config_override", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("idx_task_agent_configs_task_id", "task_agent_configs", ["task_id"])
    op.create_index("idx_task_agent_configs_node_id", "task_agent_configs", ["workflow_node_id"])


def downgrade() -> None:
    op.drop_index("idx_task_agent_configs_node_id", table_name="task_agent_configs")
    op.drop_index("idx_task_agent_configs_task_id", table_name="task_agent_configs")
    op.drop_table("task_agent_configs")
    op.drop_column("tasks", "schedule_config")
    op.drop_column("tasks", "schedule_type")
    op.drop_column("tasks", "workflow_snapshot")
    op.drop_column("projects", "config_overrides")
