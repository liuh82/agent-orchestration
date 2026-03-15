"""Notification node — sends messages via notification channels."""
import json
import logging
from typing import Any, Dict, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)


@NodeRegistry.register(
    "notification",
    label="Notification",
    description="Send a notification via configured channel",
    category="action",
    icon="bell",
)
class NotificationNodeExecutor(BaseNodeExecutor):
    """Send notification using Phase 4 notification service."""

    CONFIG_SCHEMA = {
        "type": "object",
        "required": ["channel_id"],
        "properties": {
            "channel_id": {
                "type": "string",
                "title": "Channel ID",
                "description": "Notification channel to use",
            },
            "title_template": {
                "type": "string",
                "title": "Title Template",
                "description": "Notification title (supports {{var}} templating)",
                "default": "Workflow Notification",
            },
            "body_template": {
                "type": "string",
                "title": "Body Template",
                "description": "Notification body (supports {{var}} templating)",
            },
            "level": {
                "type": "string",
                "title": "Level",
                "description": "Notification severity level",
                "enum": ["info", "success", "warning", "error"],
                "default": "info",
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        channel_id = context.node_config.get("channel_id", "")
        title_tpl = context.node_config.get("title_template", "Workflow Notification")
        body_tpl = context.node_config.get("body_template", "")
        level = context.node_config.get("level", "info")

        if not channel_id:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="channel_id is required",
            )

        try:
            success = await self._send_notification(
                context, channel_id, title_tpl, body_tpl, level
            )
            if success:
                return NodeResult(
                    status=NodeStatus.SUCCESS,
                    output_data={
                        "channel_id": channel_id,
                        "sent": True,
                    },
                )
            else:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message="Notification send failed",
                )
        except Exception as e:
            logger.warning("Notification node error: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=str(e),
            )

    async def _send_notification(
        self,
        context: NodeContext,
        channel_id: str,
        title_tpl: str,
        body_tpl: str,
        level: str,
    ) -> bool:
        """Send notification via Phase 4 adapter system."""
        db = context.db_session
        if not db:
            logger.warning("No DB session, skipping notification")
            return False

        from app.models.notification import NotificationChannel
        from app.services.notification import get_adapter
        from app.services.notification.base import NotificationMessage

        ch = db.query(NotificationChannel).filter(
            NotificationChannel.id == channel_id,
            NotificationChannel.is_active == True,  # noqa: E712
        ).first()
        if not ch:
            raise ValueError(f"Notification channel {channel_id} not found")

        config = json.loads(ch.config) if ch.config else {}

        # Render templates
        template_vars = {
            "node_id": context.node_id,
            "execution_id": context.execution_id,
            "workflow_id": context.workflow_id,
            **context.upstream_outputs,
        }
        title = self._render_template(title_tpl, template_vars)
        body = self._render_template(body_tpl or f"Workflow node {context.node_id} completed", template_vars)

        adapter = get_adapter(ch.channel_type)
        msg = NotificationMessage(title=title, body=body, level=level)
        return await adapter.send(config, msg)

    @staticmethod
    def _render_template(template: str, variables: dict) -> str:
        """Simple {{key}} template rendering."""
        if not template:
            return template
        result = template
        for key, value in variables.items():
            if isinstance(value, dict):
                for sub_key, sub_val in value.items():
                    result = result.replace(f"{{{{{key}.{sub_key}}}}}", str(sub_val))
            else:
                result = result.replace(f"{{{{{key}}}}}", str(value))
        return result
