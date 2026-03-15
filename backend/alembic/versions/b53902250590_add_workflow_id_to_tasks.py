"""add_workflow_id_to_tasks

Revision ID: b53902250590
Revises: fe0f015c0d18
Create Date: 2026-03-15 16:33:15.948760

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b53902250590'
down_revision: Union[str, Sequence[str], None] = 'fe0f015c0d18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add workflow_id column to tasks table."""
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.add_column(sa.Column('workflow_id', sa.String(length=36), nullable=True))


def downgrade() -> None:
    """Remove workflow_id column from tasks table."""
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.drop_column('workflow_id')
