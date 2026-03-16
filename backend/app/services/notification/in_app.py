"""In-app notification adapter."""
from typing import Tuple

from .base import BaseAdapter, NotificationMessage


class InAppAdapter(BaseAdapter):
    channel_type = "in_app"

    async def send(self, config: dict, message: NotificationMessage) -> bool:
        # In-app notifications are stored in the database and served via polling/websocket.
        # The actual delivery happens in the notification service layer.
        # This adapter always reports success since the message will be persisted.
        return True

    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        return True, ""

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {},
            "required": [],
        }
