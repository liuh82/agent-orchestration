"""add_spec_artifacts_table

Revision ID: 40d5f4647581
Revises:
Create Date: 2026-03-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: "40d5f4647581"
down_revision: None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "spec_artifacts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), nullable=True, index=True),
        sa.Column("change_id", sa.String(36), nullable=True, index=True),
        sa.Column("artifact_type", sa.String(50), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("constraints", sa.Text(), nullable=True),
        sa.Column("success_criteria", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("parent_artifact_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("spec_artifacts")
