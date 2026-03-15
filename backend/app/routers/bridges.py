"""Bridge CRUD router — user-isolated bridge management."""
import secrets
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.gateway import BridgeRecord, TaskRecord
from app.models.user import User
from app.schemas.common import success_response, error_response

router = APIRouter()

# Gateway URL from config — TODO: read from settings/env
GATEWAY_WS_URL = getattr(settings, "GATEWAY_WS_URL", "ws://localhost:8765/ws/gateway")


def _bridge_to_dict(b: BridgeRecord) -> dict:
    return {
        "id": b.id,
        "bridge_id": b.bridge_id,
        "platform": b.platform,
        "hostname": b.hostname,
        "os_version": b.os_version,
        "node_version": b.node_version,
        "bridge_version": b.bridge_version,
        "status": b.status,
        "last_seen": b.last_seen,
        "available_adapters": b.available_adapters,
        "active_tasks": b.active_tasks,
        "max_concurrent": b.max_concurrent,
        "user_id": getattr(b, "user_id", None),
        "created_at": b.created_at,
        "updated_at": b.updated_at,
    }


def _task_to_dict(t: TaskRecord) -> dict:
    return {
        "id": t.id,
        "task_id": t.task_id,
        "bridge_id": t.bridge_id,
        "agent_type": t.agent_type,
        "status": t.status,
        "priority": t.priority,
        "progress": t.progress,
        "submitted_at": t.submitted_at,
        "started_at": t.started_at,
        "completed_at": t.completed_at,
        "error": t.error,
    }


# ── GET /bridges ─────────────────────────────────────────────


@router.get("/")
def list_bridges(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(BridgeRecord)
    if user.role != "admin":
        query = query.filter(BridgeRecord.user_id == user.id)
    bridges = query.order_by(BridgeRecord.created_at.desc()).all()
    return success_response([_bridge_to_dict(b) for b in bridges])


# ── POST /bridges ────────────────────────────────────────────


@router.post("/")
def create_bridge(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bridge_id = str(__import__("uuid").uuid4())
    api_key = secrets.token_urlsafe(32)

    bridge = BridgeRecord(
        bridge_id=bridge_id,
        platform="unknown",
        hostname="pending-registration",
        status="offline",
        last_seen=0,
        available_adapters=[],
        user_id=user.id,
    )
    db.add(bridge)
    db.commit()
    db.refresh(bridge)

    return success_response({
        "bridge_id": bridge.bridge_id,
        "api_key": api_key,
        "ws_url": GATEWAY_WS_URL,
        "setup_command": f"npm install -g @liuh82/oc-bridge && oc-bridge setup --url {GATEWAY_WS_URL} --token {api_key}",
        "install_guide": (
            f"1. npm install -g @liuh82/oc-bridge\n"
            f"2. oc-bridge setup --url {GATEWAY_WS_URL} --token {api_key}\n"
            f"3. oc-bridge start"
        ),
    })


# ── GET /bridges/:id ────────────────────────────────────────


@router.get("/{bridge_id}")
def get_bridge(
    bridge_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bridge = db.query(BridgeRecord).filter(
        BridgeRecord.bridge_id == bridge_id
    ).first()
    if not bridge:
        return error_response(404, "Bridge not found")
    if user.role != "admin" and getattr(bridge, "user_id", None) != user.id:
        return error_response(403, "无权限")
    return success_response(_bridge_to_dict(bridge))


# ── PUT /bridges/:id ────────────────────────────────────────


@router.put("/{bridge_id}")
def update_bridge(
    bridge_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bridge = db.query(BridgeRecord).filter(
        BridgeRecord.bridge_id == bridge_id
    ).first()
    if not bridge:
        return error_response(404, "Bridge not found")
    if user.role != "admin" and getattr(bridge, "user_id", None) != user.id:
        return error_response(403, "无权限")

    # Currently limited update — name/status changes via gateway heartbeat
    return success_response(_bridge_to_dict(bridge))


# ── DELETE /bridges/:id ─────────────────────────────────────


@router.delete("/{bridge_id}")
def delete_bridge(
    bridge_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bridge = db.query(BridgeRecord).filter(
        BridgeRecord.bridge_id == bridge_id
    ).first()
    if not bridge:
        return error_response(404, "Bridge not found")
    if user.role != "admin" and getattr(bridge, "user_id", None) != user.id:
        return error_response(403, "无权限")

    db.delete(bridge)
    db.commit()
    return success_response(None, "Bridge deleted")


# ── GET /bridges/:id/tasks ──────────────────────────────────


@router.get("/{bridge_id}/tasks")
def list_bridge_tasks(
    bridge_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bridge = db.query(BridgeRecord).filter(
        BridgeRecord.bridge_id == bridge_id
    ).first()
    if not bridge:
        return error_response(404, "Bridge not found")
    if user.role != "admin" and getattr(bridge, "user_id", None) != user.id:
        return error_response(403, "无权限")

    tasks = (
        db.query(TaskRecord)
        .filter(TaskRecord.bridge_id == bridge_id)
        .order_by(TaskRecord.submitted_at.desc())
        .all()
    )
    return success_response([_task_to_dict(t) for t in tasks])
