"""Notification router — channel CRUD + test send."""
import json
import logging

import httpx

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.notification import NotificationChannel
from app.models.user import User
from app.schemas.common import success_response, error_response

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
def create_channel(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = body.get("config", {})
    ch = NotificationChannel(
        user_id=user.id,
        channel_type=body["channel_type"],
        name=body["name"],
        config=json.dumps(config),
        triggers=json.dumps(body.get("triggers")),
    )
    db.add(ch)
    db.commit()
    db.refresh(ch)
    return success_response(_channel_out(ch), "Channel created")


@router.put("/channels/{channel_id}")
def update_channel(
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


@router.post("/channels/{channel_id}/test")
async def test_channel(
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

    config = _parse_json(ch.config)
    webhook_url = config.get("webhook_url") if isinstance(config, dict) else None
    if not webhook_url:
        return error_response(400, "No webhook_url in channel config")

    # Build payload based on channel type
    if ch.channel_type == "feishu":
        payload = {"msg_type": "text", "content": {"text": "Nexus 通知测试"}}
    elif ch.channel_type in ("dingtalk", "wecom"):
        payload = {"msgtype": "text", "text": {"content": "Nexus 通知测试"}}
    else:
        payload = {"text": "Nexus 通知测试"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code < 400:
                return success_response({"status": "sent", "webhook_status": resp.status_code})
            else:
                return error_response(502, f"Webhook returned {resp.status_code}")
    except Exception as e:
        logger.warning("Notification test failed: %s", e)
        return error_response(502, f"Webhook request failed: {str(e)}")


# ── Admin: global channels ────────────────────────────────


@router.get("/admin/channels", tags=["admin-notifications"])
def list_global_channels(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    channels = db.query(NotificationChannel).order_by(NotificationChannel.created_at.desc()).all()
    return success_response([_channel_out(ch) for ch in channels])
