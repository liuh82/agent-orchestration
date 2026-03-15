"""Workflow event publisher — sends events to WebSocket subscribers."""
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)


class WorkflowEventPublisher:
    """Publishes workflow execution events to WebSocket subscribers.

    Events are sent to the topic "workflow:{execution_id}".
    """

    @staticmethod
    async def publish(topic: str, event_type: str, data: dict):
        """Publish an event to a WebSocket topic.

        Args:
            topic: e.g. "workflow:{execution_id}"
            event_type: e.g. "node.status_changed", "execution.completed"
            data: event payload
        """
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        await ws_manager.broadcast(topic, event)

    @staticmethod
    async def publish_node_status(
        execution_id: str,
        node_id: str,
        status: str,
        **extra: Any,
    ):
        """Convenience: publish a node status change event."""
        await WorkflowEventPublisher.publish(
            f"workflow:{execution_id}",
            "node.status_changed",
            {"node_id": node_id, "status": status, **extra},
        )

    @staticmethod
    async def publish_execution_status(
        execution_id: str,
        status: str,
        **extra: Any,
    ):
        """Convenience: publish an execution status change event."""
        await WorkflowEventPublisher.publish(
            f"workflow:{execution_id}",
            "execution.status_changed",
            {"execution_id": execution_id, "status": status, **extra},
        )

    @staticmethod
    async def publish_log(
        execution_id: str,
        level: str,
        message: str,
        node_id: Optional[str] = None,
    ):
        """Convenience: publish a log event."""
        await WorkflowEventPublisher.publish(
            f"workflow:{execution_id}",
            "execution.log",
            {
                "execution_id": execution_id,
                "level": level,
                "message": message,
                "node_id": node_id,
            },
        )
