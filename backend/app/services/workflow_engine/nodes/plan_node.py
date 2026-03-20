"""Plan 零决策计划节点 — OPSX 第二步：约束集 → 机械执行计划。

将 spec 节点输出的约束集转化为零决策的执行计划，
执行者不需要做任何判断，按照步骤顺序执行即可。

通过 OpenAI 兼容 API 调用 LLM。
"""
import json
import logging
import os
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

# LLM API 配置（与 spec_node 共享环境变量）
_LLM_API_BASE = os.getenv("NEXUS_LLM_API_BASE", "https://api.openai.com/v1")
_LLM_API_KEY = os.getenv("NEXUS_LLM_API_KEY", "")
_LLM_MODEL = os.getenv("NEXUS_LLM_MODEL", "gpt-4o")
_LLM_TIMEOUT = int(os.getenv("NEXUS_LLM_TIMEOUT", "120"))


@NodeRegistry.register(
    "plan",
    label="零决策计划",
    description="将约束集转化为机械可执行的零决策计划",
    category="quality",
    icon="clipboard",
)
class PlanNode(BaseNodeExecutor):
    """零决策计划节点 — OPSX 流程第二步。

    四步处理：
    1. 读取上游 spec 节点输出的 constraints 和 success_criteria
    2. _build_zero_decision_plan: 生成零决策步骤
    3. _detect_conflicts: 检查步骤冲突
    4. 生成测试步骤（如果 include_tests=True）
    """

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "analysis_depth": {
                "type": "string",
                "title": "分析深度",
                "enum": ["quick", "normal", "deep"],
                "default": "normal",
                "description": "计划分析深度",
            },
            "include_tests": {
                "type": "boolean",
                "title": "包含测试步骤",
                "default": True,
                "description": "是否为成功判据生成对应的测试步骤",
            },
            "target_framework": {
                "type": "string",
                "title": "目标技术栈",
                "default": "",
                "description": "目标技术栈，如 fastapi / react / django",
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
        analysis_depth = context.node_config.get("analysis_depth", "normal")
        include_tests = context.node_config.get("include_tests", True)
        target_framework = context.node_config.get("target_framework", "")
        model = context.node_config.get("model") or _LLM_MODEL

        # 从上游读取 spec 节点的输出
        spec_data = self._get_spec_data(context)
        if not spec_data:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="上游缺少 spec 节点输出（constraints/success_criteria）",
            )

        constraints = spec_data.get("constraints", [])
        criteria = spec_data.get("success_criteria", [])
        enhanced = spec_data.get("enhanced_requirement", {})

        if not constraints:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="spec 节点输出的约束列表为空",
            )

        try:
            # Step 2: 生成零决策计划
            plan_steps = await self._build_zero_decision_plan(
                enhanced, constraints, criteria,
                analysis_depth, target_framework, model,
            )

            # Step 3: 检测冲突
            conflicts = self._detect_conflicts(plan_steps)

            # Step 4: 生成测试步骤
            test_steps = []
            if include_tests and criteria:
                test_steps = await self._generate_test_steps(
                    criteria, target_framework, model,
                )

            # 合并所有步骤
            all_steps = plan_steps + test_steps

            # 统计
            file_steps = [s for s in all_steps if s.get("action") in ("create_file", "edit_file", "delete_file")]
            cmd_steps = [s for s in all_steps if s.get("action") in ("run_command", "install_dep")]

            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data={
                    "constraints_count": len(constraints),
                    "plan_steps": all_steps,
                    "conflicts": conflicts,
                    "estimated_files": len(file_steps),
                    "estimated_commands": len(cmd_steps),
                    "summary": (
                        f"共 {len(all_steps)} 个执行步骤，"
                        f"{len(conflicts)} 个冲突，"
                        f"预计修改 {len(file_steps)} 个文件，"
                        f"执行 {len(cmd_steps)} 条命令"
                    ),
                },
            )
        except Exception as e:
            logger.error("Plan 节点执行失败: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"计划生成失败: {e}",
            )

    # ---- 读取上游 spec 输出 ----

    def _get_spec_data(self, context: NodeContext) -> Optional[Dict[str, Any]]:
        """从上游输出中获取 spec 节点的数据。"""
        # 优先从 input_data 获取（spec 节点直接连入时）
        for source in [context.input_data, context.upstream_outputs]:
            if not source:
                continue
            # 检查是否包含 spec 节点的特征字段
            if "constraints" in source and isinstance(source["constraints"], list):
                return source
            # 遍历上游节点输出
            for key, val in source.items():
                if isinstance(val, dict) and "constraints" in val and "success_criteria" in val:
                    return val
        return None

    # ---- Step 2: 零决策计划生成 ----

    async def _build_zero_decision_plan(
        self,
        enhanced: Dict[str, Any],
        constraints: List[Dict[str, Any]],
        criteria: List[Dict[str, Any]],
        depth: str,
        framework: str,
        model: str,
    ) -> List[Dict[str, Any]]:
        """调用 LLM 生成零决策执行计划。"""
        # 深度控制 prompt 详细程度
        depth_hint = {
            "quick": "给出关键步骤即可，每个约束最多 1 个步骤",
            "normal": "给出完整的实现步骤，确保每个 MUST 约束有对应步骤",
            "deep": "给出极详细的步骤，包含具体的代码内容",
        }.get(depth, "给出完整的实现步骤")

        prompt = f"""你是一位资深架构师。请将以下约束集转化为零决策的执行计划。

需求信息:
{json.dumps(enhanced, ensure_ascii=False, indent=2)}

约束列表 ({len(constraints)} 个):
{json.dumps(constraints, ensure_ascii=False, indent=2)}

成功判据:
{json.dumps(criteria, ensure_ascii=False, indent=2)}

目标技术栈: {framework or "自动推断"}

要求:
{depth_hint}

每个计划步骤必须是 ZERO-DECISION（零决策），格式:
{{
    "step_number": 1,
    "action": "create_file" | "edit_file" | "delete_file" | "run_command" | "install_dep",
    "description": "人类可读的简要说明",
    "file": "path/to/file",
    "exact_content": "完整文件内容（仅 create_file 时）",
    "search_content": "要查找的内容（仅 edit_file 时）",
    "replace_content": "替换为的内容（仅 edit_file 时）",
    "command": "要执行的命令",
    "constraint_ids": ["C01", "C02"],
    "verification_command": "验证命令",
    "rollback": "失败时的回滚命令"
}}

请以 JSON 数组格式返回，不要其他文字。"""

        result = await self._call_llm(prompt, model)
        steps = self._parse_json(result, [])
        if not isinstance(steps, list):
            steps = [steps]

        # 规范化步骤
        for i, s in enumerate(steps):
            if isinstance(s, dict):
                s.setdefault("step_number", i + 1)
                s.setdefault("action", "run_command")
                s.setdefault("description", "")
                s.setdefault("constraint_ids", [])
                s.setdefault("verification_command", "")
                s.setdefault("rollback", "")

        return steps

    # ---- Step 3: 冲突检测 ----

    def _detect_conflicts(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """检查步骤之间的冲突。"""
        conflicts: List[Dict[str, Any]] = []

        # 检查同一文件被多次修改
        file_steps: Dict[str, List[int]] = {}
        for s in steps:
            f = s.get("file", "")
            if f and s.get("action") in ("create_file", "edit_file", "delete_file"):
                file_steps.setdefault(f, []).append(s["step_number"])

        for filepath, step_nums in file_steps.items():
            if len(step_nums) > 1:
                conflicts.append({
                    "type": "file_conflict",
                    "file": filepath,
                    "steps": step_nums,
                    "description": f"文件 {filepath} 在步骤 {step_nums} 被多次修改",
                    "resolution": "建议合并为单个步骤，或标记 [需人工确认]",
                })

        # 检查依赖顺序问题（install_dep 应在 create_file/edit_file 之前）
        install_positions = [
            s["step_number"] for s in steps
            if s.get("action") == "install_dep"
        ]
        if install_positions:
            max_install = max(install_positions)
            file_positions = [
                s["step_number"] for s in steps
                if s.get("action") in ("create_file", "edit_file") and s["step_number"] < max_install
            ]
            if file_positions:
                conflicts.append({
                    "type": "order_conflict",
                    "steps": file_positions,
                    "description": f"文件操作步骤 {file_positions} 在安装依赖步骤 {max_install} 之前",
                    "resolution": "建议将安装依赖步骤移到文件操作之前",
                })

        return conflicts

    # ---- Step 4: 测试步骤生成 ----

    async def _generate_test_steps(
        self,
        criteria: List[Dict[str, Any]],
        framework: str,
        model: str,
    ) -> List[Dict[str, Any]]:
        """为成功判据生成对应的测试步骤。"""
        if not criteria:
            return []

        prompt = f"""你是一位测试工程师。请为以下成功判据生成对应的测试步骤。

成功判据:
{json.dumps(criteria, ensure_ascii=False, indent=2)}

目标技术栈: {framework or "自动推断"}

要求:
- 为每个判据生成 1-2 个测试步骤
- 包括单元测试、集成测试、边界测试
- 每个步骤格式与执行计划一致（action 为 run_command）

请以 JSON 数组格式返回，不要其他文字。"""

        result = await self._call_llm(prompt, model)
        test_steps = self._parse_json(result, [])
        if not isinstance(test_steps, list):
            test_steps = [test_steps]

        # 规范化并追加到主步骤编号之后
        for i, s in enumerate(test_steps):
            if isinstance(s, dict):
                s.setdefault("step_number", 1000 + i + 1)
                s.setdefault("action", "run_command")
                s.setdefault("description", "")
                s.setdefault("constraint_ids", [])
                s.setdefault("verification_command", s.get("command", ""))
                s.setdefault("rollback", "")

        return test_steps

    # ---- LLM 调用（复用 spec_node 的模式） ----

    async def _call_llm(self, prompt: str, model: str) -> str:
        """调用 OpenAI 兼容 API。"""
        import aiohttp

        url = f"{_LLM_API_BASE}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if _LLM_API_KEY:
            headers["Authorization"] = f"Bearer {_LLM_API_KEY}"

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "你是 Nexus OPSX 计划生成引擎。只返回 JSON 格式结果。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 8192,
        }

        timeout = aiohttp.ClientTimeout(total=_LLM_TIMEOUT)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise RuntimeError(f"LLM API 调用失败: HTTP {resp.status}, {text[:500]}")
                data = await resp.json()
                return data["choices"][0]["message"]["content"]

    @staticmethod
    def _parse_json(text: str, default: Any = None) -> Any:
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
