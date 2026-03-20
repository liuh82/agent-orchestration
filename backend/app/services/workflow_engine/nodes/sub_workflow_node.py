"""Sub-workflow node — calls another workflow and merges its output."""
import json
import logging
from typing import Any, Dict, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

_DEFAULT_MAX_DEPTH = 5


@NodeRegistry.register(
    "sub_workflow",
    label="Sub Workflow",
    description="Execute another workflow as part of this one",
    category="workflow",
    icon="fork",
)
class SubWorkflowNode(BaseNodeExecutor):
    """Calls another workflow by ID, passing parameter mappings.

    Prevents infinite recursion by tracking nesting depth (max 5 by default).
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {"type": "string", "title": "Label", "default": "Sub Workflow"},
            "workflowId": {
                "type": "string",
                "title": "Workflow ID",
                "description": "ID of the target workflow",
            },
            "workflowName": {
                "type": "string",
                "title": "Workflow Name",
                "description": "Display name of the target workflow",
            },
            "parameterMapping": {
                "type": "array",
                "title": "Parameter Mapping",
                "description": "Map parent variables to child workflow variables",
                "items": {
                    "type": "object",
                    "required": ["targetVar"],
                    "properties": {
                        "sourcePath": {
                            "type": "string",
                            "title": "Source Path",
                            "description": "Variable path in parent, e.g. {{ node_1.output.result }}",
                        },
                        "targetVar": {
                            "type": "string",
                            "title": "Target Variable",
                            "description": "Variable name in the child workflow",
                        },
                    },
                },
            },
            "maxDepth": {
                "type": "integer",
                "title": "Max Nesting Depth",
                "default": 5,
                "minimum": 1,
                "maximum": 10,
            },
        },
        "required": ["workflowId"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        workflow_id = context.node_config.get("workflowId", "")
        max_depth = context.node_config.get("maxDepth", _DEFAULT_MAX_DEPTH)

        if not workflow_id:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="workflowId is required",
            )

        # Check recursion depth
        current_depth = context.input_data.get("_sub_workflow_depth", 0)
        if current_depth >= max_depth:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    f"Maximum sub-workflow nesting depth ({max_depth}) exceeded"
                ),
            )

        # Resolve parameter mappings
        node_outputs = context.upstream_outputs
        workflow_vars = context.input_data.get("_workflow_variables", {})
        loop_ctx = context.input_data.get("_loop_context")
        exec_ctx = context.input_data.get("_execution_context", {})
        mappings = context.node_config.get("parameterMapping", [])

        child_variables: Dict[str, Any] = {}
        for mapping in mappings:
            source_path = mapping.get("sourcePath", "").strip()
            target_var = mapping.get("targetVar", "")
            if not target_var:
                continue
            if source_path:
                # Strip {{ }} if present
                if source_path.startswith("{{") and source_path.endswith("}}"):
                    source_path = source_path[2:-2].strip()
                if context.resolver:
                    value = context.resolver.resolve(source_path)
                else:
                    from ..variable_resolver import resolve_variable
                    value = resolve_variable(
                        source_path, node_outputs,
                        workflow_variables=workflow_vars,
                        loop_context=loop_ctx,
                        execution_context=exec_ctx,
                    )
                child_variables[target_var] = value

        # Load and execute the target workflow
        db = context.db_session
        if not db:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="No database session available for sub-workflow",
            )

        try:
            from app.models.workflow import Workflow
            target_workflow = db.query(Workflow).get(workflow_id)
            if not target_workflow:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"Target workflow not found: {workflow_id}",
                )

            definition = json.loads(target_workflow.definition) if isinstance(target_workflow.definition, str) else target_workflow.definition

            # Recursively invoke the engine
            from ..engine import workflow_engine
            user_id = exec_ctx.get("user_id", "") if exec_ctx else ""

            # Pass sub-workflow depth context
            child_input = dict(child_variables)
            child_input["_sub_workflow_depth"] = current_depth + 1
            child_input["_parent_execution_id"] = context.execution_id
            child_input["_parent_node_id"] = context.node_id

            execution_id = await workflow_engine.start(
                workflow_id=workflow_id,
                definition=definition,
                input_params=child_input,
                user_id=user_id,
                db=db,
                name=f"SubWF: {context.node_config.get('workflowName', workflow_id[:8])}",
            )

            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data={
                    "sub_workflow_id": workflow_id,
                    "execution_id": execution_id,
                    "variables": child_variables,
                },
            )

        except Exception as e:
            logger.error("Sub-workflow execution error: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"Sub-workflow failed: {e}",
            )
