"""V1 task router — CRUD + creation with workflow binding, config overrides, scheduling."""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.task import NexusTask
from app.models.project import Project
from app.models.task_agent_config import TaskAgentConfig
from app.models.agent_instance import AgentInstance
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskOut,
    TaskAgentConfigCreate, TaskAgentConfigOut,
)
from app.schemas.common import success_response, error_response, paged_response

logger = logging.getLogger(__name__)
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


def _to_task_out(t: NexusTask, workflow_name: Optional[str] = None, agent_name: Optional[str] = None) -> dict:
    d = TaskOut(
        id=t.id,
        project_id=t.project_id,
        user_id=t.user_id,
        parent_task_id=t.parent_task_id,
        name=t.name,
        title=t.title,
        description=t.description,
        spec=t.spec,
        priority=t.priority,
        status=t.status,
        depends_on=_parse_json(t.depends_on),
        assigned_agent=t.assigned_agent,
        workflow_id=t.workflow_id,
        workflow_snapshot=_parse_json(t.workflow_snapshot),
        schedule_type=t.schedule_type,
        schedule_config=_parse_json(t.schedule_config),
        total_jobs=t.total_jobs,
        completed_jobs=t.completed_jobs,
        total_tokens=t.total_tokens,
        total_cost=t.total_cost,
        started_at=t.started_at,
        completed_at=t.completed_at,
        created_at=t.created_at or "",
        updated_at=t.updated_at or "",
        workflow_name=workflow_name,
        agent_name=agent_name,
    )
    return d.model_dump(exclude_none=True)


# ── GET / (task list — standalone + project-scoped) ─────────


