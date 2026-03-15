"""Agent type management router — CRUD + config schema."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.agent_type import AgentType
from app.models.user import User
from app.schemas.common import success_response, error_response, paged_response

router = APIRouter()


def _parse_json(val: Optional[str]):
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _type_to_dict(t: AgentType) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "display_name": t.display_name,
        "protocol": t.protocol,
        "capabilities": _parse_json(t.capabilities) or [],
        "preset_models": _parse_json(t.default_models) or [],
        "config_schema": _parse_json(t.config_schema),
        "is_system": t.is_system,
        "created_by": t.created_by,
        "created_at": t.created_at or "",
        "updated_at": t.updated_at or "",
    }


# ── GET /agent-types ────────────────────────────────────────


@router.get("/")
def list_agent_types(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    types = db.query(AgentType).order_by(AgentType.created_at.asc()).all()
    return success_response([_type_to_dict(t) for t in types])


# ── GET /agent-types/:id/schema ─────────────────────────────


@router.get("/{type_id}/schema")
def get_type_schema(
    type_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(AgentType).filter(AgentType.id == type_id).first()
    if not t:
        return error_response(404, "Agent type not found")
    return success_response({
        "id": t.id,
        "name": t.name,
        "display_name": t.display_name,
        "config_schema": _parse_json(t.config_schema),
    })


# ── POST /agent-types (admin only) ──────────────────────────


class AgentTypeCreate(BaseModel):
    name: str
    display_name: str
    protocol: str
    capabilities: Optional[list] = None
    preset_models: Optional[list] = None
    config_schema: Optional[dict] = None


@router.post("/")
def create_agent_type(
    body: AgentTypeCreate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    existing = db.query(AgentType).filter(AgentType.name == body.name).first()
    if existing:
        return error_response(409, "Agent type name already exists")

    atype = AgentType(
        name=body.name,
        display_name=body.display_name,
        protocol=body.protocol,
        capabilities=json.dumps(body.capabilities or []),
        default_models=json.dumps(body.preset_models or []),
        config_schema=json.dumps(body.config_schema) if body.config_schema else None,
        is_system=False,
        created_by=admin.id,
    )
    db.add(atype)
    db.commit()
    db.refresh(atype)
    return success_response(_type_to_dict(atype), "Agent type created")


# ── PUT /agent-types/:id (admin only) ───────────────────────


class AgentTypeUpdate(BaseModel):
    display_name: Optional[str] = None
    protocol: Optional[str] = None
    capabilities: Optional[list] = None
    preset_models: Optional[list] = None
    config_schema: Optional[dict] = None


@router.put("/{type_id}")
def update_agent_type(
    type_id: str,
    body: AgentTypeUpdate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    atype = db.query(AgentType).filter(AgentType.id == type_id).first()
    if not atype:
        return error_response(404, "Agent type not found")

    if body.display_name is not None:
        atype.display_name = body.display_name
    if body.protocol is not None:
        atype.protocol = body.protocol
    if body.capabilities is not None:
        atype.capabilities = json.dumps(body.capabilities)
    if body.preset_models is not None:
        atype.default_models = json.dumps(body.preset_models)
    if body.config_schema is not None:
        atype.config_schema = json.dumps(body.config_schema)

    db.commit()
    db.refresh(atype)
    return success_response(_type_to_dict(atype), "Agent type updated")


# ── DELETE /agent-types/:id (admin only) ────────────────────


@router.delete("/{type_id}")
def delete_agent_type(
    type_id: str,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    atype = db.query(AgentType).filter(AgentType.id == type_id).first()
    if not atype:
        return error_response(404, "Agent type not found")
    if atype.is_system:
        return error_response(403, "Cannot delete system agent type")

    db.delete(atype)
    db.commit()
    return success_response(None, "Agent type deleted")
