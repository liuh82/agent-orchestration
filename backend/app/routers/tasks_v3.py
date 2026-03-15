"""V3 task router — task tree query, human intervention, batch actions."""
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.task import NexusTask
from app.models.project import Project
from app.models.job import Job
from app.models.agent_instance import AgentInstance
from app.models.human_intervention import HumanIntervention
from app.models.task_file import TaskFile
from app.schemas.common import success_response, error_response

router = APIRouter()


# ── Helpers ─────────────────────────────────────────────────


def _parse_json(val: Optional[str]):
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── GET /tree ───────────────────────────────────────────────


@router.get("/tree")
def task_tree(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Three-level task tree: projects → tasks → agent_executions + interventions."""
    # 1. Get user's projects
    proj_query = db.query(Project)
    if user.role != "admin":
        proj_query = proj_query.filter(Project.user_id == user.id)
    projects = proj_query.all()

    if not projects:
        return success_response([])

    project_ids = [p.id for p in projects]

    # 2. Batch-load all tasks for these projects
    tasks = (
        db.query(NexusTask)
        .filter(NexusTask.project_id.in_(project_ids))
        .order_by(NexusTask.created_at.desc())
        .all()
    )
    task_ids = [t.id for t in tasks]

    # 3. Batch-load jobs (agent_executions) grouped by task_id
    jobs = (
        db.query(Job)
        .filter(Job.task_id.in_(task_ids))
        .order_by(Job.created_at.asc())
        .all()
    )
    jobs_by_task: Dict[str, List[Job]] = {}
    for j in jobs:
        jobs_by_task.setdefault(j.task_id, []).append(j)

    # 4. Batch-load agent instances
    agent_ids = set()
    for j in jobs:
        if j.agent_inst_id:
            agent_ids.add(j.agent_inst_id)
    agents_map = {}
    if agent_ids:
        for a in db.query(AgentInstance).filter(AgentInstance.id.in_(agent_ids)).all():
            agents_map[a.id] = a

    # 5. Batch-load human interventions for pending_human tasks
    pending_human_tasks = {t.id for t in tasks if t.status == "pending_human"}
    interventions_map: Dict[str, HumanIntervention] = {}
    if pending_human_tasks:
        for hi in db.query(HumanIntervention).filter(
            HumanIntervention.task_id.in_(pending_human_tasks),
            HumanIntervention.status == "pending",
        ).all():
            interventions_map[hi.task_id] = hi

    # 6. Batch-load task output files
    output_files = (
        db.query(TaskFile)
        .filter(TaskFile.task_id.in_(task_ids), TaskFile.file_type == "output")
        .all()
    )
    output_files_by_task: Dict[str, List[TaskFile]] = {}
    for f in output_files:
        output_files_by_task.setdefault(f.task_id, []).append(f)

    # 7. Build response
    result = []
    for project in projects:
        proj_tasks = [t for t in tasks if t.project_id == project.id]

        # Task stats
        stats: Dict[str, int] = {
            "running": 0, "completed": 0, "failed": 0,
            "pending": 0, "paused": 0, "pending_human": 0,
        }
        for t in proj_tasks:
            stats[t.status] = stats.get(t.status, 0) + 1

        task_list = []
        for t in proj_tasks:
            # Agent executions
            task_jobs = jobs_by_task.get(t.id, [])
            agent_execs = []
            for j in task_jobs:
                agent = agents_map.get(j.agent_inst_id)
                exec_files = [
                    {"file_id": f.id, "file_name": f.file_name, "file_type": f.file_type}
                    for f in output_files_by_task.get(t.id, [])
                    if f.file_type == "output"
                ]
                agent_execs.append({
                    "agent_id": j.agent_inst_id,
                    "agent_name": agent.name if agent else None,
                    "status": j.status,
                    "error_message": j.error_message,
                    "output_files": exec_files,
                    "started_at": j.started_at,
                    "completed_at": j.completed_at,
                })

            # Human intervention (only for pending_human tasks)
            intervention = None
            if t.status == "pending_human" and t.id in interventions_map:
                hi = interventions_map[t.id]
                intervention = {
                    "id": hi.id,
                    "status": hi.status,
                    "context": _parse_json(hi.context),
                    "comment": hi.comment,
                    "created_at": hi.created_at,
                }

            # Primary agent info
            primary_agent = None
            if task_jobs:
                first_job = task_jobs[0]
                agent = agents_map.get(first_job.agent_inst_id)
                if agent:
                    primary_agent = {
                        "id": agent.id,
                        "name": agent.name,
                        "status": agent.status,
                        "model": agent.model,
                    }

            task_list.append({
                "id": t.id,
                "title": t.title or t.name,
                "description": t.description,
                "status": t.status,
                "priority": t.priority,
                "agent": primary_agent,
                "progress": _calc_progress(t),
                "started_at": t.started_at,
                "completed_at": t.completed_at,
                "created_at": t.created_at,
                "agent_executions": agent_execs,
                "human_intervention": intervention,
            })

        result.append({
            "project_id": project.id,
            "project_name": project.name,
            "project_status": project.status,
            "task_stats": stats,
            "tasks": task_list,
        })

    return success_response(result)


def _calc_progress(task: NexusTask) -> int:
    """Calculate progress percentage based on status."""
    if task.status == "completed":
        return 100
    if task.status in ("pending", "pending_human", "cancelled"):
        return 0
    if task.total_jobs > 0:
        return int(task.completed_jobs / task.total_jobs * 100)
    return 0


# ── POST /approve ──────────────────────────────────────────


class InterventionAction(BaseModel):
    comment: Optional[str] = None


@router.post("/{task_id}/approve")
def approve_task(
    task_id: str,
    body: InterventionAction,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve a pending human intervention, resume task to running."""
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")
    if task.status != "pending_human":
        return error_response(400, f"Task is not pending human review (status: {task.status})")

    intervention = db.query(HumanIntervention).filter(
        HumanIntervention.task_id == task_id,
        HumanIntervention.status == "pending",
    ).first()
    if not intervention:
        return error_response(404, "No pending intervention found")

    intervention.status = "approved"
    intervention.decision = "approved"
    intervention.comment = body.comment
    intervention.decided_by = user.id
    intervention.decided_at = _now_iso()

    task.status = "running"
    task.updated_at = _now_iso()
    db.commit()

    return success_response(None, "Task approved and resumed")


# ── POST /reject ───────────────────────────────────────────


class RejectAction(BaseModel):
    comment: Optional[str] = None
    attachment_ids: Optional[List[str]] = None


@router.post("/{task_id}/reject")
def reject_task(
    task_id: str,
    body: RejectAction,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reject a pending human intervention."""
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")
    if task.status != "pending_human":
        return error_response(400, f"Task is not pending human review (status: {task.status})")

    intervention = db.query(HumanIntervention).filter(
        HumanIntervention.task_id == task_id,
        HumanIntervention.status == "pending",
    ).first()
    if not intervention:
        return error_response(404, "No pending intervention found")

    intervention.status = "rejected"
    intervention.decision = "rejected"
    intervention.comment = body.comment
    intervention.attachment_paths = json.dumps(body.attachment_ids) if body.attachment_ids else None
    intervention.decided_by = user.id
    intervention.decided_at = _now_iso()

    task.status = "failed"
    task.error_message = "Rejected by user: " + (body.comment or "no comment")
    task.updated_at = _now_iso()
    db.commit()

    return success_response(None, "Task rejected")


# ── GET /pending-interventions ─────────────────────────────


@router.get("/pending-interventions")
def pending_interventions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all pending human interventions."""
    interventions = (
        db.query(HumanIntervention)
        .filter(HumanIntervention.status == "pending")
        .order_by(HumanIntervention.created_at.desc())
        .all()
    )

    items = []
    for hi in interventions:
        task = db.query(NexusTask).filter(NexusTask.id == hi.task_id).first()
        items.append({
            "id": hi.id,
            "task_id": hi.task_id,
            "task_title": task.title or task.name if task else None,
            "task_status": task.status if task else None,
            "workflow_execution_id": hi.workflow_execution_id,
            "node_id": hi.node_id,
            "status": hi.status,
            "context": _parse_json(hi.context),
            "comment": hi.comment,
            "created_at": hi.created_at,
        })

    return success_response(items)


# ── POST /batch-action ─────────────────────────────────────


class BatchActionRequest(BaseModel):
    task_ids: List[str]
    action: str  # "pause" | "cancel"


@router.post("/batch-action")
def batch_action(
    body: BatchActionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Batch pause or cancel tasks."""
    if body.action not in ("pause", "cancel"):
        return error_response(400, "Action must be 'pause' or 'cancel'")

    allowed_transitions = {
        "pause": {"running"},
        "cancel": {"pending", "running", "paused", "failed"},
    }
    new_status = body.action

    success_ids = []
    failed_ids = []

    for tid in body.task_ids:
        try:
            task = db.query(NexusTask).filter(NexusTask.id == tid).first()
            if not task:
                failed_ids.append(tid)
                continue

            if task.status not in allowed_transitions[new_status]:
                failed_ids.append(tid)
                continue

            task.status = new_status
            task.updated_at = _now_iso()
            if new_status == "cancelled":
                task.completed_at = _now_iso()
            success_ids.append(tid)
        except Exception:
            failed_ids.append(tid)

    if success_ids:
        db.commit()

    return success_response({
        "success_count": len(success_ids),
        "failed_count": len(failed_ids),
        "failed_ids": failed_ids,
    })
