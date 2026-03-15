"""Notification adapter base classes and message model."""
from abc import ABC, abstractmethod
from typing import Optional, Tuple

from pydantic import BaseModel


class NotificationMessage(BaseModel):
    title: str = ""
    body: str
    level: str = "info"  # info / warning / error / success


class BaseAdapter(ABC):
    channel_type: str = ""

    @abstractmethod
    async def send(self, config: dict, message: NotificationMessage) -> bool:
        """Send a notification. Returns True on success."""
        ...

    @abstractmethod
    async def validate_config(self, config: dict) -> Tuple[bool, str]:
        """Validate channel config. Returns (is_valid, error_message)."""
        ...

    @abstractmethod
    def get_config_schema(self) -> dict:
        """Return JSON Schema for config form rendering."""
        ...
