"""AgentConfigFile ORM model."""
from typing import Optional

from sqlalchemy import String, Boolean, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class AgentConfigFile(Base, TimestampMixin):
    __tablename__ = "agent_config_files"
    __table_args__ = (
        Index("idx_agent_config_project_type", "project_id", "config_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False)
    agent_type_id: Mapped[Optional[str]] = mapped_column(String(36))
    config_type: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text)
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
