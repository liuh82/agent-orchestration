"""Task ORM model — maps to 'tasks' table (shared with legacy orm_models)."""
from typing import Optional

from sqlalchemy import String, Integer, Float, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class NexusTask(Base, TimestampMixin):
    """Nexus task model. Named NexusTask to avoid registry collision with legacy Task."""
    __tablename__ = "tasks"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    parent_task_id: Mapped[Optional[str]] = mapped_column(String(36))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), default="")  # legacy column
    description: Mapped[Optional[str]] = mapped_column(Text)
    spec: Mapped[Optional[str]] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    depends_on: Mapped[Optional[str]] = mapped_column(Text)
    assigned_agent: Mapped[Optional[str]] = mapped_column(String(36))
    workflow_id: Mapped[Optional[str]] = mapped_column(String(36))
    workflow_snapshot: Mapped[Optional[str]] = mapped_column(Text)  # JSON: workflow definition snapshot at creation
    schedule_type: Mapped[Optional[str]] = mapped_column(String(20))  # once / cron / interval
    schedule_config: Mapped[Optional[str]] = mapped_column(Text)  # JSON: {"cron": "..."} or {"interval_seconds": N}

    total_jobs: Mapped[int] = mapped_column(Integer, default=0)
    completed_jobs: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)

    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)
