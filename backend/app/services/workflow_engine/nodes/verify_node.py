"""Verify 约束验证节点 — OPSX 最后一步：自动化验证每个约束是否满足。

逐条验证成功判据，汇总通过率。
支持 auto_fix 模式和 PBT 属性测试生成。

通过 OpenAI 兼容 API 调用 LLM（用于 code_review 验证方法）。
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
    "verify",
    label="约束验证",
    description="自动化验证每个约束是否满足，汇总通过率",
    category="quality",
    icon="check-circle",
)
class VerifyNode(BaseNodeExecutor):
    """约束验证节点 — OPSX 流程最后一步。

    三步处理：
    1. 从上游读取 success_criteria（spec）和 merged_findings（review）
    2. 逐条验证（code_review / test_execution / static_analysis）
    3. 汇总通过率，auto_fix 模式下自动修复
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "auto_fix": {
                "type": "boolean",
                "title": "自动修复",
                "default": False,
                "description": "验证失败时自动修复（生成修复建议）",
            },
            "generate_pbt": {
                "type": "boolean",
                "title": "生成属性测试",
                "default": False,
                "description": "为约束生成属性测试（PBT）",
            },
            "verification_methods": {
                "type": "object",
                "title": "验证方法",
                "default": {"code_review": True, "test_execution": True, "static_analysis": False},
                "description": "启用哪些验证方法",
            },
            "model": {
                "type": "string",
                "title": "LLM 模型",
                "default": "",
                "description": "覆盖默认 LLM 模型",
            },
        },
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        auto_fix = context.node_config.get("auto_fix", False)
        generate_pbt = context.node_config.get("generate_pbt", False)
        methods = context.node_config.get(
            "verification_methods",
            {"code_review": True, "test_execution": True, "static_analysis": False},
        )
        model = context.node_config.get("model") or _LLM_MODEL

        # Step 1: 读取上游数据
        criteria = self._get_success_criteria(context)
        review_findings = self._get_review_findings(context)

        if not criteria:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="上游缺少 success_criteria（来自 spec 节点）",
            )

        try:
            # Step 2: 逐条验证
            results = await self._verify_criteria(criteria, review_findings, methods, model, auto_fix)

            # Step 3: 汇总
            passed = sum(1 for r in results if r.get("result") == "passed")
            failed = sum(1 for r in results if r.get("result") == "failed")
            warning = sum(1 for r in results if r.get("result") == "warning")
            total = len(results)
            auto_fixes = sum(1 for r in results if r.get("auto_fix_applied"))

            # 生成 PBT 属性测试（可选）
            pbt_tests: List[Dict[str, Any]] = []
            if generate_pbt:
                pbt_tests = await self._generate_pbt_tests(criteria, model)

            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data={
                    "results": results,
                    "passed": passed,
                    "failed": failed,
                    "warning": warning,
                    "total": total,
                    "pass_rate": round(passed / total, 2) if total > 0 else 1.0,
                    "auto_fixes_applied": auto_fixes,
                    "pbt_tests_generated": pbt_tests,
                    "summary": (
                        f"验证 {total} 条判据: {passed} 通过, {failed} 失败, {warning} 警告"
                        + (f", {auto_fixes} 自动修复" if auto_fixes else "")
                    ),
                },
            )
        except Exception as e:
            logger.error("Verify 节点执行失败: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"约束验证失败: {e}",
            )

    # ---- Step 1: 读取上游数据 ----

    def _get_success_criteria(self, context: NodeContext) -> List[Dict[str, Any]]:
        """从上游获取成功判据。"""
        for source in [context.input_data, context.upstream_outputs]:
            if not source or not isinstance(source, dict):
                continue
            for key, val in source.items():
                if isinstance(val, dict) and "success_criteria" in val:
                    criteria = val["success_criteria"]
                    if isinstance(criteria, list) and criteria:
                        return criteria
            # 直接在顶层
            if isinstance(source, dict) and "success_criteria" in source:
                criteria = source["success_criteria"]
                if isinstance(criteria, list) and criteria:
                    return criteria
        return []

    def _get_review_findings(self, context: NodeContext) -> List[Dict[str, Any]]:
        """从上游获取 review 合并后的发现。"""
        for source in [context.input_data, context.upstream_outputs]:
            if not source or not isinstance(source, dict):
                continue
            for key, val in source.items():
                if isinstance(val, dict) and "merged_findings" in val:
                    findings = val["merged_findings"]
                    if isinstance(findings, list) and findings:
                        return findings
        return []

    # ---- Step 2: 逐条验证 ----

    async def _verify_criteria(
        self,
        criteria: List[Dict[str, Any]],
        review_findings: List[Dict[str, Any]],
        methods: Dict[str, bool],
        model: str,
        auto_fix: bool,
    ) -> List[Dict[str, Any]]:
        """逐条验证成功判据。"""
        results: List[Dict[str, Any]] = []

        for criterion in criteria:
            cid = criterion.get("id", "?")
            text = criterion.get("text", "")
            method = criterion.get("verification_method", "code_review")

            # 跳过未启用的验证方法
            method_key = method.replace("-", "_")
            if methods and not methods.get(method_key, True):
                results.append({
                    "criterion_id": cid,
                    "text": text,
                    "method": method,
                    "result": "warning",
                    "evidence": f"验证方法 {method} 未启用",
                    "fix_suggestion": "",
                    "auto_fix_applied": False,
                })
                continue

            # 根据 review_findings 预判
            related_findings = [
                f for f in review_findings
                if cid in f.get("constraint_ids", [])
            ]

            if related_findings:
                severities = [f.get("severity", "") for f in related_findings]
                has_critical = "critical" in severities
                has_non_compliant = any(
                    f.get("compliant") in ("non_compliant", "partially_compliant")
                    for f in related_findings
                )

                if has_critical:
                    result_status = "failed"
                elif has_non_compliant:
                    result_status = "warning"
                else:
                    result_status = "passed"

                evidence = "; ".join(
                    f"[{f.get('severity', '?')}] {f.get('finding', '')[:200]}"
                    for f in related_findings[:3]
                )
                suggestion = ""
                if auto_fix:
                    suggestion = self._build_fix_suggestion(related_findings)
            else:
                # 无 review 数据，使用 LLM 做代码审查
                result_status, evidence = await self._llm_verify(text, model)
                suggestion = ""

            results.append({
                "criterion_id": cid,
                "text": text,
                "method": method,
                "result": result_status,
                "evidence": evidence,
                "fix_suggestion": suggestion,
                "auto_fix_applied": bool(suggestion and auto_fix),
            })

        return results

    # ---- LLM 代码审查 ----

    async def _llm_verify(self, criterion_text: str, model: str) -> tuple:
        """用 LLM 对单个判据做代码审查验证。"""
        prompt = f"""你是一位测试工程师。请判断以下验收标准是否满足。

验收标准: {criterion_text}

请分析当前代码库状态，判断此标准是否满足。

以 JSON 格式返回:
{{"result": "passed" | "failed" | "warning", "evidence": "验证依据说明"}}

只返回 JSON，不要其他文字。"""

        try:
            result_text = await self._call_llm(prompt, model)
            parsed = self._parse_json(result_text, {"result": "warning", "evidence": "无法验证"})
            return parsed.get("result", "warning"), parsed.get("evidence", "")
        except Exception as e:
            logger.warning("LLM 验证调用失败: %s", e)
            return "warning", f"验证调用失败: {e}"

    # ---- Auto fix 建议 ----

    @staticmethod
    def _build_fix_suggestion(findings: List[Dict[str, Any]]) -> str:
        """从 review 发现构建修复建议。"""
        parts = []
        for f in findings:
            if f.get("compliant") in ("non_compliant", "partially_compliant"):
                parts.append(f"- {f.get('finding', '')}")
        return "\n".join(parts[:5])

    # ---- PBT 属性测试生成 ----

    async def _generate_pbt_tests(
        self, criteria: List[Dict[str, Any]], model: str,
    ) -> List[Dict[str, Any]]:
        """为约束生成属性测试（PBT）。"""
        if not criteria:
            return []

        prompt = f"""你是一位测试架构师。请为以下验收标准生成基于属性的测试（PBT）。

验收标准:
{json.dumps(criteria, ensure_ascii=False, indent=2)}

每个属性测试格式:
{{
    "name": "属性名称",
    "property": "形式化属性描述",
    "input_space": "输入空间描述",
    "invariant": "不变量描述"
}}

请以 JSON 数组格式返回，只为关键约束生成（最多 5 个）。不要其他文字。"""

        result = await self._call_llm(prompt, model)
        tests = self._parse_json(result, [])
        if not isinstance(tests, list):
            tests = [tests] if tests else []
        return tests[:5]

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