@router.get("/")
def list_tasks(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List tasks. When mounted under /projects/{pid}/tasks, filters by that project.
    Otherwise returns all tasks owned by the user."""
    query = db.query(NexusTask).filter(NexusTask.user_id == user.id)

    # Check if mounted under /projects/{project_id}/tasks
    project_id = request.path_params.get("project_id")
    if project_id:
        query = query.filter(NexusTask.project_id == project_id)
    else:
        # standalone tasks only: tasks whose project_id is a dummy or real project
        # but we return ALL user tasks when called from /api/v1/tasks
        pass

    if status:
        query = query.filter(NexusTask.status == status)

    total = query.count()

    order_col = getattr(NexusTask, sort_by, NexusTask.created_at)
    if not hasattr(order_col, "desc"):
        order_col = NexusTask.created_at
    query = query.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    # Batch-load workflow names and agent names
    task_ids = [t.id for t in items]
    workflow_ids = set(t.workflow_id for t in items if t.workflow_id)
    agent_ids = set(t.assigned_agent for t in items if t.assigned_agent)

    wf_map = {}
    if workflow_ids:
        from app.models.orm_models import Workflow
        for wf in db.query(Workflow).filter(Workflow.id.in_(workflow_ids)).all():
            wf_map[wf.id] = wf.name

    agent_map = {}
    if agent_ids:
        for ag in db.query(AgentInstance).filter(AgentInstance.id.in_(agent_ids)).all():
            agent_map[ag.id] = ag.name

    result = []
    for t in items:
        result.append(_to_task_out(
            t,
            workflow_name=wf_map.get(t.workflow_id),
            agent_name=agent_map.get(t.assigned_agent),
        ))

    return paged_response(result, total, page, page_size)


# ── GET /{task_id} ─────────────────────────────────────────


@router.get("/{task_id}/")
def get_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")

    # Enrich with workflow/agent name
    workflow_name = None
    if task.workflow_id:
        from app.models.orm_models import Workflow
        wf = db.query(Workflow).filter(Workflow.id == task.workflow_id).first()
        if wf:
            workflow_name = wf.name

    agent_name = None
    if task.assigned_agent:
        ag = db.query(AgentInstance).filter(AgentInstance.id == task.assigned_agent).first()
        if ag:
            agent_name = ag.name

    return success_response(_to_task_out(task, workflow_name, agent_name))


# ── POST / (create task — project-scoped OR standalone) ────


@router.post("/")
def create_task(
    request: Request,
    body: TaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a task. When mounted under /projects/{pid}/tasks, task belongs to that project.
    When project_id is in body, task belongs to that project.
    Otherwise creates a standalone task (project_id='')."""
    # Determine project_id: route param > body param
    route_project_id = request.path_params.get("project_id")
    effective_project_id = route_project_id or body.project_id

    # Validate project exists if project_id given
    if effective_project_id:
        project = db.query(Project).filter(Project.id == effective_project_id).first()
        if not project:
            return error_response(404, "Project not found")

    # Validate workflow exists if workflow_id given
    workflow_snapshot = None
    if body.workflow_id:
        from app.models.orm_models import Workflow
        wf = db.query(Workflow).filter(Workflow.id == body.workflow_id).first()
        if not wf:
            return error_response(404, "Workflow not found")
        # Store snapshot of workflow definition
        definition = wf.definition
        if isinstance(definition, str):
            try:
                definition = json.loads(definition)
            except (json.JSONDecodeError, TypeError):
                definition = None
        if definition:
            workflow_snapshot = json.dumps(definition)

    # Build task
    now = _now_iso()
    task = NexusTask(
        project_id=effective_project_id or "",  # must not be null
        user_id=user.id,
        name=body.name,
        description=body.description,
        spec=body.spec,
        priority=body.priority,
        depends_on=json.dumps(body.depends_on) if body.depends_on else None,
        assigned_agent=body.assigned_agent,
        workflow_id=body.workflow_id,
        workflow_snapshot=workflow_snapshot,
    )

    # Schedule
    if body.schedule:
        schedule = body.schedule
        if schedule.type == "immediate":
            task.status = "pending"
        elif schedule.type == "cron":
            task.status = "scheduled"
            task.schedule_type = "cron"
            task.schedule_config = json.dumps({"cron": schedule.cron_expression})
        elif schedule.type == "interval":
            task.status = "scheduled"
            task.schedule_type = "interval"
            task.schedule_config = json.dumps({"interval_seconds": schedule.interval_seconds})
    else:
        task.status = "pending"

    db.add(task)
    db.flush()  # get task.id

    # Create config overrides
    if body.config_overrides:
        for item in body.config_overrides:
            config = TaskAgentConfig(
                task_id=task.id,
                workflow_node_id=item.workflow_node_id,
                agent_type_id=item.agent_type_id,
                config_override=json.dumps(item.config_override),
            )
            db.add(config)

    # Update project task count
    if effective_project_id:
        proj = db.query(Project).filter(Project.id == effective_project_id).first()
        if proj:
            proj.total_tasks = (proj.total_tasks or 0) + 1

    db.commit()
    db.refresh(task)

    # Schedule with APScheduler for non-immediate tasks
    if task.status == "scheduled" and task.schedule_type and task.schedule_config:
        _schedule_task(task, db)

    return success_response(_to_task_out(task), "Task created")


# ── PUT /{task_id} ─────────────────────────────────────────


@router.put("/{task_id}/")
def update_task(
    task_id: str,
    body: TaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
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
    if body.assigned_agent is not None:
        task.assigned_agent = body.assigned_agent
    if body.workflow_id is not None:
        task.workflow_id = body.workflow_id
    if body.depends_on is not None:
        task.depends_on = json.dumps(body.depends_on)

    # Status transition validation
    if body.status is not None:
        ok = _validate_status_transition(task.status, body.status)
        if not ok:
            return error_response(400, f"Invalid transition: {task.status} → {body.status}")
        task.status = body.status
        if body.status == "running":
            task.started_at = _now_iso()
        elif body.status in ("completed", "failed", "cancelled"):
            task.completed_at = _now_iso()

    task.updated_at = _now_iso()
    db.commit()
    db.refresh(task)

    return success_response(_to_task_out(task), "Task updated")


# ── DELETE /{task_id} ──────────────────────────────────────


@router.delete("/{task_id}/")
def delete_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")

    # Remove scheduled job if any
    _unschedule_task(task_id)

    # Update project task count
    if task.project_id:
        proj = db.query(Project).filter(Project.id == task.project_id).first()
        if proj:
            proj.total_tasks = max(0, (proj.total_tasks or 0) - 1)

    db.delete(task)
    db.commit()
    return success_response(None, "Task deleted")


# ── POST /{task_id}/execute ────────────────────────────────


@router.post("/{task_id}/execute")
async def execute_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute a task: trigger workflow engine if bound to a workflow."""
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")

    ok = _validate_status_transition(task.status, "running")
    if not ok:
        return error_response(400, f"Cannot execute task in '{task.status}' status")

    task.status = "running"
    task.started_at = _now_iso()
    task.updated_at = _now_iso()
    db.commit()

    # If task has a workflow, trigger execution
    if task.workflow_id:
        try:
            import asyncio
            from app.services.workflow_engine import workflow_engine

            definition = _parse_json(task.workflow_snapshot)
            if definition:
                nodes = definition.get("nodes", [])
                for n in nodes:
                    n["_all_nodes"] = nodes

                # Apply config overrides
                configs = db.query(TaskAgentConfig).filter(
                    TaskAgentConfig.task_id == task.id
                ).all()
                for cfg in configs:
                    override = _parse_json(cfg.config_override)
                    if override:
                        for node in nodes:
                            if node.get("id") == cfg.workflow_node_id:
                                node.get("config", {}).update(override)

                # Schedule workflow as a background task on the main event loop
                async def _run_workflow():
                    try:
                        logger.info("[execute] Starting workflow for task %s", task.id)
                        await workflow_engine.start(
                            workflow_id=task.workflow_id,
                            definition=definition,
                            input_params={"project_id": task.project_id, "task_id": task.id, "description": task.description or ""},
                            user_id=user.id,
                            db=db,
                            name=task.name,
                        )
                        logger.info("[execute] Workflow completed for task %s", task.id)
                    except Exception as ex:
                        logger.error("[execute] Workflow failed for task %s: %s", task.id, ex, exc_info=True)

                # Execute workflow (await to ensure it runs)
                await _run_workflow()
        except Exception as e:
            logger.error("Failed to trigger workflow for task %s: %s", task_id, e)
            task.status = "failed"
            task.updated_at = _now_iso()
            db.commit()
            return error_response(500, f"Workflow execution failed: {e}")

    return success_response({"task_id": task_id, "status": "running"}, "Task execution started")


# ── POST /{task_id}/pause ──────────────────────────────────


@router.post("/{task_id}/pause")
def pause_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")

    ok = _validate_status_transition(task.status, "paused")
    if not ok:
        return error_response(400, f"Cannot pause task in '{task.status}' status")

    task.status = "paused"
    task.updated_at = _now_iso()
    db.commit()
    return success_response({"task_id": task_id, "status": "paused"}, "Task paused")


# ── POST /{task_id}/resume ─────────────────────────────────


@router.post("/{task_id}/resume")
def resume_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")

    ok = _validate_status_transition(task.status, "running")
    if not ok:
        return error_response(400, f"Cannot resume task in '{task.status}' status")

    task.status = "running"
    task.updated_at = _now_iso()
    db.commit()
    return success_response({"task_id": task_id, "status": "running"}, "Task resumed")


# ── POST /{task_id}/cancel ─────────────────────────────────


@router.post("/{task_id}/cancel")
def cancel_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")

    ok = _validate_status_transition(task.status, "cancelled")
    if not ok:
        return error_response(400, f"Cannot cancel task in '{task.status}' status")

    _unschedule_task(task_id)
    task.status = "cancelled"
    task.completed_at = _now_iso()
    task.updated_at = _now_iso()
    db.commit()
    return success_response({"task_id": task_id, "status": "cancelled"}, "Task cancelled")


# ── Config Override CRUD ───────────────────────────────────


@router.get("/{task_id}/configs")
def list_configs(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")

    configs = db.query(TaskAgentConfig).filter(TaskAgentConfig.task_id == task_id).all()
    items = []
    for c in configs:
        items.append({
            "id": c.id,
            "task_id": c.task_id,
            "workflow_node_id": c.workflow_node_id,
            "agent_type_id": c.agent_type_id,
            "config_override": _parse_json(c.config_override),
            "created_at": c.created_at or "",
            "updated_at": c.updated_at or "",
        })
    return success_response(items)


@router.post("/{task_id}/configs")
def upsert_config(
    task_id: str,
    body: TaskAgentConfigCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
    if not task:
        return error_response(404, "Task not found")

    # Upsert: find existing or create new
    existing = db.query(TaskAgentConfig).filter(
        TaskAgentConfig.task_id == task_id,
        TaskAgentConfig.workflow_node_id == body.workflow_node_id,
    ).first()

    now = _now_iso()
    if existing:
        existing.agent_type_id = body.agent_type_id
        existing.config_override = json.dumps(body.config_override)
        existing.updated_at = now
    else:
        config = TaskAgentConfig(
            task_id=task_id,
            workflow_node_id=body.workflow_node_id,
            agent_type_id=body.agent_type_id,
            config_override=json.dumps(body.config_override),
        )
        db.add(config)

    db.commit()

    # Return updated config
    cfg = db.query(TaskAgentConfig).filter(
        TaskAgentConfig.task_id == task_id,
        TaskAgentConfig.workflow_node_id == body.workflow_node_id,
    ).first()
    return success_response({
        "id": cfg.id,
        "task_id": cfg.task_id,
        "workflow_node_id": cfg.workflow_node_id,
        "agent_type_id": cfg.agent_type_id,
        "config_override": _parse_json(cfg.config_override),
        "created_at": cfg.created_at or "",
        "updated_at": cfg.updated_at or "",
    }, "Config saved")


@router.delete("/{task_id}/configs/{config_id}")
def delete_config(
    task_id: str,
    config_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = db.query(TaskAgentConfig).filter(
        TaskAgentConfig.id == config_id,
        TaskAgentConfig.task_id == task_id,
    ).first()
    if not config:
        return error_response(404, "Config not found")

    db.delete(config)
    db.commit()
    return success_response(None, "Config deleted")


# ── Execution Records ──────────────────────────────────────

@router.get("/{task_id}/executions")
def get_task_executions(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取任务关联的工作流节点执行记录。

    通过 task.workflow_id 找到最新的 workflow execution，
    返回该 execution 下所有 node_executions。
    """
    from app.models.workflow_execution import WorkflowExecution, WorkflowNodeExecution

    task = db.query(NexusTask).filter(NexusTask.id == task_id, NexusTask.user_id == user.id).first()
    if not task:
        return error_response(404, "Task not found")

    if not task.workflow_id:
        return success_response({"items": [], "total": 0})

    # 获取该 workflow 下最新的 execution
    latest_exec = (
        db.query(WorkflowExecution)
        .filter(WorkflowExecution.workflow_id == task.workflow_id)
        .order_by(WorkflowExecution.started_at.desc())
        .first()
    )

    if not latest_exec:
        return success_response({"items": [], "total": 0})

    # 获取该 execution 下所有 node executions
    nodes = (
        db.query(WorkflowNodeExecution)
        .filter(WorkflowNodeExecution.execution_id == latest_exec.id)
        .order_by(WorkflowNodeExecution.started_at.asc())
        .all()
    )

    items = [
        {
            "execution_id": latest_exec.id,
            "execution_status": latest_exec.status,
            "id": n.id,
            "node_id": n.node_id,
            "node_type": n.node_type,
            "status": n.status,
            "duration_ms": n.duration_ms,
            "error_message": n.error_message,
            "started_at": n.started_at,
            "completed_at": n.completed_at,
        }
        for n in nodes
    ]

    return success_response({"items": items, "total": len(items)})


# ── Status Machine ─────────────────────────────────────────

VALID_TRANSITIONS = {
    "pending": {"running", "scheduled", "cancelled"},
    "scheduled": {"running", "cancelled"},
    "running": {"paused", "completed", "failed", "cancelled"},
    "paused": {"running", "cancelled"},
    "failed": {"running", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def _validate_status_transition(current: str, target: str) -> bool:
    allowed = VALID_TRANSITIONS.get(current, set())
    return target in allowed


# ── Scheduler Integration ──────────────────────────────────


def _schedule_task(task: NexusTask, db: Session):
    """Register an APScheduler job for cron/interval tasks."""
    from app.services.scheduler import scheduler

    job_id = f"task_{task.id}"

    # Remove existing job if any
    if scheduler.scheduler.get_job(job_id):
        scheduler.scheduler.remove_job(job_id)

    schedule_config = _parse_json(task.schedule_config)
    if not schedule_config:
        return

    if task.schedule_type == "cron":
        cron_expr = schedule_config.get("cron", "0 * * * *")
        parts = cron_expr.split()
        trigger_conf = {
            "minute": parts[0] if len(parts) > 0 else "*",
            "hour": parts[1] if len(parts) > 1 else "*",
            "day": parts[2] if len(parts) > 2 else "*",
            "month": parts[3] if len(parts) > 3 else "*",
            "day_of_week": parts[4] if len(parts) > 4 else "*",
        }
        from apscheduler.triggers.cron import CronTrigger
        scheduler.scheduler.add_job(
            _execute_scheduled_task,
            trigger=CronTrigger(**trigger_conf),
            args=[task.id],
            id=job_id,
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )
        logger.info("Scheduled task %s with cron: %s", task.id, cron_expr)

    elif task.schedule_type == "interval":
        interval_seconds = schedule_config.get("interval_seconds", 3600)
        from apscheduler.triggers.interval import IntervalTrigger
        scheduler.scheduler.add_job(
            _execute_scheduled_task,
            trigger=IntervalTrigger(seconds=interval_seconds),
            args=[task.id],
            id=job_id,
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )
        logger.info("Scheduled task %s with interval: %ss", task.id, interval_seconds)


def _unschedule_task(task_id: str):
    """Remove APScheduler job for a task."""
    from app.services.scheduler import scheduler

    job_id = f"task_{task_id}"
    if scheduler.scheduler.get_job(job_id):
        scheduler.scheduler.remove_job(job_id)
        logger.info("Unscheduled task %s", task_id)


async def _execute_scheduled_task(task_id: str):
    """Callback invoked by APScheduler to execute a scheduled task."""
    from app.database import SessionLocal
    from app.services.workflow_engine import workflow_engine

    db = SessionLocal()
    try:
        task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
        if not task:
            logger.warning("Scheduled task %s not found", task_id)
            return

        if task.status not in ("scheduled", "pending", "failed"):
            logger.info("Skipping task %s (status: %s)", task_id, task.status)
            return

        # Transition to running
        task.status = "running"
        task.started_at = _now_iso()
        task.updated_at = _now_iso()
        db.commit()

        # Execute workflow if bound
        if task.workflow_id:
            definition = _parse_json(task.workflow_snapshot)
            if definition:
                nodes = definition.get("nodes", [])
                for n in nodes:
                    n["_all_nodes"] = nodes

                # Apply config overrides
                configs = db.query(TaskAgentConfig).filter(
                    TaskAgentConfig.task_id == task.id
                ).all()
                for cfg in configs:
                    override = _parse_json(cfg.config_override)
                    if override:
                        for node in nodes:
                            if node.get("id") == cfg.workflow_node_id:
                                node.get("config", {}).update(override)

                execution_id = await workflow_engine.start(
                    workflow_id=task.workflow_id,
                    definition=definition,
                    input_params={},
                    user_id=task.user_id,
                    db=db,
                    name=task.name,
                )
                logger.info("Scheduled task %s executed → execution %s", task_id, execution_id)
        else:
            # No workflow: mark completed immediately
            task.status = "completed"
            task.completed_at = _now_iso()
            task.updated_at = _now_iso()
            db.commit()
    except Exception as e:
        logger.error("Scheduled task %s failed: %s", task_id, e)
        task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
        if task:
            task.status = "failed"
            task.completed_at = _now_iso()
            task.updated_at = _now_iso()
            db.commit()
    finally:
        db.close()
