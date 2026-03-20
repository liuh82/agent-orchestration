"""Workflow router — CRUD + execution + node types + template save."""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.user import User
from app.models.workflow import WorkflowDefinition, WorkflowTemplate
from app.models.workflow_execution import WorkflowExecution, WorkflowNodeExecution
from app.schemas.common import success_response, error_response, paged_response
from app.services.workflow import WorkflowService
from app.services.workflow_engine_registry import workflow_engine_registry
from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


class WorkflowResponse(BaseModel):
    success: bool
    data: Optional[WorkflowDefinition] = None
    message: str = ""


# ── Node types (for frontend node palette) ───────────────────


@router.get("/node-types")
def get_node_types(user: User = Depends(get_current_user)):
    """Return all registered workflow node types with config schemas."""
    from app.services.workflow_engine import NodeRegistry
    return success_response(NodeRegistry.get_all_types())


# ── Template routes (MUST be before /{workflow_id}) ───────────


@router.get("/templates")
def get_templates(db: Session = Depends(get_db)):
    """获取工作流模板"""
    workflow_service = WorkflowService(db)
    return success_response(workflow_service.get_templates())


@router.get("/templates/{template_id}")
def get_template(template_id: str, db: Session = Depends(get_db)):
    """获取单个模板"""
    workflow_service = WorkflowService(db)
    template = workflow_service.get_template(template_id)
    if not template:
        return error_response(404, "Template not found")
    return success_response(template)


@router.post("/templates")
def create_template(body: dict, db: Session = Depends(get_db)):
    """创建模板"""
    workflow_service = WorkflowService(db)
    try:
        template = workflow_service.create_template(
            WorkflowTemplate(**body)
        )
        return success_response(template, "Template created")
    except Exception as e:
        return error_response(400, str(e))


@router.delete("/templates/{template_id}")
def delete_template(template_id: str, db: Session = Depends(get_db)):
    """删除模板"""
    workflow_service = WorkflowService(db)
    deleted = workflow_service.delete_template(template_id)
    if not deleted:
        return error_response(404, "Template not found")
    return success_response(None, "Template deleted")


# ── Workflow CRUD ────────────────────────────────────────────


@router.get("/")
def get_workflows(db: Session = Depends(get_db)):
    """获取所有工作流"""
    workflow_service = WorkflowService(db)
    return success_response(workflow_service.get_all_workflows())


@router.post("/")
def create_workflow(body: dict, db: Session = Depends(get_db)):
    """创建新工作流"""
    workflow_service = WorkflowService(db)
    try:
        workflow = WorkflowDefinition(**body)
        db_workflow = workflow_service.create_workflow(workflow)
        return success_response(db_workflow, "Workflow created")
    except Exception as e:
        return error_response(400, str(e))


@router.get("/{workflow_id}")
def get_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """获取单个工作流"""
    workflow_service = WorkflowService(db)
    workflow = workflow_service.get_workflow(workflow_id)
    if not workflow:
        return error_response(404, "Workflow not found")
    return success_response(workflow)


@router.put("/{workflow_id}")
def update_workflow(workflow_id: str, body: dict, db: Session = Depends(get_db)):
    """更新工作流"""
    workflow_service = WorkflowService(db)
    try:
        workflow = WorkflowDefinition(**body)
        updated = workflow_service.update_workflow(workflow_id, workflow)
        if not updated:
            return error_response(404, "Workflow not found")
        return success_response(updated, "Workflow updated")
    except Exception as e:
        return error_response(400, str(e))


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """删除工作流"""
    workflow_service = WorkflowService(db)
    deleted = workflow_service.delete_workflow(workflow_id)
    if not deleted:
        return error_response(404, "Workflow not found")
    return success_response(None, "Workflow deleted")


# ── Execute workflow (Nexus engine) ─────────────────────────


