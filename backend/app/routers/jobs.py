"""Job v1 router — nested under tasks."""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.job import Job
from app.models.task import NexusTask as Task
from app.models.user import User
from app.schemas.job import JobOut
from app.schemas.common import success_response, error_response, paged_response

router = APIRouter()


def _parse_json(val: Optional[str]) -> Optional:
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _to_job_out(j: Job) -> dict:
    return JobOut(
        id=j.id, task_id=j.task_id, project_id=j.project_id, user_id=j.user_id,
        agent_inst_id=j.agent_inst_id, name=j.name, status=j.status,
        priority=j.priority, prompt=j.prompt,
        action_params=_parse_json(j.action_params),
        result=_parse_json(j.result),
        error_message=j.error_message,
        input_files=_parse_json(j.input_files),
        output_files=_parse_json(j.output_files),
        messages=_parse_json(j.messages),
        node_data=_parse_json(j.node_data),
        spec=j.spec,
        prompt_tokens=j.prompt_tokens, completion_tokens=j.completion_tokens,
        retry_count=j.retry_count, max_retries=j.max_retries,
        timeout_seconds=j.timeout_seconds,
        started_at=j.started_at, completed_at=j.completed_at,
        created_at=j.created_at or "", updated_at=j.updated_at or "",
    ).model_dump()


def _get_task_ownership(task_id: str, user_id: str, db: Session) -> Task:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if not task:
        raise ValueError("Task not found")
    return task


# ── GET /tasks/:tid/jobs ──────────────────────────────────


@router.get("")
def list_jobs(
    task_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(
        Task.id == task_id, Task.user_id == user.id
    ).first()
    if not task:
        return error_response(404, "Task not found")

    total = db.query(Job).filter(Job.task_id == task_id).count()
    items = (
        db.query(Job)
        .filter(Job.task_id == task_id)
        .order_by(Job.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return paged_response(
        [_to_job_out(j) for j in items], total, page, page_size
    )


# ── GET /jobs/:id ──────────────────────────────────────────


@router.get("/{job_id}")
def get_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == user.id
    ).first()
    if not job:
        return error_response(404, "Job not found")

    return success_response(_to_job_out(job))


# ── POST /jobs/:id/retry ──────────────────────────────────


@router.post("/{job_id}/retry")
def retry_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == user.id
    ).first()
    if not job:
        return error_response(404, "Job not found")

    if job.retry_count >= job.max_retries:
        return error_response(400, f"Max retries exceeded ({job.max_retries})")

    job.retry_count += 1
    job.status = "pending"
    job.error_message = None
    job.started_at = None
    job.completed_at = None
    db.commit()
    db.refresh(job)

    return success_response(_to_job_out(job), "Job retried")


# ── POST /jobs/:id/approve ────────────────────────────────


@router.post("/{job_id}/approve")
def approve_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == user.id
    ).first()
    if not job:
        return error_response(404, "Job not found")

    job.status = "approved"
    job.completed_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(job)

    return success_response(_to_job_out(job), "Job approved")


# ── POST /jobs/:id/reject ─────────────────────────────────


@router.post("/{job_id}/reject")
def reject_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == user.id
    ).first()
    if not job:
        return error_response(404, "Job not found")

    job.status = "rejected"
    job.completed_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(job)

    return success_response(_to_job_out(job), "Job rejected")
