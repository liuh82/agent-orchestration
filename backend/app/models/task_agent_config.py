"""TaskAgentConfig ORM model — per-task workflow node config overrides."""
from typing import Optional

from sqlalchemy import String, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class TaskAgentConfig(Base, TimestampMixin):
    __tablename__ = "task_agent_configs"
    __table_args__ = (
        Index("idx_task_agent_configs_task_id", "task_id"),
        Index("idx_task_agent_configs_node_id", "workflow_node_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"), nullable=False)
    workflow_node_id: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_type_id: Mapped[Optional[str]] = mapped_column(String(36))
    config_override: Mapped[Optional[str]] = mapped_column(Text)  # JSON
