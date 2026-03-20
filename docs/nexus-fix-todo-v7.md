# Nexus 待修复问题清单 v7（2026-03-21 00:45）

> 助手诊断，用户本地 CC 修复。只给约束，不给代码。

---

## Fix J（P0）：`_parse_json` 需要增加"扫描 JSON 起始符"fallback

**问题**：MiniMax 的输出行为不确定：
- 有时用 `💭...💭` emoji 包裹推理 + ` ```json``` ` 代码块
- 有时纯文本推理 + ` ```json``` ` 代码块
- 有时纯文本推理 + **裸 JSON**（无代码块、无 emoji）

当前 `_parse_json` 只有两层兜底（直接解析 + 代码块提取），覆盖不了"裸 JSON"的情况。thinking tokens 的正则清理也不稳定（emoji 对不齐）。

**影响范围**：所有 LLM 节点的 `_parse_json` — spec_node, plan_node, review_node, verify_node

**文件**：四个节点文件里的 `_parse_json` 方法

**修复方向**：在代码块提取失败后，增加第三层 fallback：从文本中扫描最后一个 `[` 或 `{` 的位置，向后找到匹配的闭合括号，尝试 `json.loads`。

选择"最后一个"而非"第一个"是因为 MiniMax 的 JSON 通常出现在文本末尾，前面的推理文本里可能包含 `[` 或 `{`（列表描述、JSON 代码片段等）。

**也可以考虑**：在 `llm_provider.chat_completion()` 里统一做更鲁棒的 thinking 清理（不依赖特定 emoji），但 emoji 标记不确定，不如让 `_parse_json` 自己兜底更可靠。

---

## 测试数据

MiniMax 实际输出示例（10962 chars）：
- 前 6943 chars：纯文本推理（无 emoji、无标签）
- 6943-10961 chars：裸 JSON 数组 `[...]`（13 项约束）
- 无 ` ```json``` ` 代码块
- 正则 `💭.*?🔖` 无匹配（cleaned == raw）

---

## 已确认通过但 DB 中 spec_1 记录缺失

spec_1 在某些测试中能成功执行但不在 `workflow_node_executions` 表中。疑似原因：WAL 模式 + 后续节点 rollback 导致。删除 WAL 后恢复正常。建议后续启动流程始终包含 `rm -f data/nexus.db-wal data/nexus.db-shm`。
