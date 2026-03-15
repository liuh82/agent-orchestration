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
        access_token = config.get("access_token")
        if not access_token:
            return False

        url = "https://oapi.dingtalk.com/robot/send"
        params = {"access_token": access_token}
        secret = config.get("secret")

        if secret:
            ts, sign = self._sign(secret)
            params["timestamp"] = ts
            params["sign"] = sign

        payload = {
            "msgtype": "text",
            "text": {"content": f"{message.title}\n{message.body}"},
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, params=params, json=payload)
                return resp.status_code == 200 and resp.json().get("errcode") == 0
        except Exception:
            return False

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        if not config.get("access_token"):
            return False, "access_token is required"
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "access_token": {
                    "type": "string",
                    "title": "Access Token",
                },
                "secret": {
                    "type": "string",
                    "title": "签名密钥",
                    "description": "可选，用于加签校验",
                },
            },
            "required": ["access_token"],
        }
