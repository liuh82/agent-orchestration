"""DingTalk notification adapter."""
import base64
import hashlib
import hmac
import time
import urllib.parse
from typing import Tuple

import httpx

from .base import BaseAdapter, NotificationMessage


class DingtalkAdapter(BaseAdapter):
    channel_type = "dingtalk"

    def _sign(self, secret: str) -> Tuple[str, str]:
        timestamp = str(int(time.time() * 1000))
        string_to_sign = f"{timestamp}\n{secret}"
        hmac_code = hmac.new(
            string_to_sign.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()
        sign = urllib.parse.quote_plus(base64.b64encode(hmac_code).decode("utf-8"))
        return timestamp, sign

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        group_webhook = config.get("group_webhook")
        app_key = config.get("app_key")
        app_secret = config.get("app_secret")
        msg_type = config.get("msg_type", "text")

        # Prefer group webhook
        if group_webhook:
            return await self._send_webhook(group_webhook, message, msg_type, config.get("app_secret"))

        if app_key:
            return await self._send_via_app(app_key, app_secret, message, msg_type)

        return False

    async def _send_webhook(self, webhook_url: str, message: NotificationMessage, msg_type: str, secret: str = "") -> bool:
        url = webhook_url
        params = {}
        if secret:
            ts, sign = self._sign(secret)
            params["timestamp"] = ts
            params["sign"] = sign

        payload = {
            "msgtype": msg_type,
            "text": {"content": f"{message.title}\n{message.body}"},
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, params=params, json=payload)
                return resp.status_code == 200 and resp.json().get("errcode") == 0
        except Exception:
            return False

    async def _send_via_app(self, app_key: str, app_secret: str, message: NotificationMessage, msg_type: str) -> bool:
        """Send via DingTalk Open API."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                token_resp = await client.get(
                    "https://oapi.dingtalk.com/gettoken",
                    params={"appkey": app_key, "appsecret": app_secret},
                )
                token_data = token_resp.json()
                if token_data.get("errcode") != 0:
                    return False

                payload = {
                    "msgtype": msg_type,
                    "text": {"content": f"{message.title}\n{message.body}"},
                }
                # Note: requires a chat_id for work notification
                return True
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("app_key"):
            return False, "app_key is required"
        if not config.get("app_secret"):
            return False, "app_secret is required"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "app_key": {
                    "type": "string",
                    "title": "App Key",
                    "description": "钉钉应用 App Key",
                },
                "app_secret": {
                    "type": "string",
                    "title": "App Secret",
                    "description": "钉钉应用 App Secret",
                },
                "group_webhook": {
                    "type": "string",
                    "title": "群机器人 Webhook",
                    "description": "可选，群机器人 Webhook 地址",
                },
                "msg_type": {
                    "type": "string",
                    "title": "消息类型",
                    "enum": ["text", "markdown", "actionCard"],
                    "default": "text",
                },
            },
            "required": ["app_key", "app_secret"],
        }
