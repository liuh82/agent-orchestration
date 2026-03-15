"""Project v1 router."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.schemas.common import success_response, error_response, paged_response

router = APIRouter()


def _to_project_out(p: Project) -> dict:
    return ProjectOut(
        id=p.id, user_id=p.user_id, name=p.name, description=p.description,
        spec=p.spec, workflow_id=p.workflow_id, status=p.status,
        total_tasks=p.total_tasks, completed_tasks=p.completed_tasks,
        total_tokens=p.total_tokens, total_cost=p.total_cost,
        created_at=p.created_at or "", updated_at=p.updated_at or "",
    ).model_dump()


# ── GET /projects ──────────────────────────────────────────


@router.get("")
def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    search: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Project).filter(Project.user_id == user.id)
    if search:
        query = query.filter(Project.name.ilike(f"%{search}%"))

    total = query.count()
    order_col = getattr(Project, sort_by, Project.created_at)
    query = query.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return paged_response(
        [_to_project_out(p) for p in items], total, page, page_size
    )


# ── POST /projects ─────────────────────────────────────────


@router.post("")
def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check quota
    count = db.query(Project).filter(Project.user_id == user.id).count()
    if count >= user.max_projects:
        return error_response(403, f"Project quota exceeded ({user.max_projects})")

    project = Project(
        user_id=user.id,
        name=body.name,
        description=body.description,
        spec=body.spec,
        workflow_id=body.workflow_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return success_response(_to_project_out(project), "Project created")


# ── GET /projects/:id ──────────────────────────────────────


@router.get("/{project_id}")
def get_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == user.id
    ).first()
    if not project:
        return error_response(404, "Project not found")

    return success_response(_to_project_out(project))


# ── PUT /projects/:id ──────────────────────────────────────


@router.put("/{project_id}")
def update_project(
    project_id: str,
    body: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == user.id
    ).first()
    if not project:
        return error_response(404, "Project not found")

    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    if body.spec is not None:
        project.spec = body.spec
    if body.status is not None:
        project.status = body.status

    db.commit()
    db.refresh(project)
    return success_response(_to_project_out(project), "Project updated")


# ── DELETE /projects/:id (archive) ────────────────────────


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == user.id
    ).first()
    if not project:
        return error_response(404, "Project not found")

    project.status = "archived"
    db.commit()
    return success_response(None, "Project archived")
