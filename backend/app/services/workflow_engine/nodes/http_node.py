"""HTTP request node — sends HTTP requests with variable support and retry."""
import asyncio
import json
import logging
from typing import Any, Dict, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 30
_DEFAULT_MAX_RETRIES = 0
_DEFAULT_RETRY_INTERVAL = 5


@NodeRegistry.register(
    "http_request",
    label="HTTP Request",
    description="Send an HTTP request to an external API",
    category="data",
    icon="global",
)
class HttpRequestNode(BaseNodeExecutor):
    """Sends HTTP requests using aiohttp.

    Supports:
    - Variable resolution in URL, headers, and body
    - Configurable retry policy
    - Timeout control
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "HTTP Request"},
            "url": {
                "type": "string",
                "title": "URL",
                "description": "Request URL, supports {{ variable }} syntax",
            },
            "method": {
                "type": "string",
                "title": "Method",
                "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
                "default": "GET",
            },
            "headers": {
                "type": "object",
                "title": "Headers",
                "additionalProperties": {"type": "string"},
            },
            "body": {
                "type": "string",
                "title": "Request Body",
                "description": "JSON string or plain text, supports {{ variable }}",
            },
            "timeout": {
                "type": "integer",
                "title": "Timeout (seconds)",
                "default": 30,
            },
            "retryPolicy": {
                "type": "object",
                "title": "Retry Policy",
                "properties": {
                    "maxRetries": {"type": "integer", "title": "Max Retries", "default": 0},
                    "interval": {"type": "integer", "title": "Interval (s)", "default": 5},
                },
            },
        },
        "required": ["url", "method"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        url_template = context.node_config.get("url", "")
        method = context.node_config.get("method", "GET").upper()
        headers_template = context.node_config.get("headers", {})
        body_template = context.node_config.get("body", "")
        timeout = context.node_config.get("timeout", _DEFAULT_TIMEOUT)
        retry_policy = context.node_config.get("retryPolicy", {})
        max_retries = retry_policy.get("maxRetries", _DEFAULT_MAX_RETRIES)
        retry_interval = retry_policy.get("interval", _DEFAULT_RETRY_INTERVAL)

        if not url_template:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="url is required",
            )

        # Build resolver args
        resolve_kwargs = self._build_resolve_kwargs(context)

        # Resolve variables in all fields
        if context.resolver:
            url = context.resolver.resolve_deep(url_template)
            headers = context.resolver.resolve_deep(headers_template)
            body = context.resolver.resolve_deep(body_template) if body_template else None
        else:
            from ..variable_resolver import resolve_template_deep
            url = resolve_template_deep(url_template, **resolve_kwargs)
            headers = resolve_template_deep(headers_template, **resolve_kwargs)
            body = resolve_template_deep(body_template, **resolve_kwargs) if body_template else None

        last_error = None
        for attempt in range(max_retries + 1):
            if attempt > 0:
                await asyncio.sleep(retry_interval)

            try:
                result = await self._send_request(
                    url, method, headers, body, timeout,
                )
                return result
            except asyncio.TimeoutError:
                last_error = f"Request timed out after {timeout}s"
            except Exception as e:
                last_error = str(e)
                logger.warning(
                    "HTTP request attempt %d/%d failed: %s",
                    attempt + 1, max_retries + 1, e,
                )

        return NodeResult(
            status=NodeStatus.FAILED,
            error_message=last_error or "HTTP request failed",
        )

    async def _send_request(
        self,
        url: str,
        method: str,
        headers: Dict[str, str],
        body: Optional[str],
        timeout: int,
    ) -> NodeResult:
        """Send the actual HTTP request."""
        import aiohttp

        # Parse body as JSON if possible
        json_body = None
        if body:
            try:
                json_body = json.loads(body)
            except (json.JSONDecodeError, TypeError):
                pass

        async with aiohttp.ClientSession() as session:
            kwargs: Dict[str, Any] = {
                "timeout": aiohttp.ClientTimeout(total=timeout),
            }
            if headers:
                kwargs["headers"] = headers
            if json_body is not None:
                kwargs["json"] = json_body
            elif body:
                kwargs["data"] = body

            async with session.request(method, url, **kwargs) as resp:
                resp_body = await resp.text()
                resp_headers = dict(resp.headers)
                # Try to parse response as JSON
                try:
                    resp_data = json.loads(resp_body)
                except (json.JSONDecodeError, TypeError):
                    resp_data = resp_body

                return NodeResult(
                    status=NodeStatus.SUCCESS,
                    output_data={
                        "status_code": resp.status,
                        "headers": resp_headers,
                        "body": resp_data,
                    },
                )

    def _build_resolve_kwargs(self, context: NodeContext) -> dict:
        """Build kwargs dict for resolve_template_deep."""
        return {
            "node_outputs": context.upstream_outputs,
            "workflow_variables": context.input_data.get("_workflow_variables", {}),
            "loop_context": context.input_data.get("_loop_context"),
            "execution_context": context.input_data.get("_execution_context", {}),
        }
