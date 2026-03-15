"""Task v1 router — nested under projects."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.project import Project
from app.models.task import NexusTask as Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.schemas.common import success_response, error_response, paged_response

router = APIRouter()


def _parse_json(val: Optional[str]) -> Optional:
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _to_task_out(t: Task) -> dict:
    return TaskOut(
        id=t.id, project_id=t.project_id, user_id=t.user_id,
        parent_task_id=t.parent_task_id, name=t.name, description=t.description,
        spec=t.spec, priority=t.priority, status=t.status,
        depends_on=_parse_json(t.depends_on), assigned_agent=t.assigned_agent,
        total_jobs=t.total_jobs, completed_jobs=t.completed_jobs,
        total_tokens=t.total_tokens, total_cost=t.total_cost,
        started_at=t.started_at, completed_at=t.completed_at,
        created_at=t.created_at or "", updated_at=t.updated_at or "",
    ).model_dump()


def _get_project(project_id: str, user_id: str, db: Session) -> Project:
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == user_id
    ).first()
    if not project:
        raise _project_not_found()


def _project_not_found():
    from fastapi import HTTPException
    return HTTPException(status_code=404, detail="Project not found")


# ── GET /projects/:pid/tasks ──────────────────────────────


@router.get("")
def list_tasks(
    project_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    search: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == user.id
    ).first()
    if not project:
        return error_response(404, "Project not found")

    query = db.query(Task).filter(Task.project_id == project_id)
    if search:
        query = query.filter(Task.name.ilike(f"%{search}%"))

    total = query.count()
    order_col = getattr(Task, sort_by, Task.created_at)
    query = query.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return paged_response(
        [_to_task_out(t) for t in items], total, page, page_size
    )


# ── POST /projects/:pid/tasks ─────────────────────────────


@router.post("")
def create_task(
    project_id: str,
    body: TaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == user.id
    ).first()
    if not project:
        return error_response(404, "Project not found")

    # Check task quota
    task_count = db.query(Task).filter(Task.user_id == user.id).count()
    if task_count >= user.max_tasks:
        return error_response(403, f"Task quota exceeded ({user.max_tasks})")

    task = Task(
        project_id=project_id,
        user_id=user.id,
        name=body.name,
        description=body.description,
        spec=body.spec,
        priority=body.priority,
        depends_on=json.dumps(body.depends_on) if body.depends_on else None,
        assigned_agent=body.assigned_agent,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Update project stats
    project.total_tasks += 1
    db.commit()

    return success_response(_to_task_out(task), "Task created")


# ── GET /tasks/:id ─────────────────────────────────────────


@router.get("/{task_id}")
def get_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(
        Task.id == task_id, Task.user_id == user.id
    ).first()
    if not task:
        return error_response(404, "Task not found")

    return success_response(_to_task_out(task))


# ── PUT /tasks/:id ─────────────────────────────────────────


@router.put("/{task_id}")
def update_task(
    task_id: str,
    body: TaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(
        Task.id == task_id, Task.user_id == user.id
    ).first()
    if not task:
        return error_response(404, "Task not found")

    if body.name is not None:
        task.name = body.name
    if body.description is not None:
        task.description = body.description
    if body.spec is not None:
        task.spec = body.spec
    if body.priority is not None:
        task.priority = body.priority
    if body.status is not None:
        task.status = body.status
    if body.depends_on is not None:
        task.depends_on = json.dumps(body.depends_on)
    if body.assigned_agent is not None:
        task.assigned_agent = body.assigned_agent

    db.commit()
    db.refresh(task)
    return success_response(_to_task_out(task), "Task updated")


# ── DELETE /tasks/:id ──────────────────────────────────────


@router.delete("/{task_id}")
def delete_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(
        Task.id == task_id, Task.user_id == user.id
    ).first()
    if not task:
        return error_response(404, "Task not found")

    # Update project stats
    project = db.query(Project).filter(Project.id == task.project_id).first()
    if project:
        project.total_tasks = max(0, project.total_tasks - 1)

    db.delete(task)
    db.commit()
    return success_response(None, "Task deleted")
