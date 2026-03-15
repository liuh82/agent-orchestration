"""WeCom (企业微信) notification adapter."""
from typing import Tuple

import httpx

from .base import BaseAdapter, NotificationMessage


class WeComAdapter(BaseAdapter):
    channel_type = "wecom"

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        key = config.get("key")
        if not key:
            return False

        url = f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={key}"
        payload = {
            "msgtype": "text",
            "text": {"content": f"{message.title}\n{message.body}"},
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, json=payload)
                return resp.status_code == 200 and resp.json().get("errcode") == 0
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("key"):
            return False, "key is required"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "title": "Webhook Key",
                    "description": "企业微信群机器人 Webhook Key",
                },
            },
            "required": ["key"],
        }
