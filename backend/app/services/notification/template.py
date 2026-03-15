"""Message template rendering for trigger events."""
from typing import Optional

from .base import NotificationMessage

# Simple templates per event type
_TEMPLATES = {
    "task.completed": {
        "title": "Task Completed",
        "body": "Task \"{name}\" has been completed.\nDuration: {duration}\nProject: {project}",
        "level": "success",
    },
    "task.failed": {
        "title": "Task Failed",
        "body": "Task \"{name}\" has failed.\nError: {error}\nProject: {project}",
        "level": "error",
    },
    "task.timeout": {
        "title": "Task Timeout",
        "body": "Task \"{name}\" has timed out.\nTimeout: {timeout}s\nProject: {project}",
        "level": "warning",
    },
    "task.running": {
        "title": "Task Started",
        "body": "Task \"{name}\" is now running.\nAssigned to: {agent}\nProject: {project}",
        "level": "info",
    },
    "human_intervention.pending": {
        "title": "Human Review Required",
        "body": "Task \"{name}\" requires your review.\nReason: {reason}\nProject: {project}",
        "level": "warning",
    },
    "human_intervention.resolved": {
        "title": "Human Review Resolved",
        "body": "Task \"{name}\" review has been resolved.\nDecision: {decision}\nBy: {user}\nProject: {project}",
        "level": "info",
    },
}


def render_template(event: str, context: dict) -> Optional[NotificationMessage]:
    """Render a message template with context variables."""
    tpl = _TEMPLATES.get(event)
    if not tpl:
        return None

    try:
        title = tpl["title"].format(**context)
        body = tpl["body"].format(**context)
        return NotificationMessage(title=title, body=body, level=tpl["level"])
    except (KeyError, ValueError):
        return NotificationMessage(
            title=tpl["title"],
            body=str(context),
            level=tpl["level"],
        )
