# Nexus Bug 修复清单

> 整理日期：2026-03-20
> 状态：待修复
> 修复方式：本地 CC 执行

---

## Bug 分类

| # | 严重度 | 类别 | 标题 | 影响范围 |
|---|--------|------|------|---------|
| 1 | 🔴 P0 | 工作流引擎 | 变量解析：节点直接调用 resolve_template 绕过 alias_map | spec/agent/code/http 等所有使用变量模板的节点 |
| 2 | 🔴 P0 | 工作流引擎 | db.commit 时序：所有并行节点完成后才 commit，中途 crash 丢失所有进度 | 所有工作流执行 |
| 3 | 🟡 P1 | API 序列化 | WorkflowConfig Pydantic 嵌套对象无法 JSON 序列化 → 500 | GET /api/v1/workflows/ 和 GET /api/v1/workflows/{id} |
| 4 | 🟡 P1 | 前端 | 前端项目列表/详情页看不到数据（API 路径或认证问题） | 前端项目管理页 |
| 5 | 🟡 P1 | 工作流引擎 | Agent 节点模型配置 `zai-coding-plan:glm-5` 找不到 → 节点执行失败 | agent 类型节点 |
| 6 | 🟢 P2 | 工作流引擎 | Node.js 版本问题影响 oc-bridge 运行 | bridge 启动 |

---

## Bug 详情

### Bug #1: 变量解析绕过 alias_map（P0）

**现象：** 工作流中 input 节点配置了 outputAlias="input"，spec 节点用 `{{input.description}}` 引用，但变量解析失败。

**根因：** 多个节点直接调用 `variable_resolver.resolve_template()` 模块函数，**不传 alias_map 参数**，而 alias_map 只存在 `VariableResolver` 实例中。

**受影响节点：**
- `spec_node.py:88` — `resolve_template(requirement, context.upstream_outputs, ...)` 缺少 `alias_map=resolver._alias_map`
- `agent.py:136` — 同样缺少 `alias_map`
- `code_node.py:85` — 同样
- `http_node.py:96-98` — `resolve_template_deep` 同样
- `if_node.py:160` — `resolve_variable` 同样
- `loop_node.py:130,166` — 同样
- `switch_node.py:85` — 同样
- `transform.py:85,107` — 同样
- `sub_workflow_node.py:111` — 同样
- `plan_node.py` — 如果存在同样问题

**修复方案：**

1. 在 `NodeContext` 中添加 `resolver: Optional[VariableResolver]` 字段
2. engine 的 `_execute_node` 在创建 `NodeContext` 时注入 resolver
3. 所有节点从 `context.resolver.resolve_template(...)` 调用，而不是直接调用模块函数
4. 删除所有节点中直接 import 的 `resolve_template` / `resolve_variable` / `resolve_template_deep`

**修复文件：**
- `backend/app/services/workflow_engine/nodes/base.py` — NodeContext 加 resolver 字段
- `backend/app/services/workflow_engine/engine.py` — 创建 NodeContext 时注入 resolver
- `backend/app/services/workflow_engine/nodes/spec_node.py`
- `backend/app/services/workflow_engine/nodes/agent.py`
- `backend/app/services/workflow_engine/nodes/code_node.py`
- `backend/app/services/workflow_engine/nodes/http_node.py`
- `backend/app/services/workflow_engine/nodes/if_node.py`
- `backend/app/services/workflow_engine/nodes/loop_node.py`
- `backend/app/services/workflow_engine/nodes/switch_node.py`
- `backend/app/services/workflow_engine/nodes/transform.py`
- `backend/app/services/workflow_engine/nodes/sub_workflow_node.py`
- `backend/app/services/workflow_engine/nodes/plan_node.py`（如存在）

---

### Bug #2: db.commit 时序（P0）

**现象：** 工作流执行时所有节点并行跑，但只在 `asyncio.gather` 的 `finally` 块中 commit 一次。如果中途 crash 或异常，所有节点的执行记录和输出都丢失。

**根因：** engine.py L179 只有一个 `db.commit()`，在所有并行节点执行完之后。

**修复方案：**

1. 在 `_execute_node` 中，每个节点完成后立即 `db.flush()`（已有）
2. 在 `_execute_node` 中，节点完成后增加 `db.commit()`（而非统一在 gather 后 commit）
3. 保留 gather finally 中的 `db.commit()` 作为兜底
4. 注意：并发 commit 可能引发 SQLite "database is locked"，需要加锁或用 WAL 模式

**修复文件：**
- `backend/app/services/workflow_engine/engine.py` — _execute_node 中增加节点级 commit
- 可能需要调整 SQLite WAL 模式配置

---

### Bug #3: WorkflowConfig 序列化 500（P1）

**现象：** `GET /api/v1/workflows/` 和 `GET /api/v1/workflows/{id}` 返回 HTTP 500。

**根因：** workflow 的 config 字段存储的是 JSON 字符串，反序列化后得到 `WorkflowConfig` Pydantic 对象，FastAPI 的 `JSONResponse` 无法序列化 Pydantic 嵌套对象。

**修复方案：**

确保 workflows 路由的 `get_all_workflows()` 和 `get_workflow()` 返回的是 dict 而非 Pydantic 对象。具体做法：
- 读取 DB 后用 `json.loads(config_str)` 解析为 dict
- 或者返回前 `model.model_dump()` / `model.dict()`

**修复文件：**
- `backend/app/routers/workflows.py` — get_workflows / get_workflow
- `backend/app/services/workflow.py` — 确保返回 dict

---

### Bug #4: 前端项目列表看不到数据（P1）

**现象：** 数据库中有项目数据（`b8261dca... Claude Code Desktop`），但前端看不到。

**排查方向：**
1. 前端 API 路径是否正确（`/api/v1/projects`）
2. 认证 token 是否正确传递
3. CORS 配置是否正确
4. 前端是否正确渲染返回数据

**修复方案：** 需要先在前端 DevTools 确认 API 请求状态码和返回内容，然后针对性修复。

**修复文件：**
- 前端项目列表组件
- 可能涉及 API 路径或认证配置

---

### Bug #5: Agent 节点模型配置找不到（P1）

**现象：** 工作流中 agent 节点配置了 `model: "zai-coding-plan:glm-5"`，执行时报错找不到模型。

**根因：** `agent.py` L120 直接读取 `context.node_config.get("model", "")` 传给下游。这个模型 ID 格式（`provider:model`）需要解析和路由。

**修复方案：**

1. agent 节点应该支持 `model` 配置，但需要正确路由到对应的 LLM API
2. 如果通过 Gateway 提交任务（oc-bridge），模型配置应该在 bridge 层面处理
3. 如果 agent 节点直接调用 LLM API，需要支持 OpenAI 兼容的 `base_url` + `model` 格式
4. 建议在 agent 节点 config 中增加可选的 `apiBase` / `apiKey` 字段，或者使用全局配置

**修复文件：**
- `backend/app/services/workflow_engine/nodes/agent.py` — 模型路由逻辑
- 可能需要新建 `backend/app/services/llm_provider.py` — LLM provider 统一调用层

---

### Bug #6: Node.js 版本问题（P2）

**现象：** oc-bridge 运行时 Node.js 版本不匹配。

**当前状态：** 服务器上 Node.js v22.22.0（通过 nvm 安装），位于 `/root/.nvm/versions/node/v22.22.0/bin/node`。

**修复方案：**
1. 确认 oc-bridge 的 package.json 要求的 Node.js 版本
2. 如果要求 <= 18，考虑升级 oc-bridge 的 engines 字段或安装 nvm 多版本
3. 确保 bridge 启动脚本使用正确的 node 路径

**修复文件：**
- `bridges/oc-bridge/package.json` — engines 字段
- bridge 启动脚本

---

## 修复优先级建议

1. **先修 Bug #1（变量解析）** — 这是最核心的问题，导致整个工作流数据流断裂
2. **再修 Bug #2（db.commit）** — 数据丢失风险
3. **然后 Bug #3（序列化）** — API 可用性
4. **Bug #4 前端排查** — 需要先修好 API 才能确认
5. **Bug #5 模型配置** — 需要设计方案
6. **Bug #6 Node.js** — 非阻塞

---

## 测试验证方案

修完每个 bug 后：

1. **Bug #1 验证：** 在 Nexus 上创建工作流：input → spec，input 节点配置 outputAlias="input"，spec 节点用 `{{input.description}}`，确认变量正确解析
2. **Bug #2 验证：** 运行工作流，中途 kill 后端进程，重启后检查 workflow_node_executions 表是否有已完成节点的记录
3. **Bug #3 验证：** `curl http://127.0.0.1:8082/api/v1/workflows/` 返回 200
4. **Bug #4 验证：** 前端项目列表能显示 Claude Code Desktop 项目
5. **Bug #5 验证：** agent 节点配置 `model: "zai-coding-plan:glm-5"` 能正常执行
6. **Bug #6 验证：** `node dist/index.js start` 正常启动
