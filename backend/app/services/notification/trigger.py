"""Trigger rule engine — emits notifications on events."""
import json
import logging
from typing import Optional

from sqlalchemy.orm import Session

from .base import NotificationMessage
from .registry import get_adapter
from .template import render_template

logger = logging.getLogger(__name__)

TRIGGER_EVENTS = [
    "task.completed",
    "task.failed",
    "task.timeout",
    "task.running",
    "human_intervention.pending",
    "human_intervention.resolved",
]


async def emit_trigger(event: str, context: dict, db: Session):
    """Emit a trigger event to all matching notification channels.

    This is fire-and-forget: failures are logged but never raised.
    """
    if event not in TRIGGER_EVENTS:
        return

    try:
        from app.models.notification import NotificationChannel

        channels = db.query(NotificationChannel).filter(
            NotificationChannel.is_active == True,  # noqa: E712
        ).all()

        for ch in channels:
            triggers = _parse_json(ch.triggers)
            if not isinstance(triggers, list) or event not in triggers:
                continue

            config = _parse_json(ch.config)
            if not isinstance(config, dict):
                continue

            message = render_template(event, context)
            if not message:
                continue

            try:
                adapter = get_adapter(ch.channel_type)
                ok = await adapter.send(config, message)
                if ok:
                    logger.info("Notification sent: channel=%s event=%s", ch.channel_type, event)
                else:
                    logger.warning("Notification failed: channel=%s event=%s", ch.channel_type, event)
            except Exception as e:
                logger.warning("Notification error: channel=%s event=%s err=%s", ch.channel_type, event, e)
    except Exception as e:
        logger.error("emit_trigger error: event=%s err=%s", event, e)


def _parse_json(val: Optional[str]):
    if val:
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return None
    return None
