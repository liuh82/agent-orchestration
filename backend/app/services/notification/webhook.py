"""Generic Webhook notification adapter."""
from typing import Tuple

import httpx

from .base import BaseAdapter, NotificationMessage


class WebhookAdapter(BaseAdapter):
    channel_type = "webhook"

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        url = config.get("url")
        if not url:
            return False

        secret = config.get("secret", "")
        method = config.get("method", "POST").upper()

        payload = {
            "title": message.title,
            "body": message.body,
            "level": message.level,
        }

        headers = {"Content-Type": "application/json"}
        if secret:
            headers["X-Nexus-Signature"] = secret

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                if method == "GET":
                    resp = await client.get(url, params=payload, headers=headers)
                else:
                    resp = await client.post(url, json=payload, headers=headers)
                return resp.status_code < 400
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("url"):
            return False, "url is required"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "title": "URL",
                    "description": "Webhook 地址",
                },
                "secret": {
                    "type": "string",
                    "title": "Secret",
                    "description": "可选，用于签名验证",
                },
                "method": {
                    "type": "string",
                    "title": "Method",
                    "enum": ["POST", "GET"],
                    "default": "POST",
                },
            },
            "required": ["url"],
        }
