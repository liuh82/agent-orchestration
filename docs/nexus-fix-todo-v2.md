# Nexus 待修复问题清单 v2（2026-03-20 23:35）

> 助手诊断，用户本地 CC 修复。只给约束，不给代码。

---

## Fix A：MiniMax thinking tokens 导致 JSON 解析失败（根本原因）

**问题**：workflow spec_1 节点调用 MiniMax-M2.7-highspeed 后，返回内容以 `<thinkin>` 标签开头的推理过程，后面才是 JSON。`_parse_json` 直接 `json.loads()` 失败，constraints 返回空列表，plan_1 报"约束列表为空"。

**影响范围**：所有 LLM 节点（spec/plan/review/verify）调用 MiniMax 后解析 JSON 输出时都会遇到此问题。

**根因**：MiniMax 模型会输出 thinking tokens（推理过程），混在正式回答前面。当前 `_parse_json` 和 `llm_provider` 都没有处理这种情况。

**修复方向**（二选一，推荐方案 A1）：

**A1（推荐）：在 `llm_provider.chat_completion()` 返回前统一清理 thinking tokens**
- 文件：`backend/app/services/llm_provider.py`，`chat_completion` 方法的 return 前
- 在解析 assistant message content 后，用正则去除 `<thinkin>...</thinkin>` 标签及其内容
- 这样所有下游节点自动受益，不用逐个修改
- 注意：`<thinkin>` 标签可能是 `<thinkin>...</thinkin>` 或 `<thinkin>\n...\n</thinkin>`，需要非贪婪匹配

**A2（备选）：在各节点的 `_parse_json` 里增强容错**
- 文件：`spec_node.py`、`plan_node.py`、`review_node.py`、`verify_node.py` 的 `_parse_json` 方法
- 在 `json.loads()` 失败后，先尝试去除 thinking 标签再重试
- 缺点：每个节点都要改，且各节点实现可能不一致

---

## Fix B：verify_node.py 和 review_node.py 的 `_parse_json` 还是 `@staticmethod`

**问题**：CC 只修了 `plan_node.py` 和 `spec_node.py`，`verify_node.py` 和 `review_node.py` 的 `_parse_json` 仍标记为 `@staticmethod`（无 `self` 参数），但被以 `self._parse_json()` 方式调用。
- 文件：`backend/app/services/workflow_engine/nodes/verify_node.py`、`review_node.py`
- 与 Fix A 中 plan_node/spec_node 的修法一样：去掉 `@staticmethod`，加 `self` 参数

---

## Fix C：spec_1 节点执行记录未写入 DB

**现象**：spec_1 成功执行（日志确认调度了 plan_1），但 `workflow_node_executions` 表中无 spec_1 记录。
- 文件：`backend/app/services/workflow_engine/engine.py`
- `_execute_node` 第 297-302 行：节点执行后有 `db.commit()`，失败时有 `db.rollback()` 再 `db.flush()`
- 可能原因：spec_1 的 commit 成功了但 rollback 了？或者是 sequential 循环里的 `db.flush()` 在 spec_1 之后、commit 之前覆盖了什么？
- 排查方向：在 `_execute_node` 的 commit/rollback 处加 logger.info 记录每个节点的 commit 结果

---

## 优先级

| 优先级 | Fix | 理由 |
|--------|-----|------|
| P0 | A | 不修的话所有 LLM 节点都无法输出有效 JSON，workflow 全链路不通 |
| P1 | B | verify/review 节点到时会直接 TypeError 崩溃 |
| P2 | C | 功能正常但无执行记录，影响前端展示和调试 |
