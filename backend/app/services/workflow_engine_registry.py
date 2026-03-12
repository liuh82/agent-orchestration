from typing import Dict, Type, Optional
from .lobster_engine import LobsterWorkflowEngine


class WorkflowEngineRegistry:
    """工作流引擎注册表"""

    def __init__(self):
        self._engines: Dict[str, any] = {}
        self._register_default_engines()

    def _register_default_engines(self):
        """注册默认的工作流引擎"""
        self.register('lobster', LobsterWorkflowEngine())

    def register(self, name: str, engine: any):
        """注册工作流引擎"""
        self._engines[name] = engine

    def get(self, name: str) -> Optional[any]:
        """获取工作流引擎"""
        return self._engines.get(name)

    def list(self) -> Dict[str, any]:
        """列出所有注册的工作流引擎"""
        return self._engines.copy()

    def has_engine(self, name: str) -> bool:
        """检查是否存在指定的工作流引擎"""
        return name in self._engines


# 全局工作流引擎注册表实例
workflow_engine_registry = WorkflowEngineRegistry()