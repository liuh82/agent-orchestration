"""Job ORM model."""
from sqlalchemy import String, Integer, Float, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    task_id: Mapped[str] = mapped_column(String(36), nullable=False)
    project_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    agent_inst_id: Mapped[str | None] = mapped_column(String(36))

    name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    priority: Mapped[str] = mapped_column(String(20), default="medium")

    # Execution content
    prompt: Mapped[str | None] = mapped_column(Text)
    action_params: Mapped[str | None] = mapped_column(Text)  # JSON
    result: Mapped[str | None] = mapped_column(Text)  # JSON
    error_message: Mapped[str | None] = mapped_column(Text)
    input_files: Mapped[str | None] = mapped_column(Text)  # JSON array
    output_files: Mapped[str | None] = mapped_column(Text)  # JSON array
    messages: Mapped[str | None] = mapped_column(Text)  # JSON
    node_data: Mapped[str | None] = mapped_column(Text)  # JSON
    spec: Mapped[str | None] = mapped_column(Text)

    # Token statistics
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)

    # Retry
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)

    # Timeout
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=300)

    started_at: Mapped[str | None] = mapped_column(String)
    completed_at: Mapped[str | None] = mapped_column(String)
