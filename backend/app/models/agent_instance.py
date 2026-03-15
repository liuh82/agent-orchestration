"""AgentInstance ORM model."""
from sqlalchemy import String, Boolean, Integer, Float, Text, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class AgentInstance(Base, TimestampMixin):
    __tablename__ = "agent_instances"
    __table_args__ = (
        Index("idx_agent_instances_user_id", "user_id"),
        UniqueConstraint("user_id", "name", name="uq_user_agent_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    type_id: Mapped[str] = mapped_column(String(36), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="offline")  # online/offline/busy/error
    model: Mapped[str | None] = mapped_column(String(100))
    config: Mapped[str | None] = mapped_column(Text)  # JSON

    # Statistics
    task_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    failed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[str | None] = mapped_column(String)
