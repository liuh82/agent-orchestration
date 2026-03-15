"""Slack notification adapter."""
from typing import Tuple

import httpx

from .base import BaseAdapter, NotificationMessage


class SlackAdapter(BaseAdapter):
    channel_type = "slack"

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        webhook_url = config.get("webhook_url")
        if not webhook_url:
            return False

        payload = {"text": f"*{message.title}*\n{message.body}"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(webhook_url, json=payload)
                return resp.status_code == 200 and resp.text == "ok"
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("webhook_url"):
            return False, "webhook_url is required"
        if not config["webhook_url"].startswith("https://hooks.slack.com/services/"):
            return False, "Invalid Slack webhook URL"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "webhook_url": {
                    "type": "string",
                    "title": "Webhook URL",
                    "description": "https://hooks.slack.com/services/...",
                },
            },
            "required": ["webhook_url"],
        }
