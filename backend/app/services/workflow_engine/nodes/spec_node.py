"""Spec 约束分析节点 — OPSX 第一步：需求 → 精确约束集。

将模糊需求转化为精确约束集（functional/security/performance/compatibility/architecture/testing），
为后续 plan/review/verify 节点提供结构化输入。

通过 OpenAI 兼容 API 调用 LLM（endpoint 通过配置指定）。
"""
import json
import logging
import os
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

# LLM API 配置（环境变量）
_LLM_API_BASE = os.getenv("NEXUS_LLM_API_BASE", "https://api.openai.com/v1")
_LLM_API_KEY = os.getenv("NEXUS_LLM_API_KEY", "")
_LLM_MODEL = os.getenv("NEXUS_LLM_MODEL", "gpt-4o")
_LLM_TIMEOUT = int(os.getenv("NEXUS_LLM_TIMEOUT", "120"))


@NodeRegistry.register(
    "spec",
    label="约束分析",
    description="将模糊需求转化为精确约束集（functional/security/performance 等 6 个维度）",
    category="quality",
    icon="search",
)
class SpecNode(BaseNodeExecutor):
    """约束分析节点 — OPSX 流程第一步。

    三步处理：
    1. _enhance_prompt: 将模糊需求扩展为结构化需求
    2. _extract_constraints: 从增强需求中提取 6 维度约束
    3. _define_criteria: 为可验证约束定义成功判据
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "requirement": {
                "type": "string",
                "title": "需求描述",
                "description": "需要分析的需求文本，支持 {{ 变量 }} 语法",
            },
            "scope": {
                "type": "string",
                "title": "分析范围",
                "enum": ["full", "backend", "frontend", "infrastructure"],
                "default": "full",
                "description": "约束提取的范围",
            },
            "parallel_models": {
                "type": "boolean",
                "title": "多模型并行",
                "default": False,
                "description": "是否用多模型并行提取约束（需要多个 API 配置）",
            },
            "max_constraints": {
                "type": "integer",
                "title": "最大约束数",
                "default": 20,
                "description": "提取的最大约束数量",
            },
            "model": {
                "type": "string",
                "title": "LLM 模型",
                "default": "",
                "description": "覆盖默认 LLM 模型",
            },
        },
        "required": ["requirement"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        # 解析配置
        requirement = context.node_config.get("requirement", "")
        scope = context.node_config.get("scope", "full")
        parallel = context.node_config.get("parallel_models", False)
        max_constraints = context.node_config.get("max_constraints", 20)
        model = context.node_config.get("model") or _LLM_MODEL

        # 解析变量模板
        if context.resolver:
            requirement = context.resolver.resolve_template(requirement)
        else:
            from ..variable_resolver import resolve_template
            requirement = resolve_template(
                requirement,
                context.upstream_outputs,
                context.input_data.get("_workflow_variables", {}),
                context.input_data.get("_loop_context"),
                context.input_data.get("_execution_context", {}),
            )

        if not requirement.strip():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="requirement 不能为空",
            )

        try:
            # Step 1: 增强需求
            enhanced = await self._enhance_prompt(requirement, scope, model)

            # Step 2: 提取约束
            constraints = await self._extract_constraints(
                enhanced, scope, max_constraints, model,
            )

            # Step 3: 定义成功判据
            criteria = self._define_criteria(constraints)

            # 汇总统计
            must_count = sum(1 for c in constraints if c.get("priority") == "MUST")
            should_count = sum(1 for c in constraints if c.get("priority") == "SHOULD")
            may_count = sum(1 for c in constraints if c.get("priority") == "MAY")

            summary = (
                f"共提取 {len(constraints)} 个约束"
                f"({must_count} MUST, {should_count} SHOULD, {may_count} MAY)，"
                f"{len(criteria)} 个成功判据"
            )

            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data={
                    "enhanced_requirement": enhanced,
                    "constraints": constraints,
                    "success_criteria": criteria,
                    "summary": summary,
                },
            )
        except Exception as e:
            logger.error("Spec 节点执行失败: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"约束分析失败: {e}",
            )

    # ---- Step 1: 增强需求 ----

    async def _enhance_prompt(
        self, requirement: str, scope: str, model: str,
    ) -> Dict[str, Any]:
        """将模糊需求扩展为结构化需求。"""
        prompt = f"""你是一位资深需求分析师。请将以下模糊需求扩展为结构化需求。

原始需求:
{requirement}

分析范围: {scope}

