"""WeCom (企业微信) notification adapter."""
from typing import Tuple

import httpx

from .base import BaseAdapter, NotificationMessage


class WeComAdapter(BaseAdapter):
    channel_type = "wecom"

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        group_webhook = config.get("group_webhook")
        corp_id = config.get("corp_id")
        secret = config.get("secret")

        # Prefer group webhook if available
        if group_webhook:
            return await self._send_webhook(group_webhook, message)

        if corp_id and secret:
            return await self._send_via_app(corp_id, secret, message, config)

        return False

    async def _send_webhook(self, webhook_url: str, message: NotificationMessage) -> bool:
        payload = {
            "msgtype": "text",
            "text": {"content": f"{message.title}\n{message.body}"},
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(webhook_url, json=payload)
                return resp.status_code == 200 and resp.json().get("errcode") == 0
        except Exception:
            return False

    async def _send_via_app(self, corp_id: str, secret: str, message: NotificationMessage, config: dict) -> bool:
        """Send via WeCom application API."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                token_resp = await client.get(
                    "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
                    params={"corpid": corp_id, "corpsecret": secret},
                )
                token_data = token_resp.json()
                if token_data.get("errcode") != 0:
                    return False
                access_token = token_data["access_token"]

                payload = {
                    "touser": "@all",
                    "msgtype": "text",
                    "agentid": int(config.get("agent_id", 0)),
                    "text": {"content": f"{message.title}\n{message.body}"},
                }
                resp = await client.post(
                    f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={access_token}",
                    json=payload,
                )
                return resp.json().get("errcode") == 0
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("corp_id"):
            return False, "corp_id is required"
        if not config.get("agent_id"):
            return False, "agent_id is required"
        if not config.get("secret"):
            return False, "secret is required"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "corp_id": {
                    "type": "string",
                    "title": "Corp ID",
                    "description": "企业微信 Corp ID",
                },
                "agent_id": {
                    "type": "string",
                    "title": "Agent ID",
                    "description": "企业微信应用 Agent ID",
                },
                "secret": {
                    "type": "string",
                    "title": "Secret",
                    "description": "企业微信应用 Secret",
                },
                "group_webhook": {
                    "type": "string",
                    "title": "群机器人 Webhook",
                    "description": "可选，群机器人 Webhook 地址",
                },
            },
            "required": ["corp_id", "agent_id", "secret"],
        }