@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    body: dict = {},
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute a workflow using the Nexus workflow engine."""
    workflow_service = WorkflowService(db)
    workflow = workflow_service.get_workflow(workflow_id)
    if not workflow:
        return error_response(404, "Workflow not found")

    definition = workflow.get("definition")
    if not definition:
        return error_response(400, "Workflow definition not found")

    if isinstance(definition, str):
        try:
            definition = json.loads(definition)
        except (json.JSONDecodeError, TypeError):
            return error_response(400, "Invalid workflow definition")

    if not isinstance(definition, dict):
        return error_response(400, "Workflow definition must be an object")

    # Inject _all_nodes for graph traversal
    nodes = definition.get("nodes", [])
    for n in nodes:
        n["_all_nodes"] = nodes

    input_params = body.get("input_params", {})

    try:
        from app.services.workflow_engine import workflow_engine

        execution_id = await workflow_engine.start(
            workflow_id=workflow_id,
            definition=definition,
            input_params=input_params,
            user_id=user.id,
            db=db,
            name=body.get("name", workflow.get("name", "")),
        )

        return success_response({
            "execution_id": execution_id,
            "status": "running",
            "message": "Workflow execution started",
        })
    except Exception as e:
        logger.error("Workflow execute error: %s", e)
        return error_response(500, f"Failed to execute workflow: {e}")


# ── Save as template ────────────────────────────────────────


@router.post("/{workflow_id}/save-as-template")
def save_as_template(
    workflow_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a workflow as a reusable template."""
    workflow_service = WorkflowService(db)
    workflow = workflow_service.get_workflow(workflow_id)
    if not workflow:
        return error_response(404, "Workflow not found")

    template_data = {
        "name": body.get("name", workflow.name + " Template"),
        "description": body.get("description", workflow.description),
        "engine": workflow.engine,
        "category": body.get("category", "custom"),
        "definition": workflow.definition,
    }

    try:
        template = workflow_service.create_template(
            WorkflowTemplate(**template_data)
        )
        return success_response(template, "Template saved")
    except Exception as e:
        return error_response(400, str(e))


# ── Workflow Executions ─────────────────────────────────────


