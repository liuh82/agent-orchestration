"""SpecArtifact ORM 模型 — spec artifact 生命周期管理。

管理 OPSX 流程各阶段（spec/plan/review/verify）产出的 artifact，
关联项目和变更批次。
"""
from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class SpecArtifact(Base, TimestampMixin):
    """Spec Artifact — OPSX 各阶段的产出物。"""

    __tablename__ = "spec_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    change_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    artifact_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="类型: constraint_set / plan / review / verification",
    )
    content: Mapped[Optional[str]] = mapped_column(Text, comment="JSON 格式的完整内容")
    constraints: Mapped[Optional[str]] = mapped_column(Text, comment="JSON: 约束列表快照")
    success_criteria: Mapped[Optional[str]] = mapped_column(Text, comment="JSON: 成功判据快照")
    status: Mapped[str] = mapped_column(
        String(20), default="draft",
        comment="draft / approved / archived",
    )
    parent_artifact_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
