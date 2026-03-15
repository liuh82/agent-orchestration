"""WorkflowExecution and WorkflowNodeExecution ORM models."""
from typing import Optional

from sqlalchemy import String, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class WorkflowExecution(Base, TimestampMixin):
    __tablename__ = "workflow_executions"
    __table_args__ = (
        Index("idx_wf_exec_status", "status"),
        Index("idx_wf_exec_workflow_id", "workflow_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workflow_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("workflows.id"))
    template_id: Mapped[Optional[str]] = mapped_column(String(36))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    current_node_id: Mapped[Optional[str]] = mapped_column(String(100))
    input_params: Mapped[Optional[str]] = mapped_column(Text)
    output_data: Mapped[Optional[str]] = mapped_column(Text)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)
    created_by: Mapped[Optional[str]] = mapped_column(String(36))


class WorkflowNodeExecution(Base):
    __tablename__ = "workflow_node_executions"
    __table_args__ = (
        Index("idx_node_exec_execution_id", "execution_id"),
        Index("idx_node_exec_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    execution_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflow_executions.id"), nullable=False)
    node_id: Mapped[str] = mapped_column(String(100), nullable=False)
    node_type: Mapped[str] = mapped_column(String(50), nullable=False)
    node_config: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    input_data: Mapped[Optional[str]] = mapped_column(Text)
    output_data: Mapped[Optional[str]] = mapped_column(Text)
    agent_id: Mapped[Optional[str]] = mapped_column(String(36))
    task_id: Mapped[Optional[str]] = mapped_column(String(36))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[str]] = mapped_column(String)
    completed_at: Mapped[Optional[str]] = mapped_column(String)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)
