"""Workflow event publisher — sends events to WebSocket subscribers and event_store (SSE)."""
import logging
import time
from datetime import datetime
from typing import Any, Dict, Optional

from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)

# execution_id → task_id mapping for SSE bridge
_execution_task_map: Dict[str, str] = {}


def register_execution_task(execution_id: str, task_id: str):
    """Register execution_id → task_id mapping so workflow events can be bridged to SSE."""
    _execution_task_map[execution_id] = task_id


def unregister_execution_task(execution_id: str):
    """Remove execution_id mapping after execution completes."""
    _execution_task_map.pop(execution_id, None)


def _get_task_id(execution_id: str) -> Optional[str]:
    """Look up task_id for an execution_id."""
    return _execution_task_map.get(execution_id)


class WorkflowEventPublisher:
    """Publishes workflow execution events to WebSocket subscribers.

    Events are sent to the topic "workflow:{execution_id}".

    Supported event types (matching Schema v1 WebSocket spec):
    - node.status_changed: { node_id, status, output?, error?, duration_ms? }
    - node.log: { node_id, message, timestamp, level }
    - execution.status_changed: { status, error? }
    - execution.progress: { current_node, completed_nodes, total_nodes }
    - human_intervention.required: { node_id, context }
    """

    @staticmethod
    async def publish(topic: str, event_type: str, data: dict):
        """Publish an event to a WebSocket topic and bridge to event_store (SSE).

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

        # Bridge to event_store for SSE consumers
        if topic.startswith("workflow:"):
            execution_id = topic.split(":", 1)[1]
            task_id = _get_task_id(execution_id)
            if task_id:
                try:
                    from app.services.gateway.event_store import event_store
                    event_store.push(task_id, {
                        "type": "workflow_event",
                        "event": event,
                        "ts": int(time.time() * 1000),
                    })
                except Exception as e:
                    logger.warning("Failed to bridge event to event_store: %s", e)

    @staticmethod
    async def publish_node_status(
        execution_id: str,
        node_id: str,
        status: str,
        **extra: Any,
    ):
        """Publish a node status change event."""
        await WorkflowEventPublisher.publish(
            f"workflow:{execution_id}",
            "node.status_changed",
            {"node_id": node_id, "status": status, **extra},
        )

    @staticmethod
    async def publish_node_output(
        execution_id: str,
        node_id: str,
        output: Any,
    ):
        """Publish a node output event (for real-time output streaming)."""
        await WorkflowEventPublisher.publish(
            f"workflow:{execution_id}",
            "node.output",
            {"node_id": node_id, "output": output},
        )

    @staticmethod
    async def publish_execution_status(
        execution_id: str,
        status: str,
        **extra: Any,
    ):
        """Publish an execution status change event."""
        await WorkflowEventPublisher.publish(
            f"workflow:{execution_id}",
            "execution.status_changed",
            {"execution_id": execution_id, "status": status, **extra},
        )

    @staticmethod
    async def publish_progress(
        execution_id: str,
        current_node: str,
        completed_nodes: int,
        total_nodes: int,
    ):
        """Publish execution progress update."""
        await WorkflowEventPublisher.publish(
            f"workflow:{execution_id}",
            "execution.progress",
            {
                "current_node": current_node,
                "completed_nodes": completed_nodes,
                "total_nodes": total_nodes,
            },
        )

    @staticmethod
    async def publish_log(
        execution_id: str,
        level: str,
        message: str,
        node_id: Optional[str] = None,
    ):
        """Publish a log event."""
        await WorkflowEventPublisher.publish(
            f"workflow:{execution_id}",
            "node.log",
            {
                "execution_id": execution_id,
                "level": level,
                "message": message,
                "node_id": node_id,
            },
        )

    @staticmethod
    async def publish_human_intervention(
        execution_id: str,
        node_id: str,
        context: dict,
    ):
        """Publish a human intervention required event."""
        await WorkflowEventPublisher.publish(
            f"workflow:{execution_id}",
            "human_intervention.required",
            {"node_id": node_id, "context": context},
        )
