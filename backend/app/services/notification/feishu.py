"""Feishu (Lark) notification adapter."""
import base64
import hashlib
import hmac
import time
from typing import Optional, Tuple

import httpx

from .base import BaseAdapter, NotificationMessage


class FeishuAdapter(BaseAdapter):
    channel_type = "feishu"

    def _sign(self, secret: str) -> Tuple[str, str]:
        timestamp = str(int(time.time()))
        string_to_sign = f"{timestamp}\n{secret}"
        hmac_code = hmac.new(
            string_to_sign.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()
        sign = base64.b64encode(hmac_code).decode("utf-8")
        return timestamp, sign

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        webhook_url = config.get("webhook_url")
        secret = config.get("secret", "")
        if not webhook_url:
            return False

        headers = {"Content-Type": "application/json"}
        if secret:
            ts, sign = self._sign(secret)
            headers["X-Lark-Signature"] = sign
            headers["X-Lark-Timestamp"] = ts

        payload = {
            "msg_type": "text",
            "content": {"text": f"{message.title}\n{message.body}"},
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(webhook_url, json=payload, headers=headers)
                return resp.status_code < 400 and resp.json().get("code", -1) == 0
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("webhook_url"):
            return False, "webhook_url is required"
        if not config["webhook_url"].startswith("https://open.feishu.cn/open-apis/bot/v2/hook/"):
            return False, "Invalid Feishu webhook URL"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "webhook_url": {
                    "type": "string",
                    "title": "Webhook URL",
                    "description": "https://open.feishu.cn/open-apis/bot/v2/hook/...",
                },
                "secret": {
                    "type": "string",
                    "title": "签名密钥",
                    "description": "可选，用于签名校验",
                },
            },
            "required": ["webhook_url"],
        }
