"""Notification service — adapters, trigger engine, templates."""
from .base import BaseAdapter, NotificationMessage
from .registry import ADAPTERS, get_adapter, get_all_config_schemas
from .trigger import TRIGGER_EVENTS, emit_trigger
from .template import render_template

__all__ = [
    "BaseAdapter",
    "NotificationMessage",
    "ADAPTERS",
    "get_adapter",
    "get_all_config_schemas",
    "TRIGGER_EVENTS",
    "emit_trigger",
    "render_template",
]
