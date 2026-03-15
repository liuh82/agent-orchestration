"""Discord notification adapter."""
from typing import Tuple

import httpx

from .base import BaseAdapter, NotificationMessage


class DiscordAdapter(BaseAdapter):
    channel_type = "discord"

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        webhook_url = config.get("webhook_url")
        if not webhook_url:
            return False

        payload = {
            "content": f"**{message.title}**\n{message.body}",
            "username": "Nexus",
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(webhook_url, json=payload)
                return resp.status_code == 204
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("webhook_url"):
            return False, "webhook_url is required"
        if "discord.com/api/webhooks/" not in config["webhook_url"]:
            return False, "Invalid Discord webhook URL"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "webhook_url": {
                    "type": "string",
                    "title": "Webhook URL",
                    "description": "https://discord.com/api/webhooks/...",
                },
            },
            "required": ["webhook_url"],
        }