请以 JSON 格式返回，包含以下字段:
- goal: 核心目标（一句话）
- background: 背景上下文（2-3 句）
- scope_detail: 具体范围描述
- constraints_hint: 初步约束提示（5-10 条）
- acceptance_criteria: 验收标准（3-5 条）

只返回 JSON，不要其他文字。"""

        result = await self._call_llm(prompt, model)
        return self._parse_json(result, {
            "goal": requirement[:200],
            "background": "",
            "scope_detail": scope,
            "constraints_hint": [],
            "acceptance_criteria": [],
        })

    # ---- Step 2: 提取约束 ----

    async def _extract_constraints(
        self, enhanced: Dict[str, Any], scope: str,
        max_constraints: int, model: str,
    ) -> List[Dict[str, Any]]:
        """从增强需求中提取约束，6 个维度。"""
        prompt = f"""你是一位质量工程专家。请从以下需求中提取精确约束。

需求信息:
{json.dumps(enhanced, ensure_ascii=False, indent=2)}

请从以下 6 个维度提取约束:
1. functional（功能性）: 系统必须实现什么行为
2. security（安全性）: 认证、授权、数据保护、输入验证
3. performance（性能）: 响应时间、吞吐量、资源限制
4. compatibility（兼容性）: 浏览器、API 版本、数据格式
5. architecture（架构）: 模块化、可扩展、技术栈约束
6. testing（可测试性）: 需要什么测试覆盖

每个约束格式:
- id: "C01", "C02", ...（按维度分组编号）
- text: 约束描述
- category: 上述 6 个维度之一
- priority: "MUST" | "SHOULD" | "MAY"
- verifiable: boolean（是否可自动化验证）
- anti_pattern: 错误的实现方式描述（帮执行者避坑）

最多提取 {max_constraints} 个约束。优先提取 MUST 级别的核心约束。

请以 JSON 数组格式返回，不要其他文字。"""

        result = await self._call_llm(prompt, model)
        constraints = self._parse_json(result, [])
        if not isinstance(constraints, list):
            constraints = [constraints]

        # 确保 id 和 priority 格式正确
        for i, c in enumerate(constraints):
            if isinstance(c, dict):
                c.setdefault("id", f"C{i+1:02d}")
                c.setdefault("priority", "SHOULD")
                c.setdefault("verifiable", True)
                c.setdefault("anti_pattern", "")
                c.setdefault("category", "functional")

        return constraints[:max_constraints]

    # ---- Step 3: 定义成功判据 ----

    def _define_criteria(
        self, constraints: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """为每个 verifiable=True 的约束定义成功判据。"""
        criteria = []
        criterion_id = 0

        for c in constraints:
            if not c.get("verifiable", False):
                continue

            criterion_id += 1
            criteria.append({
                "id": f"S{criterion_id:02d}",
                "text": f"验证约束 {c['id']}: {c.get('text', '')[:100]}",
                "constraint_ids": [c["id"]],
                "verification_method": self._infer_verification_method(c),
            })

        return criteria

    @staticmethod
    def _infer_verification_method(constraint: Dict[str, Any]) -> str:
        """根据约束类型推断验证方式。"""
        category = constraint.get("category", "")
        method_map = {
            "performance": "api_test",
            "security": "code_review",
            "compatibility": "test",
            "testing": "test",
            "architecture": "code_review",
            "functional": "test",
        }
        return method_map.get(category, "code_review")

    # ---- LLM 调用 ----

    async def _call_llm(self, prompt: str, model: str) -> str:
        """调用 LLM（通过 llm_provider 路由）。"""
        from app.services.llm_provider import llm_provider
        return await llm_provider.chat_completion(
            model_id=model,
            messages=[
                {"role": "system", "content": "你是 Nexus OPSX 质量分析引擎，专门负责需求约束提取。只返回 JSON 格式结果。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=4096,
            timeout=_LLM_TIMEOUT,
        )

    @staticmethod
    def _parse_json(text: str, default: Any = None) -> Any:
        """解析 LLM 返回的 JSON，容忍 markdown 代码块包裹。"""
        # 尝试直接解析
        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError):
            pass

        # 尝试提取 ```json ... ``` 代码块
        if "```" in text:
            start = text.find("```json")
            if start == -1:
                start = text.find("```")
                if start != -1:
                    start += 3
            else:
                start += 7

            if start != -1:
                end = text.find("```", start)
                if end != -1:
                    try:
                        return json.loads(text[start:end].strip())
                    except (json.JSONDecodeError, TypeError):
                        pass

        logger.warning("LLM 返回的 JSON 解析失败，使用默认值")
        return default
