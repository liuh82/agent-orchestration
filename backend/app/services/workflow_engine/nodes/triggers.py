"""Trigger nodes — manual, cron, and webhook entry points for workflows."""
import logging
import re
from typing import Any, Dict

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

# Basic cron expression validation (5-field: min hour dom month dow)
_CRON_PATTERN = re.compile(
    r"^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$"
)


@NodeRegistry.register(
    "manual_trigger",
    label="Manual Trigger",
    description="Workflow entry point triggered by user action",
    category="trigger",
    icon="play-circle",
)
class ManualTriggerNode(BaseNodeExecutor):
    """Manual trigger — always succeeds immediately.

    The actual trigger is initiated by the API call to execute a workflow.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {
                "type": "string",
                "title": "Label",
                "default": "Manual Trigger",
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={"triggered": True, "trigger_type": "manual"},
        )


@NodeRegistry.register(
    "cron_trigger",
    label="Cron Trigger",
    description="Scheduled trigger using cron expression",
    category="trigger",
    icon="clock-circle",
)
class CronTriggerNode(BaseNodeExecutor):
    """Cron trigger — validates cron expression and returns success.

    Actual scheduling is handled by an external scheduler service.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {
                "type": "string",
                "title": "Label",
                "default": "Cron Trigger",
            },
            "cronExpression": {
                "type": "string",
                "title": "Cron Expression",
                "description": "5-field cron expression, e.g. '0 */5 * * *'",
                "examples": ["0 */5 * * *", "0 9 * * 1-5", "30 8 * * 1"],
            },
            "timezone": {
                "type": "string",
                "title": "Timezone",
                "default": "UTC",
            },
        },
        "required": ["cronExpression"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        cron_expr = context.node_config.get("cronExpression", "")
        timezone = context.node_config.get("timezone", "UTC")

        if not cron_expr:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="cronExpression is required",
            )

        if not _CRON_PATTERN.match(cron_expr):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"Invalid cron expression: {cron_expr}",
            )

        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "triggered": True,
                "trigger_type": "cron",
                "cron_expression": cron_expr,
                "timezone": timezone,
            },
        )


@NodeRegistry.register(
    "webhook_trigger",
    label="Webhook Trigger",
    description="HTTP endpoint trigger for external events",
    category="trigger",
    icon="api",
)
class WebhookTriggerNode(BaseNodeExecutor):
    """Webhook trigger — returns success with request metadata.

    The webhook endpoint is created by the engine when registering the workflow.
    Request data (method/path/headers/body) is injected via input_data.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {
                "type": "string",
                "title": "Label",
                "default": "Webhook Trigger",
            },
            "method": {
                "type": "string",
                "title": "HTTP Method",
                "enum": ["GET", "POST", "PUT", "DELETE"],
                "default": "POST",
            },
            "path": {
                "type": "string",
                "title": "Webhook Path",
                "description": "e.g. /webhook/my-workflow",
            },
            "headers": {
                "type": "object",
                "title": "Expected Headers",
                "additionalProperties": {"type": "string"},
            },
        },
        "required": ["path"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "triggered": True,
                "trigger_type": "webhook",
                "method": context.input_data.get("method", context.node_config.get("method", "POST")),
                "path": context.input_data.get("path", context.node_config.get("path", "")),
                "headers": context.input_data.get("headers", {}),
                "body": context.input_data.get("body", {}),
                "query_params": context.input_data.get("query_params", {}),
            },
        )
