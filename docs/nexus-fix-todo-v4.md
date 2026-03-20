# Nexus 待修复/需求清单 v4（2026-03-20 23:55）

> 助手诊断，用户本地 CC 修复。只给约束，不给代码。

---

## Fix A（✅ 已修复）：MiniMax thinking tokens

CC 已修：`llm_provider.py` 正则清理 `<thinkin>` 标签。

## Fix B（P1）：verify_node.py / review_node.py `_parse_json` 还是 `@staticmethod`

**问题**：去掉 `@staticmethod`，加 `self` 参数。同 plan_node/spec_node 之前的修法。

---

## Fix C（P0）：前端任务详情"实时输出"收不到 workflow 执行事件

**问题**：`WorkflowEventPublisher` → `ws_manager`，前端 SSE 读的是 `event_store`，两套事件系统未桥接。

**修复方向**：在 `event_publisher.publish()` 里同时推入 `event_store`。需建立 execution_id → task_id 映射。

---

## Fix E（P0）：agent 节点字段名不匹配

**问题**：Workflow 定义中 agent 节点配置使用下划线命名（`agent_id`、`prompt_template`），但 `agent.py` 读的是驼峰命名（`agentId`、`prompt`），导致 agent 节点报 "agentId or prompt is required"。

**文件**：`backend/app/services/workflow_engine/nodes/agent.py` 第 117-118 行

**修复方向**：`agent.py` 在读取 `agentId`/`prompt` 时，同时 fallback 到 `agent_id`/`prompt_template`：

```
agent_id = node_config.get("agentId") or node_config.get("agent_id", "")
prompt = node_config.get("prompt") or node_config.get("prompt_template", "")
```

**影响**：agent_1 和 agent_2 都受影响，不修的话编码节点完全无法执行。

---

## 需求 D（P1）：任务详情页实时输出增加工作流可视化

（同 v3，略）

---

## 验证结果（2026-03-20 23:55）

最新测试（thinking tokens 修复后）：

| 节点 | 状态 | 备注 |
|------|------|------|
| trigger_1 | ✅ success | |
| input_1 | ✅ success | 4ms |
| spec_1 | ✅ success | constraints 提取成功（DB 记录仍缺失，Fix C 范畴） |
| plan_1 | ✅ success | 96s，生成 38 步计划 |
| agent_1 | ❌ failed | 字段名不匹配（Fix E） |
| review_1 | ⏳ 未执行 | 依赖 agent_1 |
| verify_1 | ⏳ 未执行 | 依赖 review_1 |
| output_1 | ⏳ 未执行 | 依赖 verify_1/agent_2 |

**Fix E 修完后预期**：agent_1 会尝试 dispatch 到 Claude Code bridge，如无 bridge 连接可能 fallback 到 LLM 直调（需 GLM/MiniMax API key 在节点配置中）。
