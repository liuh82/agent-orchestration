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
from .input import InputNodeExecutor
from .context_output import ContextOutputNode
from .result_output import ResultOutputNode

# OPSX 质量节点
from .spec_node import SpecNode
from .plan_node import PlanNode
from .review_node import ReviewNode
from .verify_node import VerifyNode
