"""Add jti column to user_session_tokens

Revision ID: 50b946bf2ad2
Revises: d0231a717f77
Create Date: 2026-03-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "50b946bf2ad2"
down_revision: Union[str, Sequence[str], None] = "d0231a717f77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_session_tokens", sa.Column("jti", sa.String(36), nullable=True))
    op.create_index("idx_session_tokens_jti", "user_session_tokens", ["jti"])


def downgrade() -> None:
    op.drop_index("idx_session_tokens_jti")
    op.drop_column("user_session_tokens", "jti")
