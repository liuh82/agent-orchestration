"""Review 交叉验证节点 — OPSX 第三步：双模型独立审查约束合规性。

用两个 LLM 模型独立审查执行结果，交叉验证约束合规性。
合并两个审查结果，判断整体合规状态。

通过 OpenAI 兼容 API 调用 LLM。
"""
import json
import logging
import os
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

# LLM API 配置
_LLM_API_BASE = os.getenv("NEXUS_LLM_API_BASE", "https://api.openai.com/v1")
_LLM_API_KEY = os.getenv("NEXUS_LLM_API_KEY", "")
_LLM_MODEL = os.getenv("NEXUS_LLM_MODEL", "gpt-4o")
_LLM_TIMEOUT = int(os.getenv("NEXUS_LLM_TIMEOUT", "120"))


@NodeRegistry.register(
    "review",
    label="交叉验证",
    description="用两个模型独立审查执行结果，交叉验证约束合规性",
    category="quality",
    icon="shield",
)
class ReviewNode(BaseNodeExecutor):
    """交叉验证节点 — OPSX 流程第三步。

    四步处理：
    1. 组装审查上下文（原始需求 + 约束 + 计划 + 执行结果）
    2. 构建审查 prompt，发送给两个模型
    3. 合并两个审查结果（severity 投票、去重）
    4. 输出合并后的发现和合规统计
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "review_dimensions": {
                "type": "array",
                "title": "审查维度",
                "items": {"type": "string"},
                "default": ["spec_compliance", "logic_correctness", "security", "maintainability"],
                "description": "审查关注的维度",
            },
            "fail_on_critical": {
                "type": "boolean",
                "title": "严重问题时失败",
                "default": True,
                "description": "存在 Critical 级别发现时节点返回 FAILED",
            },
            "reviewer_a_model": {
                "type": "string",
                "title": "审查者 A 模型",
                "default": "",
                "description": "审查者 A 的模型（空则用默认）",
            },
            "reviewer_b_model": {
                "type": "string",
                "title": "审查者 B 模型",
                "default": "",
                "description": "审查者 B 的模型（空则用默认或同 A）",
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        dimensions = context.node_config.get(
            "review_dimensions",
            ["spec_compliance", "logic_correctness", "security", "maintainability"],
        )
        fail_on_critical = context.node_config.get("fail_on_critical", True)
        model_a = context.node_config.get("reviewer_a_model") or _LLM_MODEL
        model_b = context.node_config.get("reviewer_b_model") or model_a

        # Step 1: 组装审查上下文
        review_context = self._build_review_context(context)
        if not review_context.get("constraints"):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="上游缺少 spec 节点输出的约束列表",
            )

        try:
            # Step 2: 并行调用两个模型审查
            import asyncio
            review_a, review_b = await asyncio.gather(
                self._run_review(review_context, dimensions, model_a, "A"),
                self._run_review(review_context, dimensions, model_b, "B"),
            )

            # Step 3: 合并结果
            merged = self._merge_reviews(review_a, review_b)

            # Step 4: 统计合规性
            compliance = self._count_compliance(merged["merged_findings"], review_context["constraints"])
            critical_count = sum(1 for f in merged["merged_findings"] if f.get("severity") == "critical")

            # 判断整体状态
            if fail_on_critical and critical_count > 0:
                status = NodeStatus.FAILED
            else:
                status = NodeStatus.SUCCESS

            return NodeResult(
                status=status,
                output_data={
                    "review_a": {"findings": review_a, "summary": f"审查者 A: {len(review_a)} 个发现"},
                    "review_b": {"findings": review_b, "summary": f"审查者 B: {len(review_b)} 个发现"},
                    "merged_findings": merged["merged_findings"],
                    "compliance": compliance,
                    "critical_count": critical_count,
                    "status": status.value,
                },
            )
        except Exception as e:
            logger.error("Review 节点执行失败: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"交叉验证失败: {e}",
            )

    # ---- Step 1: 组装审查上下文 ----

    def _build_review_context(self, context: NodeContext) -> Dict[str, Any]:
        """从上游节点输出组装审查所需的上下文。"""
        sources = [context.input_data, context.upstream_outputs]
        result: Dict[str, Any] = {
            "constraints": [],
            "success_criteria": [],
            "plan_steps": [],
            "execution_result": {},
        }

        for source in sources:
            if not source or not isinstance(source, dict):
                continue

            # spec 节点输出
            for key, val in source.items():
                if not isinstance(val, dict):
                    continue
                if "constraints" in val and not result["constraints"]:
                    result["constraints"] = val.get("constraints", [])
                    result["enhanced_requirement"] = val.get("enhanced_requirement", {})
                    result["success_criteria"] = val.get("success_criteria", [])
                    break

            # plan 节点输出
            for key, val in source.items():
                if not isinstance(val, dict):
                    continue
                if "plan_steps" in val and not result["plan_steps"]:
                    result["plan_steps"] = val.get("plan_steps", [])
                    break

            # 执行结果（来自 agent/code 节点的输出）
            for key, val in source.items():
                if not isinstance(val, dict):
                    continue
                if "content" in val and not result["execution_result"]:
                    result["execution_result"] = val
                    break

        return result

    # ---- Step 2: 单模型审查 ----

    async def _run_review(
        self,
        review_context: Dict[str, Any],
        dimensions: List[str],
        model: str,
        reviewer_id: str,
    ) -> List[Dict[str, Any]]:
        """调用单个 LLM 执行审查。"""
        prompt = f"""你是代码审查专家（审查者 {reviewer_id}）。请从以下维度审查代码变更是否满足所有约束。

