"""WebSocket server for managing Bridge connections."""
from __future__ import annotations

import logging
from typing import Callable, Dict, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WSServer:
    """WebSocket connection manager."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self._handlers: Dict[str, Callable] = {
            'auth.request': self._handle_auth_request,
            'bridge.register': self._handle_bridge_register,
            'task.progress': self._handle_task_progress,
            'task.complete': self._handle_task_complete,
            'task.ack': self._handle_task_ack,
            'ping': self._handle_ping,
        }
        self._on_bridge_register: Callable | None = None
        self._on_bridge_disconnect: Callable | None = None
        self._on_task_progress: Callable | None = None
        self._on_task_complete: Callable | None = None
        self._on_task_ack: Callable | None = None

    def set_handlers(
        self,
        on_bridge_register: Callable,
        on_bridge_disconnect: Callable,
        on_task_progress: Callable,
        on_task_complete: Callable,
        on_task_ack: Callable,
    ) -> None:
        """Set callback handlers for message types."""
        self._on_bridge_register = on_bridge_register
        self._on_bridge_disconnect = on_bridge_disconnect
        self._on_task_progress = on_task_progress
        self._on_task_complete = on_task_complete
        self._on_task_ack = on_task_ack

    # ---- Connection management ----

    async def register(self, bridge_id: str, websocket: WebSocket) -> None:
        """Register a Bridge WebSocket connection."""
        self.active_connections[bridge_id] = websocket
        logger.info(f"Bridge registered: {bridge_id}, total connections: {len(self.active_connections)}")

    async def disconnect(self, bridge_id: str) -> None:
        """Disconnect a Bridge and clean up."""
        ws = self.active_connections.pop(bridge_id, None)
        if self._on_bridge_disconnect:
            await self._on_bridge_disconnect(bridge_id)
        logger.info(f"Bridge disconnected: {bridge_id}, remaining connections: {len(self.active_connections)}")

    async def send_message(self, bridge_id: str, message: dict) -> bool:
        """Send a message to a specific Bridge. Returns True on success."""
        ws = self.active_connections.get(bridge_id)
        if not ws:
            logger.warning(f"Cannot send message: Bridge {bridge_id} not connected")
            return False
        try:
            await ws.send_json(message)
            return True
        except Exception as e:
            logger.error(f"Failed to send message to Bridge {bridge_id}: {e}")
            await self.disconnect(bridge_id)
            return False

    async def send_message_with_retry(
        self, bridge_id: str, message: dict, max_retries: int = 3
    ) -> bool:
        """Send message with retry logic."""
        for attempt in range(max_retries):
            if await self.send_message(bridge_id, message):
                return True
            if attempt < max_retries - 1:
                import asyncio
                await asyncio.sleep(0.5 * (attempt + 1))
        return False

    async def broadcast(self, message: dict) -> None:
        """Broadcast message to all connected Bridges."""
        disconnected = []
        for bridge_id, ws in self.active_connections.items():
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(bridge_id)
        for bridge_id in disconnected:
            await self.disconnect(bridge_id)

    def is_connected(self, bridge_id: str) -> bool:
        """Check if a Bridge is connected."""
        return bridge_id in self.active_connections

    def get_connected_ids(self) -> list[str]:
        """Get all connected Bridge IDs."""
        return list(self.active_connections.keys())

    # ---- Message handling ----

    async def handle_message(self, bridge_id: str, message: dict) -> None:
        """Dispatch message to the appropriate handler."""
        msg_type = message.get('type')
        handler = self._handlers.get(msg_type)
        if handler:
            await handler(bridge_id, message)
        else:
            logger.warning(f"Unknown message type from Bridge {bridge_id}: {msg_type}")

    async def _handle_auth_request(self, bridge_id: str, data: dict) -> None:
        """Handle auth request from Bridge."""
        logger.info(f"Auth request from Bridge {bridge_id}")
        # Auth is handled during WebSocket handshake via token query param

    async def _handle_bridge_register(self, bridge_id: str, data: dict) -> None:
        """Handle bridge.register message."""
        logger.info(f"Bridge registration data from {bridge_id}: {data}")
        if self._on_bridge_register:
            await self._on_bridge_register(bridge_id, data)

    async def _handle_task_progress(self, bridge_id: str, data: dict) -> None:
        """Handle task.progress message."""
        task_id = data.get('taskId', 'unknown')
        progress = data.get('progress', 0)
        logger.debug(f"Task {task_id} progress: {progress}% from Bridge {bridge_id}")
        if self._on_task_progress:
            await self._on_task_progress(bridge_id, data)

    async def _handle_task_complete(self, bridge_id: str, data: dict) -> None:
        """Handle task.complete message."""
        task_id = data.get('taskId', 'unknown')
        status = data.get('status', 'unknown')
        logger.info(f"Task {task_id} completed with status={status} from Bridge {bridge_id}")
        if self._on_task_complete:
            await self._on_task_complete(bridge_id, data)

    async def _handle_task_ack(self, bridge_id: str, data: dict) -> None:
        """Handle task.ack message."""
        task_id = data.get('taskId', 'unknown')
        logger.info(f"Task {task_id} ack received from Bridge {bridge_id}")
        if self._on_task_ack:
            await self._on_task_ack(bridge_id, data)

    async def _handle_ping(self, bridge_id: str, data: dict) -> None:
        """Handle ping message."""
        await self.send_message(bridge_id, {'type': 'pong'})
