"""Project ORM model."""
from typing import Optional

from sqlalchemy import String, Integer, Float, Text, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_project_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    spec: Mapped[Optional[str]] = mapped_column(Text)  # Markdown/YAML
    workflow_id: Mapped[Optional[str]] = mapped_column(String(36))  # FK to workflows
    status: Mapped[str] = mapped_column(String(20), default="active")

    config_overrides: Mapped[Optional[str]] = mapped_column(Text)  # JSON: workflow node config overrides

    total_tasks: Mapped[int] = mapped_column(Integer, default=0)
    completed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)

    # Git related fields
    git_repo_url: Mapped[Optional[str]] = mapped_column(String(500))
    git_default_branch: Mapped[Optional[str]] = mapped_column(String(100))
    git_auto_merge: Mapped[bool] = mapped_column(Boolean, default=False)