审查维度: {', '.join(dimensions)}

约束列表:
{json.dumps(review_context['constraints'], ensure_ascii=False, indent=2)}

执行计划:
{json.dumps(review_context['plan_steps'][:20], ensure_ascii=False, indent=2)}

实际执行结果:
{json.dumps(review_context['execution_result'], ensure_ascii=False, indent=2)[:3000]}

对每个约束，判断:
- compliant: "fully_compliant" | "partially_compliant" | "non_compliant"
- severity: "critical" | "major" | "minor" | "info"
- finding: 具体问题描述
- suggestion: 修复建议（如果是 non_compliant 或 partially_compliant）
- constraint_id: 对应的约束 ID

请以 JSON 数组格式返回发现列表，只返回有问题的约束。如果没有问题，返回空数组 []。
不要其他文字。"""

        result = await self._call_llm(prompt, model)
        findings = self._parse_json(result, [])
        if not isinstance(findings, list):
            findings = [findings] if findings else []

        # 规范化
        for f in findings:
            if isinstance(f, dict):
                f.setdefault("compliant", "partially_compliant")
                f.setdefault("severity", "major")
                f.setdefault("finding", "")
                f.setdefault("suggestion", "")
                f.setdefault("constraint_id", "")
                f.setdefault("reviewer", reviewer_id)

        return findings

    # ---- Step 3: 合并两个审查结果 ----

    def _merge_reviews(
        self,
        review_a: List[Dict[str, Any]],
        review_b: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """合并两个审查者的结果。

        规则:
        - 两个都 critical → critical
        - 一个 critical + 一个 non_compliant → critical
        - 两个都 major → major
        - 去重：同一约束的相同问题只保留一个
        """
        merged: List[Dict[str, Any]] = []

        # 按 constraint_id 分组
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for f in review_a + review_b:
            cid = f.get("constraint_id", "")
            groups.setdefault(cid, []).append(f)

        for cid, findings in groups.items():
            if len(findings) == 1:
                merged.append(findings[0])
                continue

            # 多个审查者对同一约束有发现，取较严重的结果
            sev_order = {"critical": 0, "major": 1, "minor": 2, "info": 3}
            comp_order = {"non_compliant": 0, "partially_compliant": 1, "fully_compliant": 2}

            best = min(findings, key=lambda f: (
                sev_order.get(f.get("severity", "info"), 3),
                comp_order.get(f.get("compliant", "fully_compliant"), 2),
            ))

            # 合并描述
            descriptions = [f.get("finding", "") for f in findings if f.get("finding")]
            suggestions = [f.get("suggestion", "") for f in findings if f.get("suggestion")]

            best["finding"] = descriptions[0] if descriptions else ""
            best["suggestion"] = suggestions[0] if suggestions else ""
            best["reviewers"] = [f.get("reviewer", "?") for f in findings]
            merged.append(best)

        # 按 severity 排序
        sev_order = {"critical": 0, "major": 1, "minor": 2, "info": 3}
        merged.sort(key=lambda f: sev_order.get(f.get("severity", "info"), 3))

        return {"merged_findings": merged}

    # ---- Step 4: 合规统计 ----

    @staticmethod
    def _count_compliance(findings: List[Dict[str, Any]], constraints: List[Dict[str, Any]]) -> Dict[str, int]:
        """统计合规性。"""
        compliant_ids = set()
        partial_ids = set()
        non_compliant_ids = set()

        for f in findings:
            comp = f.get("compliant", "")
            cid = f.get("constraint_id", "")
            if comp == "fully_compliant":
                compliant_ids.add(cid)
            elif comp == "partially_compliant":
                partial_ids.add(cid)
            elif comp == "non_compliant":
                non_compliant_ids.add(cid)

        total = len(constraints) if constraints else max(len(compliant_ids) + len(partial_ids) + len(non_compliant_ids), 1)
        return {
            "compliant": len(compliant_ids),
            "partial": len(partial_ids),
            "non_compliant": len(non_compliant_ids),
            "total": total,
        }

    # ---- LLM 调用 ----

    async def _call_llm(self, prompt: str, model: str) -> str:
        """Call LLM via llm_provider."""
        from app.services.llm_provider import llm_provider
        return await llm_provider.chat_completion(
            model_id=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=4096,
            timeout=_LLM_TIMEOUT,
        )

    def _parse_json(self, text: str, default: Any = None) -> Any:
        """解析 LLM 返回的 JSON，容忍 markdown 代码块包裹。"""
        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError):
            pass

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
