"""User ORM model."""
from sqlalchemy import String, Integer, Boolean, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        Index("idx_users_email", "email", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")  # admin / user
    avatar: Mapped[str | None] = mapped_column(String(500))
    settings: Mapped[str | None] = mapped_column(Text)  # JSON string

    # Quotas
    max_agents: Mapped[int] = mapped_column(Integer, default=10)
    max_projects: Mapped[int] = mapped_column(Integer, default=20)
    max_tasks: Mapped[int] = mapped_column(Integer, default=100)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[str | None] = mapped_column(String)
