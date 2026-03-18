# 迭代三 T2：工作流改造 P0 修复

## 背景
工作流改造方案经老张评审后，部分 P0 问题已在迭代二期间修复。本 prompt 只处理仍存在的 3 个真实 P0 问题。

## 必读文件

### 需要修改的文件
- `backend/app/services/workflow_engine/engine.py` — 修复 outgoing bug
- `backend/app/services/workflow_engine/nodes/agent.py` — 补充 CONFIG_SCHEMA 字段
- `backend/app/services/workflow_engine/variable_resolver.py` — 支持 outputAlias 别名映射

### 参考文件（只读）
- `backend/app/services/workflow_engine/nodes/input.py` — 已有 outputAlias 使用示例
- `backend/app/services/workflow_engine/nodes/context_output.py` — 已有 outputAlias 使用
- `backend/app/services/workflow_engine/nodes/result_output.py` — 已有 outputAlias 使用
- `backend/app/services/workflow_engine/nodes/base.py` — NodeContext, NodeResult
- `backend/app/services/workflow_engine/registry.py` — NodeRegistry

## 修改内容

### 1. 修复 engine.py outgoing 变量未定义（line ~374）

**问题**：`_execute_node` 方法中，fork 分支数据处理使用了 `outgoing` 变量，但该变量未在 `_execute_node` 中定义。`outgoing` 只在 `_get_next_nodes_v1` 方法中定义。

**修复方案**：在 `_execute_node` 的 fork 处理之前，从 `edges` 中计算 outgoing 列表：

```python
# 在 fork 处理前添加
outgoing_edges = [
    e for e in edges
    if (e.get("source") or e.get("from", "")) == node_id
]

# 然后用 outgoing_edges 替代 outgoing
if node_type == "fork":
    fork_mode = node_config.get("mode", "broadcast")
    branch_data_list = node_config.get("branchData", [])
    for e in outgoing_edges:
        # ...
```

**注意**：确认 `_execute_node` 方法的参数中是否有 `edges`。如果没有，需要从其他来源获取。

### 2. agent 节点 CONFIG_SCHEMA 补充字段

在 `agent.py` 的 CONFIG_SCHEMA 中添加以下 6 个字段：

```python
"agentSelectMode": {
    "type": "string",
    "title": "Agent Select Mode",
    "description": "How to select agent: 'select' (from list) or 'manual' (free input)",
    "default": "select",
    "enum": ["select", "manual"],
},
"workDir": {
    "type": "string",
    "title": "Working Directory",
    "description": "Working directory for agent execution (absolute or relative to project)",
},
"envVars": {
    "type": "string",
    "title": "Environment Variables",
    "description": "JSON string of extra env vars, e.g. '{\"NODE_ENV\": \"production\"}'",
},
"outputFormat": {
    "type": "string",
    "title": "Output Format",
    "description": "Agent output format: 'text', 'json', 'markdown'",
    "default": "text",
},
"outputAlias": {
    "type": "string",
    "title": "Output Alias",
    "description": "Alias name for referencing this node's output in downstream nodes (default: node_id)",
},
"gitEnabled": {
    "type": "boolean",
    "title": "Enable Git Integration",
    "description": "Whether to create git branch and commit changes for this agent task",
    "default": false,
},
```

同时更新 `execute` 方法：
- 读取 `workDir`，作为 agent 执行的工作目录（如果设置）
- 读取 `outputFormat`，格式化输出（可选，先标记 TODO）
- 读取 `outputAlias`，使用别名注册节点输出
- `gitEnabled` 先标记 TODO（Git 集成是 P1，本次不实现）

### 3. outputAlias 别名映射

**问题**：input 节点用 `output_alias` 存储（如 `output_data={output_alias: collected}`），但 VariableResolver 的 `resolve_variable()` 用 node_id 查找。如果用户设置了 `outputAlias: "myInput"`，则 `{{ myInput.xxx }}` 无法解析。

**修复方案**：在 VariableResolver 中增加别名映射支持：

```python
class VariableResolver:
    def __init__(self, ...):
        self._node_outputs = {}
        self._alias_map: Dict[str, str] = {}  # alias -> node_id

    def set_node_output(self, node_id: str, output: Any, alias: str | None = None):
        """Store a node's output for later reference."""
        self._node_outputs[node_id] = output
        if alias and alias != node_id:
            self._alias_map[alias] = node_id
```

然后在 `resolve_variable()` 中，当 root 不是已知前缀（workflow/env/context/loop）时，先查 alias_map：

```python
# In resolve_variable function
# Check if the root is an alias
actual_id = alias_map.get(root, root)
if actual_id in node_outputs:
    return navigate_path(node_outputs[actual_id], path)
```

**关键**：需要同步修改调用 `set_node_output` 的地方：
- `engine.py` 中 `set_node_output(node_id, result.output_data)` — 增加可选 alias 参数
- `input.py`、`context_output.py`、`result_output.py` 中已有的 outputAlias 逻辑
- `agent.py` 中新增的 outputAlias 支持

## 验收标准

1. **Bug 修复**：包含 fork 节点的工作流能正常执行，不报 `NameError: name 'outgoing' is not defined`
2. **CONFIG_SCHEMA**：`GET /api/v1/workflows/node-schema/agent` 返回的 schema 包含 6 个新字段
3. **outputAlias**：input 节点设置 `outputAlias: "myInput"` 后，下游节点可以用 `{{ myInput.xxx }}` 引用

## 禁止事项
- 不要新增后端节点文件（5 个节点已实现）
- 不要修改前端代码（前端适配是 T2 的后续步骤）
- 不要实现 Git 集成（P1 范围）
- 不要修改数据库模型
