"""Notification adapter registry."""
from typing import Dict, Type

from .base import BaseAdapter
from .feishu import FeishuAdapter
from .dingtalk import DingtalkAdapter
from .wecom import WeComAdapter
from .slack import SlackAdapter
from .discord import DiscordAdapter
from .email import EmailAdapter
from .webhook import WebhookAdapter
from .in_app import InAppAdapter

ADAPTERS: Dict[str, Type[BaseAdapter]] = {
    "feishu": FeishuAdapter,
    "dingtalk": DingtalkAdapter,
    "wecom": WeComAdapter,
    "slack": SlackAdapter,
    "discord": DiscordAdapter,
    "email": EmailAdapter,
    "webhook": WebhookAdapter,
    "in_app": InAppAdapter,
}


def get_adapter(channel_type: str) -> BaseAdapter:
    """Get an adapter instance by channel type."""
    cls = ADAPTERS.get(channel_type)
    if not cls:
        raise ValueError(f"Unknown channel type: {channel_type}")
    return cls()


def get_all_config_schemas() -> dict:
    """Return config schemas for all channels."""
    return {k: v().get_config_schema() for k, v in ADAPTERS.items()}
