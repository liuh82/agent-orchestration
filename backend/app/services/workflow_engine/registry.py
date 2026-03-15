"""Node type registry — decorator-based registration for workflow nodes."""
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Type

from .nodes.base import BaseNodeExecutor

logger = logging.getLogger(__name__)


@dataclass
class NodeTypeDefinition:
    """Metadata for a registered node type."""
    type: str
    schema_version: str = "1.0"
    executor_class: Optional[Type[BaseNodeExecutor]] = None
    config_schema: dict = field(default_factory=dict)
    label: str = ""
    description: str = ""
    category: str = "general"
    icon: str = ""


class NodeRegistry:
    """Global registry for workflow node types.

    Usage:
        @NodeRegistry.register("my_node", label="My Node")
        class MyNodeExecutor(BaseNodeExecutor):
            CONFIG_SCHEMA = {...}
            async def execute(self, context): ...
    """

    _nodes: Dict[str, NodeTypeDefinition] = {}

    @classmethod
    def register(
        cls,
        node_type: str,
        schema_version: str = "1.0",
        label: str = "",
        description: str = "",
        category: str = "general",
        icon: str = "",
    ):
        """Decorator to register a node executor class."""
        def decorator(node_cls: Type[BaseNodeExecutor]) -> Type[BaseNodeExecutor]:
            cls._nodes[node_type] = NodeTypeDefinition(
                type=node_type,
                schema_version=schema_version,
                executor_class=node_cls,
                config_schema=getattr(node_cls, "CONFIG_SCHEMA", {}),
                label=label or node_type.replace("_", " ").title(),
                description=description,
                category=category,
                icon=icon,
            )
            logger.debug("Registered workflow node type: %s", node_type)
            return node_cls
        return decorator

    @classmethod
    def get_all_types(cls) -> List[dict]:
        """Return all registered node types (for frontend node palette)."""
        result = []
        for node_type, defn in cls._nodes.items():
            result.append({
                "type": node_type,
                "schema_version": defn.schema_version,
                "label": defn.label,
                "description": defn.description,
                "category": defn.category,
                "icon": defn.icon,
                "config_schema": defn.config_schema,
            })
        return result

    @classmethod
    def get_executor(cls, node_type: str) -> BaseNodeExecutor:
        """Get a node executor instance for the given type."""
        defn = cls._nodes.get(node_type)
        if not defn or not defn.executor_class:
            raise ValueError(f"Unknown node type: {node_type}")
        return defn.executor_class()

    @classmethod
    def has_type(cls, node_type: str) -> bool:
        """Check if a node type is registered."""
        return node_type in cls._nodes
