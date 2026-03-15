"""Notification router — channel CRUD + config schemas + test send."""
import json
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.notification import NotificationChannel
from app.models.user import User
from app.schemas.common import success_response, error_response
from app.services.notification import get_adapter, get_all_config_schemas

logger = logging.getLogger(__name__)

router = APIRouter()


def _channel_out(ch: NotificationChannel) -> dict:
    return {
        "id": ch.id,
        "user_id": ch.user_id,
        "channel_type": ch.channel_type,
        "name": ch.name,
        "config": _parse_json(ch.config),
        "triggers": _parse_json(ch.triggers),
        "is_active": ch.is_active,
        "created_at": ch.created_at or "",
    }


def _parse_json(val):
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val
    return val


# ── GET /channel-schemas ─────────────────────────────────


@router.get("/channel-schemas")
def get_channel_schemas(
    user: User = Depends(get_current_user),
):
    """Return config schemas for all notification channels."""
    return success_response(get_all_config_schemas())


# ── User channels ─────────────────────────────────────────


@router.get("/channels")
def list_my_channels(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """User's own channels + global channels."""
    channels = db.query(NotificationChannel).filter(
        (NotificationChannel.user_id == user.id) | (NotificationChannel.user_id.is_(None)),
        NotificationChannel.is_active == True,  # noqa: E712
    ).order_by(NotificationChannel.created_at.desc()).all()
    return success_response([_channel_out(ch) for ch in channels])


@router.post("/channels")
async def create_channel(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a notification channel with config validation."""
    channel_type = body.get("channel_type", "")
    config = body.get("config", {})

    # Validate config via adapter
    try:
        adapter = get_adapter(channel_type)
        valid, err = await adapter.validate_config(config)
        if not valid:
            return error_response(400, f"Config validation failed: {err}")
    except ValueError as e:
        return error_response(400, str(e))

    ch = NotificationChannel(
        user_id=user.id,
        channel_type=channel_type,
        name=body.get("name", channel_type),
        config=json.dumps(config),
        triggers=json.dumps(body.get("triggers")),
        is_active=body.get("is_active", True),
    )
    db.add(ch)
    db.commit()
    db.refresh(ch)
    return success_response(_channel_out(ch), "Channel created")


@router.put("/channels/{channel_id}")
async def update_channel(
    channel_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ch = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id,
        NotificationChannel.user_id == user.id,
    ).first()
    if not ch:
        return error_response(404, "Channel not found")

    # Validate new config if provided
    if "config" in body and "channel_type" in body:
        try:
            adapter = get_adapter(body["channel_type"])
            valid, err = await adapter.validate_config(body["config"])
            if not valid:
                return error_response(400, f"Config validation failed: {err}")
        except ValueError as e:
            return error_response(400, str(e))
        ch.channel_type = body["channel_type"]

    if "name" in body:
        ch.name = body["name"]
    if "config" in body:
        ch.config = json.dumps(body["config"])
    if "triggers" in body:
        ch.triggers = json.dumps(body["triggers"])
    if "is_active" in body:
        ch.is_active = body["is_active"]
    db.commit()
    db.refresh(ch)
    return success_response(_channel_out(ch), "Channel updated")


@router.delete("/channels/{channel_id}")
def delete_channel(
    channel_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ch = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id,
        NotificationChannel.user_id == user.id,
    ).first()
    if not ch:
        return error_response(404, "Channel not found")
    db.delete(ch)
    db.commit()
    return success_response(None, "Channel deleted")


# ── Test send (adapter-based) ────────────────────────────


class TestMessage(BaseModel):
    message: str = "Nexus 通知测试"


@router.post("/channels/{channel_id}/test")
async def test_channel(
    channel_id: str,
    body: TestMessage = TestMessage(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a test message through the channel's adapter."""
    ch = db.query(NotificationChannel).filter(
        NotificationChannel.id == channel_id,
        NotificationChannel.user_id == user.id,
    ).first()
    if not ch:
        return error_response(404, "Channel not found")

    config = _parse_json(ch.config)
    if not isinstance(config, dict):
        config = {}

    try:
        adapter = get_adapter(ch.channel_type)
        from app.services.notification.base import NotificationMessage
        msg = NotificationMessage(
            title="Nexus 测试通知",
            body=body.message,
            level="info",
        )
        ok = await adapter.send(config, msg)
        if ok:
            return success_response({"status": "sent"})
        else:
            return error_response(502, "Send failed, check channel config")
    except ValueError as e:
        return error_response(400, str(e))
    except Exception as e:
        logger.warning("Notification test failed: %s", e)
        return error_response(502, f"Send failed: {str(e)}")


# ── Admin: global channels ────────────────────────────────


@router.get("/admin/channels", tags=["admin-notifications"])
def list_global_channels(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    channels = db.query(NotificationChannel).order_by(NotificationChannel.created_at.desc()).all()
    return success_response([_channel_out(ch) for ch in channels])
