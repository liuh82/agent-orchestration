"""add_settings_notifications

Revision ID: fe0f015c0d18
Revises: c5542451f4d8
Create Date: 2026-03-15 12:57:02.810333

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'fe0f015c0d18'
down_revision: Union[str, Sequence[str], None] = 'c5542451f4d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add system_settings and notification_channels tables (idempotent)."""
    conn = op.get_bind()
    existing = inspect(conn).get_table_names()

    if 'system_settings' not in existing:
        op.create_table('system_settings',
            sa.Column('key', sa.String(length=100), nullable=False),
            sa.Column('value', sa.Text(), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('updated_by', sa.String(length=36), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
            sa.PrimaryKeyConstraint('key'),
        )

    if 'notification_channels' not in existing:
        op.create_table('notification_channels',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=True),
            sa.Column('channel_type', sa.String(length=50), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('config', sa.Text(), nullable=False),
            sa.Column('triggers', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )


def downgrade() -> None:
    """Remove system_settings and notification_channels tables."""
    op.drop_table('notification_channels')
    op.drop_table('system_settings')
