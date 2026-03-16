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
        webhook_url = config.get("group_webhook_url")
        app_id = config.get("app_id")
        app_secret = config.get("app_secret")
        msg_type = config.get("msg_type", "text")

        # Prefer group webhook, fall back to app-based sending
        if webhook_url:
            return await self._send_webhook(webhook_url, message, msg_type, config.get("app_secret"))

        if app_id and app_secret:
            return await self._send_via_app(app_id, app_secret, message, msg_type)

        return False

    async def _send_webhook(self, webhook_url: str, message: NotificationMessage, msg_type: str, secret: str = "") -> bool:
        headers = {"Content-Type": "application/json"}
        if secret:
            ts, sign = self._sign(secret)
            headers["X-Lark-Signature"] = sign
            headers["X-Lark-Timestamp"] = ts

        if msg_type == "card":
            payload = {
                "msg_type": "interactive",
                "card": {
                    "header": {"title": {"tag": "plain_text", "content": message.title}},
                    "elements": [{"tag": "markdown", "content": message.body}],
                },
            }
        else:
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

    async def _send_via_app(self, app_id: str, app_secret: str, message: NotificationMessage, msg_type: str) -> bool:
        """Send via Feishu Open API (requires tenant_access_token)."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                token_resp = await client.post(
                    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
                    json={"app_id": app_id, "app_secret": app_secret},
                )
                token_data = token_resp.json()
                if token_data.get("code") != 0:
                    return False
                token = token_data["tenant_access_token"]

                payload = {
                    "msg_type": msg_type,
                    "content": {"text": f"{message.title}\n{message.body}"},
                }
                headers = {"Authorization": f"Bearer {token}"}
                # Note: requires a chat_id to send; this is a simplified implementation
                resp = await client.post(
                    "https://open.feishu.cn/open-apis/im/v1/messages",
                    json=payload,
                    headers=headers,
                )
                return resp.status_code == 200
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("app_id"):
            return False, "app_id is required"
        if not config.get("app_secret"):
            return False, "app_secret is required"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "app_id": {
                    "type": "string",
                    "title": "App ID",
                    "description": "飞书应用 App ID",
                },
                "app_secret": {
                    "type": "string",
                    "title": "App Secret",
                    "description": "飞书应用 App Secret",
                },
                "group_webhook_url": {
                    "type": "string",
                    "title": "群聊 Webhook URL",
                    "description": "可选，群机器人 Webhook 地址",
                },
                "msg_type": {
                    "type": "string",
                    "title": "消息类型",
                    "enum": ["text", "card"],
                    "default": "text",
                },
            },
            "required": ["app_id", "app_secret"],
        }
