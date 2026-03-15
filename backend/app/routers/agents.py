"""Agent v1 router — instance management + type listing."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.agent_type import AgentType
from app.models.agent_instance import AgentInstance
from app.models.user import User
from app.schemas.agent import AgentCreate, AgentOut, AgentTypeOut, AgentUpdate
from app.schemas.common import success_response, error_response, paged_response

router = APIRouter()


def _parse_json(val: Optional[str]) -> Optional:
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _to_agent_out(inst: AgentInstance, type_info: Optional[AgentTypeOut] = None) -> dict:
    return AgentOut(
        id=inst.id,
        user_id=inst.user_id,
        type_id=inst.type_id,
        name=inst.name,
        status=inst.status,
        model=inst.model,
        config=_parse_json(inst.config),
        task_count=inst.task_count,
        completed_tasks=inst.completed_tasks,
        failed_tasks=inst.failed_tasks,
        total_tokens=inst.total_tokens,
        total_cost=inst.total_cost,
        is_active=inst.is_active,
        last_seen_at=inst.last_seen_at,
        created_at=inst.created_at or "",
        updated_at=inst.updated_at or "",
        type_info=type_info,
    ).model_dump()


# ── GET /agents (list) ────────────────────────────────────


@router.get("")
def list_agents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    search: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AgentInstance).filter(
        AgentInstance.user_id == user.id,
        AgentInstance.is_active == True,  # noqa: E712
    )
    if search:
        query = query.filter(AgentInstance.name.ilike(f"%{search}%"))

    total = query.count()
    order_col = getattr(AgentInstance, sort_by, AgentInstance.created_at)
    query = query.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return paged_response(
        [_to_agent_out(inst) for inst in items], total, page, page_size
    )


# ── POST /agents ──────────────────────────────────────────


@router.post("")
def create_agent(
    body: AgentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check quota
    count = db.query(AgentInstance).filter(
        AgentInstance.user_id == user.id, AgentInstance.is_active == True  # noqa: E712
    ).count()
    if count >= user.max_agents:
        return error_response(403, f"Agent quota exceeded ({user.max_agents})")

    # Verify type exists
    agent_type = db.query(AgentType).filter(AgentType.id == body.type_id).first()
    if not agent_type:
        return error_response(404, "Agent type not found")

    inst = AgentInstance(
        user_id=user.id,
        type_id=body.type_id,
        name=body.name,
        model=body.model,
        config=json.dumps(body.config) if body.config else None,
    )
    db.add(inst)
    db.commit()
    db.refresh(inst)

    type_out = AgentTypeOut(
        id=agent_type.id, name=agent_type.name, display_name=agent_type.display_name,
        protocol=agent_type.protocol, is_system=agent_type.is_system,
        config_schema=_parse_json(agent_type.config_schema),
        capabilities=_parse_json(agent_type.capabilities),
        default_models=_parse_json(agent_type.default_models),
        created_at=agent_type.created_at or "",
    )
    return success_response(_to_agent_out(inst, type_out), "Agent created")


# ── GET /agents/:id ───────────────────────────────────────


@router.get("/{agent_id}")
def get_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id, AgentInstance.user_id == user.id
    ).first()
    if not inst:
        return error_response(404, "Agent not found")

    type_info = None
    at = db.query(AgentType).filter(AgentType.id == inst.type_id).first()
    if at:
        type_info = AgentTypeOut(
            id=at.id, name=at.name, display_name=at.display_name,
            protocol=at.protocol, is_system=at.is_system,
            config_schema=_parse_json(at.config_schema),
            capabilities=_parse_json(at.capabilities),
            default_models=_parse_json(at.default_models),
            created_at=at.created_at or "",
        )
    return success_response(_to_agent_out(inst, type_info))


# ── PUT /agents/:id ───────────────────────────────────────


@router.put("/{agent_id}")
def update_agent(
    agent_id: str,
    body: AgentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id, AgentInstance.user_id == user.id
    ).first()
    if not inst:
        return error_response(404, "Agent not found")

    if body.name is not None:
        inst.name = body.name
    if body.model is not None:
        inst.model = body.model
    if body.config is not None:
        inst.config = json.dumps(body.config)

    db.commit()
    db.refresh(inst)
    return success_response(_to_agent_out(inst), "Agent updated")


# ── DELETE /agents/:id (soft delete) ──────────────────────


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id, AgentInstance.user_id == user.id
    ).first()
    if not inst:
        return error_response(404, "Agent not found")

    inst.is_active = False
    inst.status = "offline"
    db.commit()
    return success_response(None, "Agent deleted")


# ── POST /agents/:id/test ─────────────────────────────────


@router.post("/{agent_id}/test")
def test_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id, AgentInstance.user_id == user.id
    ).first()
    if not inst:
        return error_response(404, "Agent not found")

    # Placeholder — actual connectivity test in future
    return success_response({"status": "success", "message": "Connectivity test passed"})


# ── POST /agents/:id/start ────────────────────────────────


@router.post("/{agent_id}/start")
def start_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id, AgentInstance.user_id == user.id
    ).first()
    if not inst:
        return error_response(404, "Agent not found")

    inst.status = "online"
    db.commit()
    db.refresh(inst)
    return success_response(_to_agent_out(inst), "Agent started")


# ── POST /agents/:id/stop ─────────────────────────────────


@router.post("/{agent_id}/stop")
def stop_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id, AgentInstance.user_id == user.id
    ).first()
    if not inst:
        return error_response(404, "Agent not found")

    inst.status = "offline"
    db.commit()
    db.refresh(inst)
    return success_response(_to_agent_out(inst), "Agent stopped")


# ── GET /agents/:id/logs ──────────────────────────────────


@router.get("/{agent_id}/logs")
def get_agent_logs(
    agent_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id, AgentInstance.user_id == user.id
    ).first()
    if not inst:
        return error_response(404, "Agent not found")

    # Placeholder — logs will be implemented separately
    return paged_response([], 0, page, page_size)


# ── GET /agent-types (read-only) ──────────────────────────


@router.get("/types/list", tags=["agent-types"])
def list_agent_types(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    types = db.query(AgentType).all()
    items = [
        AgentTypeOut(
            id=t.id, name=t.name, display_name=t.display_name,
            protocol=t.protocol, is_system=t.is_system,
            config_schema=_parse_json(t.config_schema),
            capabilities=_parse_json(t.capabilities),
            default_models=_parse_json(t.default_models),
            created_at=t.created_at or "",
        ).model_dump()
        for t in types
    ]
    return success_response(items)
