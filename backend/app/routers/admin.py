"""Admin router — user management + agent-type management."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models.agent_type import AgentType
from app.models.user import User
from app.schemas.common import success_response, error_response, paged_response
from app.services.auth import hash_password

router = APIRouter()


def _parse_json(val: Optional[str]) -> Optional:
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return None
    return None


def _user_out(u: User) -> dict:
    settings_data = None
    if u.settings:
        try:
            settings_data = json.loads(u.settings)
        except (json.JSONDecodeError, TypeError):
            settings_data = None
    return {
        "id": u.id, "email": u.email, "name": u.name, "role": u.role,
        "avatar": u.avatar, "settings": settings_data,
        "max_agents": u.max_agents, "max_projects": u.max_projects, "max_tasks": u.max_tasks,
        "status": "active" if u.is_active else "disabled",
        "last_login_at": u.last_login_at, "created_at": u.created_at or "",
    }


# ── User Management ───────────────────────────────────────


@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if search:
        query = query.filter(User.email.ilike(f"%{search}%") | User.name.ilike(f"%{search}%"))
    total = query.count()
    items = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return paged_response([_user_out(u) for u in items], total, page, page_size)


@router.put("/users/{user_id}/quota")
def update_quota(
    user_id: str,
    body: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return error_response(404, "User not found")
    if "max_agents" in body:
        user.max_agents = body["max_agents"]
    if "max_projects" in body:
        user.max_projects = body["max_projects"]
    if "max_tasks" in body:
        user.max_tasks = body["max_tasks"]
    db.commit()
    db.refresh(user)
    return success_response(_user_out(user), "Quota updated")


@router.put("/users/{user_id}/role")
def update_role(
    user_id: str,
    body: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return error_response(404, "User not found")
    role = body.get("role")
    if role not in ("admin", "user"):
        return error_response(400, "Role must be 'admin' or 'user'")
    user.role = role
    db.commit()
    db.refresh(user)
    return success_response(_user_out(user), "Role updated")


@router.put("/users/{user_id}/status")
def update_status(
    user_id: str,
    body: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return error_response(404, "User not found")
    status = body.get("status")
    if status == "active":
        user.is_active = True
    elif status == "disabled":
        user.is_active = False
    db.commit()
    db.refresh(user)
    return success_response(_user_out(user), "Status updated")


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: str,
    body: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return error_response(404, "User not found")
    new_password = body.get("password")
    if not new_password or len(new_password) < 6:
        return error_response(400, "Password must be at least 6 characters")
    user.password_hash = hash_password(new_password)
    db.commit()
    return success_response(None, "Password reset successful")


# ── Agent Type Management ─────────────────────────────────


@router.get("/agent-types")
def list_agent_types(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    types = db.query(AgentType).order_by(AgentType.created_at.asc()).all()
    items = []
    for t in types:
        items.append({
            "id": t.id, "name": t.name, "display_name": t.display_name,
            "protocol": t.protocol, "config_schema": _parse_json(t.config_schema),
            "capabilities": _parse_json(t.capabilities),
            "default_models": _parse_json(t.default_models),
            "is_system": t.is_system, "created_by": t.created_by,
            "created_at": t.created_at or "",
        })
    return success_response(items)


@router.post("/agent-types")
def create_agent_type(
    body: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    name = body.get("name", "")
    if db.query(AgentType).filter(AgentType.name == name).first():
        return error_response(409, "Agent type name already exists")
    at = AgentType(
        name=name,
        display_name=body.get("display_name", name),
        protocol=body.get("protocol", "local_process"),
        config_schema=json.dumps(body["config_schema"]) if body.get("config_schema") else None,
        capabilities=json.dumps(body["capabilities"]) if body.get("capabilities") else None,
        default_models=json.dumps(body["default_models"]) if body.get("default_models") else None,
        is_system=False,
        created_by=admin.id,
    )
    db.add(at)
    db.commit()
    db.refresh(at)
    return success_response({"id": at.id}, "Agent type created")


@router.put("/agent-types/{type_id}")
def update_agent_type(
    type_id: str,
    body: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    at = db.query(AgentType).filter(AgentType.id == type_id).first()
    if not at:
        return error_response(404, "Agent type not found")
    if "display_name" in body:
        at.display_name = body["display_name"]
    if "protocol" in body:
        at.protocol = body["protocol"]
    if "config_schema" in body:
        at.config_schema = json.dumps(body["config_schema"])
    if "capabilities" in body:
        at.capabilities = json.dumps(body["capabilities"])
    if "default_models" in body:
        at.default_models = json.dumps(body["default_models"])
    db.commit()
    db.refresh(at)
    return success_response({"id": at.id}, "Agent type updated")


@router.delete("/agent-types/{type_id}")
def delete_agent_type(
    type_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    at = db.query(AgentType).filter(AgentType.id == type_id).first()
    if not at:
        return error_response(404, "Agent type not found")
    if at.is_system:
        return error_response(403, "Cannot delete system preset agent type")
    db.delete(at)
    db.commit()
    return success_response(None, "Agent type deleted")
