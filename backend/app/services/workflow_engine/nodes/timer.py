"""Timer node — scheduled trigger (manual trigger in this iteration)."""
import logging
from typing import Any, Dict

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "timer",
    label="Timer",
    description="Scheduled or manual trigger node",
    category="trigger",
    icon="clock",
)
class TimerNodeExecutor(BaseNodeExecutor):
    """Timer/trigger node.

    Current iteration: manual trigger only (passes through immediately).
    Future: cron-based scheduling with APScheduler.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "cron": {
                "type": "string",
                "title": "Cron Expression",
                "description": "Cron expression for scheduled execution (future)",
                "examples": ["0 9 * * 1", "*/30 * * * *"],
            },
            "delay_seconds": {
                "type": "integer",
                "title": "Delay (seconds)",
                "description": "Wait before proceeding (one-time delay)",
                "default": 0,
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        delay = context.node_config.get("delay_seconds", 0)

        if delay > 0:
            import asyncio
            await asyncio.sleep(delay)

        cron = context.node_config.get("cron", "")
        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "triggered": True,
                "cron": cron,
                "mode": "manual" if not cron else "scheduled",
            },
        )
