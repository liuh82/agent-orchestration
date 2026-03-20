"""Spec 路由 — spec artifact 管理系统。

提供 spec/plan/review/verify 各阶段 artifact 的 CRUD API。
"""
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.base import generate_uuid
from app.models.spec_artifact import SpecArtifact
from app.schemas.common import success_response, error_response

router = APIRouter(tags=["spec"])


# ---- Schemas ----

class CreateChangeRequest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=36)
    description: str = Field(default="", max_length=500)


class AddArtifactRequest(BaseModel):
    artifact_type: str = Field(..., pattern=r"^(constraint_set|plan|review|verification)$")
    content: dict = Field(..., description="JSON 格式的 artifact 内容")
    constraints: list = Field(default=[], description="约束列表快照")
    success_criteria: list = Field(default=[], description="成功判据快照")
    parent_artifact_id: str | None = None


# ---- API ----

@router.post("/changes")
def create_change(
    req: CreateChangeRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """创建变更批次。"""
    change_id = generate_uuid()
    artifact = SpecArtifact(
        id=generate_uuid(),
        project_id=req.project_id,
        change_id=change_id,
        artifact_type="constraint_set",
        content=json.dumps({"description": req.description}, ensure_ascii=False),
        constraints="[]",
        success_criteria="[]",
        status="draft",
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return success_response(_artifact_to_dict(artifact))


@router.get("/changes")
def list_changes(
    project_id: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """列出变更批次。"""
    query = db.query(SpecArtifact).order_by(SpecArtifact.created_at.desc())
    if project_id:
        query = query.filter(SpecArtifact.project_id == project_id)

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "code": 0,
        "data": {
            "items": [_artifact_to_dict(a) for a in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        },
        "message": "success",
    }


@router.get("/changes/{change_id}")
def get_change(
    change_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """获取变更详情（含所有 artifact）。"""
    artifacts = db.query(SpecArtifact).filter(
        SpecArtifact.change_id == change_id
    ).order_by(SpecArtifact.created_at).all()

    if not artifacts:
        raise HTTPException(status_code=404, detail="Change not found")

    return success_response({
        "change_id": change_id,
        "artifacts": [_artifact_to_dict(a) for a in artifacts],
    })


@router.post("/changes/{change_id}/artifacts")
def add_artifact(
    change_id: str,
    req: AddArtifactRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """为变更添加 artifact。"""
    # 验证变更存在
    existing = db.query(SpecArtifact).filter(
        SpecArtifact.change_id == change_id
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Change not found")

    artifact = SpecArtifact(
        id=generate_uuid(),
        project_id=existing.project_id,
        change_id=change_id,
        artifact_type=req.artifact_type,
        content=json.dumps(req.content, ensure_ascii=False),
        constraints=json.dumps(req.constraints, ensure_ascii=False),
        success_criteria=json.dumps(req.success_criteria, ensure_ascii=False),
        status="draft",
        parent_artifact_id=req.parent_artifact_id,
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return success_response(_artifact_to_dict(artifact))


@router.get("/changes/{change_id}/artifacts")
def list_artifacts(
    change_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """列出变更的所有 artifact。"""
    artifacts = db.query(SpecArtifact).filter(
        SpecArtifact.change_id == change_id
    ).order_by(SpecArtifact.created_at).all()
    return success_response([_artifact_to_dict(a) for a in artifacts])


@router.post("/changes/{change_id}/archive")
def archive_change(
    change_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """归档变更。"""
    count = db.query(SpecArtifact).filter(
        SpecArtifact.change_id == change_id,
        SpecArtifact.status != "archived",
    ).update({"status": "archived"})

    if count == 0:
        raise HTTPException(status_code=404, detail="Change not found or already archived")

    db.commit()
    return success_response({"change_id": change_id, "archived_count": count})


# ---- Helper ----

def _artifact_to_dict(a: SpecArtifact) -> dict:
    """将 ORM 对象转换为 API 响应字典。"""
    return {
        "id": a.id,
        "project_id": a.project_id,
        "change_id": a.change_id,
        "artifact_type": a.artifact_type,
        "content": json.loads(a.content) if a.content else None,
        "constraints": json.loads(a.constraints) if a.constraints else [],
        "success_criteria": json.loads(a.success_criteria) if a.success_criteria else [],
        "status": a.status,
        "parent_artifact_id": a.parent_artifact_id,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }
