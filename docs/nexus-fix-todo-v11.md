# Nexus Fix Todo v11 — Spec 模板变量路径 + Agent LLM 配置 + Review 循环

> 创建时间：2026-03-21 16:20 UTC+8

---

## 已修复 ✅

### Fix K：spec_1 模板变量路径

**根因**：workflow definition 中 spec_1 的 requirement 模板写 `{{input.description}}`，但 input_1 节点 outputAlias 为 `"input"`，resolver 查找 `node_outputs["input_1"]["description"]`（不存在），正确路径是 `node_outputs["input_1"]["input"]["description"]`。

**修复**：workflow definition 中 spec_1 模板改为 `{{input.input.description}}`、`{{input.input.title}}`、`{{input.input.documents}}`。

**说明**：已在运行时 DB 修复，需同步到代码中的 workflow seed/template 定义。

---

## 待修复 Issues

### Issue F：agent_1/agent_2 使用 deepseek 但环境只有 minimax/glm

**现象**：agent_1 和 agent_2 节点显示 "LLM provider 'deepseek' not configured. Available: ['minimax', 'glm']"，fallback 到模拟响应，导致实际没有代码生成。

**根因**：workflow definition 中 agent_1/agent_2 的 `model` 字段写死了 `"deepseek:deepseek-chat"`，`api_base` 写死了其他地址。

```json
{
  "id": "agent_1",
  "type": "agent",
  "data": {
    "model": "deepseek:deepseek-chat",
    "api_base": "https://api.deepseek.com/...",
    "api_key": "..."
  }
}
```

**修复方向**：
1. 修改 workflow definition，将 model 改为 `glm` 或 `minimax`
2. 移除硬编码的 api_key（使用全局 LLM providers 配置）
3. 或者在 agent_node.py 中实现 model fallback：如果配置的 provider 不可用，自动尝试其他 provider

**涉及文件**：workflow definition（DB 或 seed 数据）

---

### Issue G：Review 失败后循环重试无上限

**现象**：agent_1 用模拟响应 → review_1 失败 → if_1 走 false 分支 → agent_2 → review_1 再次失败 → 循环。

**根因**：
1. workflow 定义中 agent_2 → review_1 形成循环（没有退出条件）
2. review_1 失败后没有重试上限处理

**修复方向**：
1. 在 workflow 定义中给循环路径增加退出条件（如重试次数 >= 3 则 goto output/fail）
2. 或者在 engine 的 error strategy 中处理：review 失败时 if_1 应该 goto output_1（fail path）而非 agent_2
3. 或者在 verify_1 中设置合理的 pass_rate 判断，if_1 走 fail path 时直接结束

**涉及文件**：workflow definition（CCDesk v4 工作流 DAG）

---

### Issue H：DATABASE_URL 绝对路径配置（稳定性）

**现状**：`.env` 中 `DATABASE_URL=sqlite:////root/.openclaw/workspace/agent-orchestration/backend/data/nexus.db`（已改为绝对路径）

**确认**：确保此配置在所有部署环境下保持绝对路径，避免 cwd 不同导致的 DB 文件不一致问题。

---

## 修复优先级

1. **Issue F**（agent LLM 配置）→ 阻塞实际功能，必须修
2. **Issue G**（循环重试）→ 高优先，review 失败后应优雅退出而非无限循环
3. **Issue H**（DATABASE_URL）→ 确认配置正确即可