@router.get("/executions")
def list_executions(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    workflow_id: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List workflow executions."""
    query = db.query(WorkflowExecution)

    if status:
        query = query.filter(WorkflowExecution.status == status)
    if workflow_id:
        query = query.filter(WorkflowExecution.workflow_id == workflow_id)

    total = query.count()
    items = query.order_by(WorkflowExecution.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return paged_response(
        [_execution_out(e) for e in items],
        total, page, page_size,
    )


@router.get("/executions/{execution_id}")
def get_execution(
    execution_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get execution detail with node statuses."""
    execution = db.query(WorkflowExecution).get(execution_id)
    if not execution:
        return error_response(404, "Execution not found")

    nodes = db.query(WorkflowNodeExecution).filter(
        WorkflowNodeExecution.execution_id == execution_id,
    ).order_by(WorkflowNodeExecution.started_at.asc()).all()

    data = _execution_out(execution)
    data["nodes"] = [_node_exec_out(n) for n in nodes]

    return success_response(data)


@router.get("/executions/{execution_id}/nodes")
def get_execution_nodes(
    execution_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get node execution records for an execution."""
    execution = db.query(WorkflowExecution).get(execution_id)
    if not execution:
        return error_response(404, "Execution not found")

    nodes = db.query(WorkflowNodeExecution).filter(
        WorkflowNodeExecution.execution_id == execution_id,
    ).order_by(WorkflowNodeExecution.started_at.asc()).all()

    return success_response([_node_exec_out(n) for n in nodes])


# ── Execution control: pause / resume / cancel ──────────────


@router.post("/executions/{execution_id}/pause")
async def pause_execution(
    execution_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pause a running workflow execution."""
    execution = db.query(WorkflowExecution).get(execution_id)
    if not execution:
        return error_response(404, "Execution not found")

    from app.services.workflow_engine import workflow_engine
    ok = await workflow_engine.pause(execution_id, db)
    if ok:
        return success_response({"execution_id": execution_id, "status": "paused"})
    return error_response(400, "Cannot pause execution (not running)")


@router.post("/executions/{execution_id}/resume")
async def resume_execution(
    execution_id: str,
    body: dict = {},
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resume a paused/waiting workflow execution."""
    execution = db.query(WorkflowExecution).get(execution_id)
    if not execution:
        return error_response(404, "Execution not found")

    # If human review response provided
    if body.get("decision"):
        from app.models.human_intervention import HumanIntervention
        intervention = db.query(HumanIntervention).filter(
            HumanIntervention.workflow_execution_id == execution_id,
            HumanIntervention.status == "pending",
        ).first()
        if intervention:
            intervention.status = body["decision"]
            intervention.decision = body["decision"]
            intervention.comment = body.get("comment", "")
            intervention.decided_by = user.id
            intervention.decided_at = datetime.utcnow().isoformat() + "Z"
            db.flush()

    from app.services.workflow_engine import workflow_engine
    ok = await workflow_engine.resume(execution_id, db)
    if ok:
        return success_response({"execution_id": execution_id, "status": "running"})
    return error_response(400, "Cannot resume execution")


@router.post("/executions/{execution_id}/cancel")
async def cancel_execution(
    execution_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a workflow execution."""
    execution = db.query(WorkflowExecution).get(execution_id)
    if not execution:
        return error_response(404, "Execution not found")

    from app.services.workflow_engine import workflow_engine
    ok = await workflow_engine.cancel(execution_id, db)
    if ok:
        return success_response({"execution_id": execution_id, "status": "cancelled"})
    return error_response(400, "Cannot cancel execution (already completed)")


# ── Legacy endpoints (kept for backward compatibility) ───────


@router.get("/status/{execution_id}")
def get_workflow_status(execution_id: str, db: Session = Depends(get_db)):
    """获取工作流执行状态 (legacy)"""
    execution = db.query(WorkflowExecution).get(execution_id)
    if execution:
        return success_response(_execution_out(execution))
    return success_response({
        "id": execution_id,
        "status": "unknown",
    })


@router.get("/logs/{execution_id}")
def get_workflow_logs(execution_id: str, db: Session = Depends(get_db)):
    """获取工作流执行日志 (legacy)"""
    nodes = db.query(WorkflowNodeExecution).filter(
        WorkflowNodeExecution.execution_id == execution_id,
    ).order_by(WorkflowNodeExecution.started_at.asc()).all()

    logs = []
    for n in nodes:
        logs.append({
            "id": n.id,
            "timestamp": n.started_at or "",
            "level": "error" if n.status == "failed" else "info",
            "message": f"Node {n.node_id} ({n.node_type}): {n.status}",
            "data": {
                "node_id": n.node_id,
                "node_type": n.node_type,
                "status": n.status,
                "duration_ms": n.duration_ms,
            },
        })

    return success_response(logs)


# ── WebSocket endpoint for real-time updates ────────────────


@router.websocket("/ws/{execution_id}")
async def workflow_websocket(websocket: WebSocket, execution_id: str):
    """WebSocket endpoint for real-time workflow execution updates."""
    topic = f"workflow:{execution_id}"
    connected = await ws_manager.connect(topic, websocket)
    if not connected:
        await websocket.close(code=1013, reason="Max connections reached")
        return

    try:
        while True:
            # Keep-alive: wait for messages (ping/pong handled by FastAPI)
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(topic, websocket)


# ── Helpers ──────────────────────────────────────────────────


def _execution_out(execution: WorkflowExecution) -> dict:
    return {
        "id": execution.id,
        "workflow_id": execution.workflow_id,
        "template_id": execution.template_id,
        "name": execution.name,
        "status": execution.status,
        "current_node_id": execution.current_node_id,
        "input_params": _parse_json(execution.input_params),
        "output_data": _parse_json(execution.output_data),
        "error_message": execution.error_message,
        "started_at": execution.started_at or "",
        "completed_at": execution.completed_at or "",
        "created_by": execution.created_by or "",
        "created_at": execution.created_at or "",
        "updated_at": execution.updated_at or "",
    }


def _node_exec_out(node: WorkflowNodeExecution) -> dict:
    return {
        "id": node.id,
        "execution_id": node.execution_id,
        "node_id": node.node_id,
        "node_type": node.node_type,
        "node_config": _parse_json(node.node_config),
        "status": node.status,
        "input_data": _parse_json(node.input_data),
        "output_data": _parse_json(node.output_data),
        "agent_id": node.agent_id,
        "task_id": node.task_id,
        "error_message": node.error_message,
        "started_at": node.started_at or "",
        "completed_at": node.completed_at or "",
        "duration_ms": node.duration_ms,
    }


def _parse_json(val: Optional[str]):
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val
    return val
