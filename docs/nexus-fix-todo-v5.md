# Nexus 待修复问题清单 v5（2026-03-21 00:10）

> 助手诊断，用户本地 CC 修复。只给约束，不给代码。

---

## Fix F（P0）：MiniMax thinking 格式是 `<think>...</think>`，不是 `<thinkin>`

**问题**：CC 加的正则 `<thinkin>.*?</thinkin>` 没有匹配到 MiniMax 的实际 thinking 格式。实际格式是：

```
<think>
（推理过程）
💭 （可选）
```json
{...JSON...}
```
</think>
```

**文件**：`backend/app/services/llm_provider.py`

**修复方向**：清理逻辑改为先去掉 `<think>...</think>` 标签，再用现有逻辑提取 ```json 代码块：

```python
# 1. 先去掉 thinking 标签
content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
# 2. _parse_json 在各节点里会处理 ```json 代码块提取
```

或者更简单：**在 `_parse_json` 里对清理后的文本提取 ` ```json...``` ` 代码块**，这应该能覆盖大部分 LLM 输出（不管有没有 thinking）。

---

## Fix G（P0）：agent_1 写 tasks 表时 `project_id` 为 NULL

**问题**：agent 节点尝试创建子 task 记录时，`tasks.project_id` 为 NULL，触发 `IntegrityError`，导致整个 session rollback。

**文件**：`backend/app/services/workflow_engine/nodes/agent.py`

**根因**：agent 节点调用 `_dispatch_agent()` 创建子 task 时，没有正确传入 `project_id`。

**修复方向**：在 `agent.py` 的 task 创建逻辑里，确保传入正确的 `project_id`（从 `context.input_data` 或 `context.upstream_outputs` 获取）。

---

## Fix H（P1）：review_node 用了 `gpt-4o` 而不是 MiniMax

**问题**：review_1 报错 `invalid params, unknown model 'gpt-4o'`。review_node 没有从 node_config 读 model，回退到了环境变量 `NEXUS_LLM_MODEL=gpt-4o`。

**文件**：`backend/app/services/workflow_engine/nodes/review_node.py`

**修复方向**：review_node 的 `_call_llm` 方法里，`model` 参数应该从 `context.node_config.get("model")` 获取，与 plan_node/spec_node 保持一致。

**注意**：verify_node 可能也有同样问题，一并检查。

---

## 验证结果（2026-03-21 00:10）

| 节点 | 状态 | 根因 |
|------|------|------|
| trigger_1 | ✅ | |
| input_1 | ✅ | |
| spec_1 | ⚠️ | thinking 格式不匹配，constraints 为空 |
| plan_1 | ⚠️ | 依赖 spec_1 输出 |
| agent_1 | ❌ | project_id NULL |
| review_1 | ❌ | gpt-4o 模型未配置 |
| verify_1 | ⏳ | 未执行 |
| output_1 | ⏳ | 未执行 |
