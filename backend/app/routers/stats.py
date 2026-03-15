"""Stats router — dashboard, project, agent, global statistics."""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.agent_instance import AgentInstance
from app.models.job import Job
from app.models.project import Project
from app.models.task import NexusTask as Task
from app.models.user import User
from app.schemas.common import success_response, error_response

router = APIRouter()


def _time_filters(col, days=None):
    """Build filter conditions for today/week/month."""
    filters = []
    now = datetime.now(timezone.utc)
    if days == 1:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        filters.append(col >= start)
    elif days == 7:
        start = (now - timedelta(days=7)).isoformat()
        filters.append(col >= start)
    elif days == 30:
        start = (now - timedelta(days=30)).isoformat()
        filters.append(col >= start)
    return filters


@router.get("/dashboard")
def dashboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = user.id

    # Agents by status
    agent_q = db.query(AgentInstance.status, func.count(AgentInstance.id)).filter(
        AgentInstance.user_id == uid, AgentInstance.is_active == True  # noqa: E712
    ).group_by(AgentInstance.status)
    agents = {"total": 0, "online": 0, "offline": 0, "busy": 0, "error": 0}
    for status, count in agent_q:
        agents["total"] += count
        if status in agents:
            agents[status] = count

    # Projects by status
    proj_q = db.query(Project.status, func.count(Project.id)).filter(
        Project.user_id == uid
    ).group_by(Project.status)
    projects = {"total": 0, "active": 0, "archived": 0}
    for status, count in proj_q:
        projects["total"] += count
        if status in projects:
            projects[status] = count

    # Tasks by status
    task_q = db.query(Task.status, func.count(Task.id)).filter(Task.user_id == uid).group_by(Task.status)
    tasks = {"total": 0, "pending": 0, "running": 0, "completed": 0, "failed": 0}
    for status, count in task_q:
        tasks["total"] += count
        if status in tasks:
            tasks[status] = count

    # Jobs by status
    job_q = db.query(Job.status, func.count(Job.id)).filter(Job.user_id == uid).group_by(Job.status)
    jobs = {"total": 0, "pending": 0, "running": 0, "completed": 0, "failed": 0}
    for status, count in job_q:
        jobs["total"] += count
        if status in jobs:
            jobs[status] = count

    # Token stats from jobs
    all_tokens = db.query(
        func.coalesce(func.sum(Job.prompt_tokens), 0),
        func.coalesce(func.sum(Job.completion_tokens), 0),
    ).filter(Job.user_id == uid).first()
    tokens = {"total": (all_tokens[0] or 0) + (all_tokens[1] or 0)}

    today_tokens = db.query(
        func.coalesce(func.sum(Job.prompt_tokens), 0),
        func.coalesce(func.sum(Job.completion_tokens), 0),
    ).filter(Job.user_id == uid, *(_time_filters(Job.created_at, days=1))).first()
    tokens["today"] = (today_tokens[0] or 0) + (today_tokens[1] or 0)

    week_tokens = db.query(
        func.coalesce(func.sum(Job.prompt_tokens), 0),
        func.coalesce(func.sum(Job.completion_tokens), 0),
    ).filter(Job.user_id == uid, *(_time_filters(Job.created_at, days=7))).first()
    tokens["this_week"] = (week_tokens[0] or 0) + (week_tokens[1] or 0)

    month_tokens = db.query(
        func.coalesce(func.sum(Job.prompt_tokens), 0),
        func.coalesce(func.sum(Job.completion_tokens), 0),
    ).filter(Job.user_id == uid, *(_time_filters(Job.created_at, days=30))).first()
    tokens["this_month"] = (month_tokens[0] or 0) + (month_tokens[1] or 0)

    # Cost (approximate from tokens — no cost_entries for v1 yet)
    cost = {"total": 0, "today": 0, "this_week": 0, "this_month": 0}

    return success_response({
        "agents": agents,
        "projects": projects,
        "tasks": tasks,
        "jobs": jobs,
        "tokens": tokens,
        "cost": cost,
    })


@router.get("/projects/{project_id}")
def project_stats(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.project import Project
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not proj:
        return error_response(404, "Project not found")

    task_count = db.query(func.count(Task.id)).filter(Task.project_id == project_id).scalar()
    job_count = db.query(func.count(Job.id)).filter(Job.project_id == project_id).scalar()
    completed_tasks = db.query(func.count(Task.id)).filter(
        Task.project_id == project_id, Task.status == "completed").scalar()
    total_tokens = db.query(
        func.coalesce(func.sum(Job.prompt_tokens), 0) + func.coalesce(func.sum(Job.completion_tokens), 0)
    ).filter(Job.project_id == project_id).scalar()

    return success_response({
        "project_id": project_id,
        "name": proj.name,
        "task_count": task_count or 0,
        "completed_tasks": completed_tasks or 0,
        "job_count": job_count or 0,
        "total_tokens": total_tokens or 0,
        "total_cost": proj.total_cost,
    })


@router.get("/agents/{agent_id}")
def agent_stats(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id, AgentInstance.user_id == user.id
    ).first()
    if not inst:
        return error_response(404, "Agent not found")

    return success_response({
        "agent_id": agent_id,
        "name": inst.name,
        "status": inst.status,
        "task_count": inst.task_count,
        "completed_tasks": inst.completed_tasks,
        "failed_tasks": inst.failed_tasks,
        "total_tokens": inst.total_tokens,
        "total_cost": inst.total_cost,
    })


@router.get("/global", tags=["admin-stats"])
def global_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users_count = db.query(func.count(User.id)).scalar()

    agents_count = db.query(func.count(AgentInstance.id)).filter(AgentInstance.is_active == True).scalar()  # noqa: E712
    online_agents = db.query(func.count(AgentInstance.id)).filter(
        AgentInstance.is_active == True, AgentInstance.status == "online"  # noqa: E712
    ).scalar()

    projects_count = db.query(func.count(Project.id)).scalar()

    tasks_count = db.query(func.count(Task.id)).scalar()

    jobs_count = db.query(func.count(Job.id)).scalar()

    total_tokens = db.query(
        func.coalesce(func.sum(Job.prompt_tokens), 0) + func.coalesce(func.sum(Job.completion_tokens), 0)
    ).scalar()

    return success_response({
        "users": users_count,
        "agents": {"total": agents_count or 0, "online": online_agents or 0},
        "projects": projects_count or 0,
        "tasks": tasks_count or 0,
        "jobs": jobs_count or 0,
        "total_tokens": total_tokens or 0,
    })
