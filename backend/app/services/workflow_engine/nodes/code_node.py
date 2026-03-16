"""Code execution node — runs Python or JavaScript code in isolated processes."""
import asyncio
import json
import logging
import os
import tempfile
from typing import Any, Dict

from ..registry import NodeRegistry
from ..variable_resolver import resolve_template
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 60


@NodeRegistry.register(
    "code",
    label="Code",
    description="Execute Python or JavaScript code",
    category="data",
    icon="code",
)
class CodeNode(BaseNodeExecutor):
    """Executes Python or JavaScript code in a subprocess with timeout.

    Upstream node outputs are injected as JSON variables.
    stdout is captured as the node output.
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "Code"},
            "language": {
                "type": "string",
                "title": "Language",
                "enum": ["python", "javascript"],
                "default": "python",
            },
            "code": {
                "type": "string",
                "title": "Code",
                "description": "Code to execute",
            },
            "timeout": {
                "type": "integer",
                "title": "Timeout (seconds)",
                "default": 60,
                "maximum": 300,
            },
        },
        "required": ["language", "code"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        language = context.node_config.get("language", "python")
        code = context.node_config.get("code", "")
        timeout = context.node_config.get("timeout", _DEFAULT_TIMEOUT)

        if not code.strip():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="code is required",
            )

        # Resolve {{ }} in code using upstream outputs
        code = resolve_template(
            code,
            context.upstream_outputs,
            context.input_data.get("_workflow_variables", {}),
            context.input_data.get("_loop_context"),
            context.input_data.get("_execution_context", {}),
        )

        # Prepare input variables as JSON
        input_vars = {
            "upstream": context.upstream_outputs,
            "input": context.input_data,
        }

        try:
            if language == "python":
                return await self._run_python(code, input_vars, timeout)
            elif language == "javascript":
                return await self._run_javascript(code, input_vars, timeout)
            else:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"Unsupported language: {language}",
                )
        except asyncio.TimeoutError:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"Code execution timed out after {timeout}s",
            )
        except Exception as e:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"Code execution error: {e}",
            )

    async def _run_python(
        self, code: str, input_vars: Dict[str, Any], timeout: int,
    ) -> NodeResult:
        """Execute Python code in a subprocess."""
        # Write runner script to temp file
        runner = f"""
import json
import sys

# Inject variables
input_vars = json.loads({json.dumps(json.dumps(input_vars))})
upstream = input_vars.get("upstream", {{}})
input_data = input_vars.get("input", {{}})

# Execute user code
{code}
"""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False,
        ) as f:
            f.write(runner)
            f.flush()
            tmp_path = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                "python3", tmp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout,
            )

            if proc.returncode != 0:
                error_msg = stderr.decode("utf-8", errors="replace").strip()
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=error_msg or f"Process exited with code {proc.returncode}",
                )

            output_text = stdout.decode("utf-8", errors="replace").strip()
            # Try parsing stdout as JSON
            try:
                output_data = json.loads(output_text)
            except (json.JSONDecodeError, ValueError):
                output_data = {"stdout": output_text}

            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data=output_data,
            )
        finally:
            os.unlink(tmp_path)

    async def _run_javascript(
        self, code: str, input_vars: Dict[str, Any], timeout: int,
    ) -> NodeResult:
        """Execute JavaScript code via Node.js subprocess."""
        runner = f"""
const inputVars = JSON.parse({json.dumps(json.dumps(input_vars))});
const upstream = inputVars.upstream || {{}};
const inputData = inputVars.input || {{}};

{code}
"""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".js", delete=False,
        ) as f:
            f.write(runner)
            f.flush()
            tmp_path = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                "node", tmp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout,
            )

            if proc.returncode != 0:
                error_msg = stderr.decode("utf-8", errors="replace").strip()
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=error_msg or f"Process exited with code {proc.returncode}",
                )

            output_text = stdout.decode("utf-8", errors="replace").strip()
            try:
                output_data = json.loads(output_text)
            except (json.JSONDecodeError, ValueError):
                output_data = {"stdout": output_text}

            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data=output_data,
            )
        finally:
            os.unlink(tmp_path)
