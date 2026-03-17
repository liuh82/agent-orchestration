"""Workflow node executors — import to register all node types."""
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus
from .agent import AgentNodeExecutor
from .condition import ConditionNodeExecutor
from .human import HumanNodeExecutor
from .parallel import ParallelNodeExecutor
from .transform import TransformNodeExecutor
from .notification import NotificationNodeExecutor
from .timer import TimerNodeExecutor

# Schema v1 new nodes
from .triggers import ManualTriggerNode, CronTriggerNode, WebhookTriggerNode
from .if_node import IfNode
from .switch_node import SwitchNode
from .loop_node import LoopNode
from .wait_node import WaitNode
from .sub_workflow_node import SubWorkflowNode
from .http_node import HttpRequestNode
from .code_node import CodeNode
from .output_node import OutputNode
from .fork import ForkNode
from .join import JoinNode
