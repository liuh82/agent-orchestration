"""Wait node — delays execution or pauses until webhook callback."""
import asyncio
import logging
from typing import Any, Dict

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "wait",
    label="Wait",
    description="Delay execution for a duration or wait for webhook",
    category="flow",
    icon="hourglass",
)
class WaitNode(BaseNodeExecutor):
    """Wait node with two modes:

    - duration: asyncio.sleep for N seconds
    - webhook: set status to WAITING, engine pauses until webhook callback
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "Wait"},
            "waitType": {
                "type": "string",
                "title": "Wait Type",
                "enum": ["duration", "webhook"],
                "default": "duration",
            },
            "duration": {
                "type": "number",
                "title": "Duration (seconds)",
                "default": 60,
                "minimum": 0,
            },
        },
        "required": ["waitType"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        wait_type = context.node_config.get("waitType", "duration")

        if wait_type == "duration":
            duration = context.node_config.get("duration", 60)
            if duration > 0:
                await asyncio.sleep(duration)
            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data={
                    "wait_type": "duration",
                    "duration_seconds": duration,
                },
            )

        if wait_type == "webhook":
            # Return WAITING status — engine will pause execution
            return NodeResult(
                status=NodeStatus.WAITING,
                output_data={
                    "wait_type": "webhook",
                    "webhook_id": context.node_id,
                },
            )

        return NodeResult(
            status=NodeStatus.FAILED,
            error_message=f"Unknown waitType: {wait_type}",
        )
