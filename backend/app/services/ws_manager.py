"""WebSocket connection manager for real-time workflow updates."""
import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, List, Optional, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Max connections per topic (e.g., per execution_id)
MAX_CONNECTIONS_PER_TOPIC = 10


class WSManager:
    """Manages WebSocket connections organized by topics.

    Topics follow the pattern: "workflow:{execution_id}".
    """

    def __init__(self):
        # topic -> set of WebSocket connections
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, topic: str, websocket: WebSocket) -> bool:
        """Accept and register a WebSocket connection for a topic.

        Returns False if max connections reached for topic.
        """
        async with self._lock:
            if len(self._connections[topic]) >= MAX_CONNECTIONS_PER_TOPIC:
                logger.warning("Max connections reached for topic: %s", topic)
                return False
            await websocket.accept()
            self._connections[topic].add(websocket)
            logger.debug("WS connected: topic=%s total=%d", topic, len(self._connections[topic]))
            return True

    async def disconnect(self, topic: str, websocket: WebSocket):
        """Remove a WebSocket connection."""
        async with self._lock:
            self._connections[topic].discard(websocket)
            if not self._connections[topic]:
                del self._connections[topic]
            logger.debug("WS disconnected: topic=%s", topic)

    async def subscribe(self, topic: str, websocket: WebSocket) -> bool:
        """Alias for connect — subscribe to a topic."""
        return await self.connect(topic, websocket)

    async def unsubscribe(self, topic: str, websocket: WebSocket):
        """Alias for disconnect — unsubscribe from a topic."""
        await self.disconnect(topic, websocket)

    async def broadcast(self, topic: str, message: dict):
        """Broadcast a message to all connections on a topic.

        Failed connections are automatically removed.
        """
        async with self._lock:
            connections = list(self._connections.get(topic, set()))

        if not connections:
            return

        payload = json.dumps(message, ensure_ascii=False)
        dead = []

        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        # Clean up dead connections
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections[topic].discard(ws)
                if topic in self._connections and not self._connections[topic]:
                    del self._connections[topic]

    def get_connection_count(self, topic: str) -> int:
        """Get the number of active connections for a topic."""
        return len(self._connections.get(topic, set()))


# Global singleton
ws_manager = WSManager()
