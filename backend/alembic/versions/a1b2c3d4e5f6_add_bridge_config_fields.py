"""add bridge config fields

Revision ID: a1b2c3d4e5f6
Revises: fe0f015c0d18
Create Date: 2026-03-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '50b946bf2ad2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('gateway_bridges', sa.Column('name', sa.String(255), nullable=True))
    op.add_column('gateway_bridges', sa.Column('bridge_type', sa.String(20), nullable=True))
    op.add_column('gateway_bridges', sa.Column('host', sa.String(255), nullable=True))
    op.add_column('gateway_bridges', sa.Column('port', sa.Integer(), nullable=True))
    op.add_column('gateway_bridges', sa.Column('protocol', sa.String(20), nullable=True))
    op.add_column('gateway_bridges', sa.Column('auth_config', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('gateway_bridges', 'auth_config')
    op.drop_column('gateway_bridges', 'protocol')
    op.drop_column('gateway_bridges', 'port')
    op.drop_column('gateway_bridges', 'host')
    op.drop_column('gateway_bridges', 'bridge_type')
    op.drop_column('gateway_bridges', 'name')
