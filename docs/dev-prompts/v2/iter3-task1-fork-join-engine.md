# Nexus 工作流改造 — 阶段1: Fork/Join 引擎层改造

> 请在 agent-orchestration 项目根目录执行。
> 前置条件：阶段0（Bug修复）已完成

## 必读文件（按顺序读完再动手）
1. CLAUDE.md — 项目规范
2. `backend/app/services/workflow_engine/engine.py` — 核心引擎（重点关注 `_schedule_nodes`、`_execute_node`、`_get_next_nodes_v1`、`_check_completion`）
3. `backend/app/services/workflow_engine/nodes/base.py` — `NodeContext` 和 `NodeResult`
4. `backend/app/services/workflow_engine/nodes/parallel.py` — 现有 parallel 节点（参考其并行逻辑）
5. `backend/app/services/workflow_engine/variable_resolver.py` — 变量解析器（无需修改，但需理解其工作方式）
6. `docs/dev-prompts/v2/workflow-node-redesign.md` — 需求文档，重点看 §3.5 fork 和 §3.6 join 的 CONFIG_SCHEMA

## 任务目标
实现 fork 和 join 两种新节点的后端执行器，以及引擎层的多入度等待支持。

### 1. 创建 fork 节点执行器
文件：`backend/app/services/workflow_engine/nodes/fork.py`

参考 `parallel.py` 的实现模式，但关键区别：
- **broadcast 模式**：所有下游分支收到相同的 upstream_outputs
- **distribute 模式**：第 N 个分支额外注入 `branchData[N]` 的数据
- 输出端口数量 = branchCount，每个端口对应一条边（sourceHandle: `branch_0`, `branch_1`, ...）
- 通过 `sourceHandle` 路由到不同的下游节点

CONFIG_SCHEMA（参考需求文档 §3.5）：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "Fork" },
    "mode": { "type": "string", "enum": ["broadcast", "distribute"], "default": "broadcast" },
    "branchCount": { "type": "integer", "minimum": 2, "maximum": 10, "default": 2 },
    "branchData": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": { "type": "string" },
          "data": { "type": "string" }
        }
      }
    }
  },
  "required": ["branchCount"]
}
```

execute() 返回值：
```python
NodeResult(
    status=NodeStatus.SUCCESS,
    output_data={
        "mode": "broadcast" or "distribute",
        "branch_count": N,
        "branch_labels": ["前端", "后端"],  # 如果有
    },
    # 不设置 next_node_ids，由引擎的 sourceHandle 路由处理
)
```

### 2. 创建 join 节点执行器
文件：`backend/app/services/workflow_engine/nodes/join.py`

这是最核心的改造——join 需要引擎层的"多入度等待"支持。

**join 节点自身很简单**：
- execute() 只需要记录"我是 join 节点，需要等待 N 个上游"
- 实际的等待和合并逻辑在引擎层实现

CONFIG_SCHEMA（参考需求文档 §3.6）：
```json
{
  "type": "object",
  "properties": {
    "label": { "type": "string", "title": "标签", "default": "Join" },
    "mode": { "type": "string", "enum": ["all", "any", "n_of_m"], "default": "all" },
    "requiredCount": { "type": "integer", "minimum": 1, "default": 2 },
    "mergeStrategy": { "type": "string", "enum": ["append", "merge", "custom"], "default": "append" },
    "extractFields": { "type": "array", "items": { "type": "string" } },
    "timeout": { "type": "integer", "minimum": 10, "maximum": 86400, "default": 3600 },
    "onTimeout": { "type": "string", "enum": ["fail", "continue_with_ready", "skip"], "default": "continue_with_ready" }
  },
  "required": ["mode"]
}
```

### 3. 引擎层改造（engine.py）

#### 3a. 多入度等待机制

核心问题：当前 `_execute_node` 执行完一个节点后直接调度下游。但 join 节点需要等待**所有上游**完成后才能执行。

实现方案：
```python
# 新增模块级变量
_pending_join_inputs: Dict[str, Dict[str, Any]] = {}  
# key: "(join_node_id)", value: { source_node_id: output_data, ... }

# 在 _execute_node 的第12步（调度下游前）增加：
# 检查下游节点是否是 join 类型
# 如果是，将当前节点输出写入 _pending_join_inputs
# 检查 join 节点的所有上游是否都已完成
# 如果是，执行 join 节点；否则等待
```

具体逻辑：
1. 在 `_execute_node` 的 step 12（调度下游）前，遍历下游节点
2. 对每个下游节点，查找其 `node_type`
3. 如果下游是 `join`：
   - 将 `(上游id, 输出数据)` 存入 `_pending_join_inputs["(join_node_id)"]`
   - 计算该 join 节点的入度（通过 edges 找到所有连入的 source 节点数）
   - 如果已收集的上游数 == 入度：执行 join 节点
   - 否则：不调度，等待其他上游完成
4. 如果下游不是 join：正常调度

#### 3b. join 节点的合并逻辑

当所有上游完成后，引擎调用 join 执行器的合并方法：
- `append`：`{"branch_0": output0, "branch_1": output1, "merged": [output0, output1]}`
- `merge`：深度合并所有上游输出
- `custom`：按 extractFields 提取指定字段

#### 3c. fork 的 sourceHandle 路由

在 `_get_next_nodes_v1` 中增加 fork 类型的路由：
```python
if node_type == "fork":
    # fork 的输出端口是 branch_0, branch_1, ...
    # 返回所有连线的下游节点（引擎会通过 sourceHandle 自动路由）
    # 与默认行为一致，但需要确保 sourceHandle 正确传递
```

实际上 fork 的路由可以复用现有的默认逻辑（follow all outgoing edges），因为下游节点通过 edges 的 sourceHandle 区分来自哪个分支。

#### 3d. 清理

在 `_execute_node` 的 step 12 中，调度下游时，将 branch 信息通过 upstream_outputs 传递：
```python
# 对 fork 的下游节点，注入分支标识
if node_type == "fork":
    for e in outgoing:
        handle = e.get("sourceHandle", "")
        target_id = e.get("target") or e.get("to", "")
        branch_index = handle.replace("branch_", "") if handle.startswith("branch_") else None
        # 在调度时将 branch_index 信息传给下游
```

### 4. 注册节点

在 `backend/app/services/workflow_engine/nodes/__init__.py` 中导入并注册 fork 和 join：
```python
from .fork import ForkNode
from .join import JoinNode
```

在 `backend/app/services/workflow_engine/registry.py` 中注册（或使用装饰器）。

## 关键注意事项

1. **不要破坏现有逻辑**：if/switch/loop/parallel 的路由逻辑保持不变
2. **_completed_nodes 的类型**：是 `Dict[str, Set[str]]`，注意阶段0已修复为 `{}`，使用时是 `_completed_nodes.get(execution_id, set())`
3. **VariableResolver 兼容性**：join 的输出存为 `branch_0.xxx`、`branch_1.xxx` 格式，resolver 的 `{{ node_id.output.field }}` 天然支持
4. **parallel 节点保留**：不要删除 parallel.py，fork/join 是新增而非替代
5. **异步安全**：多入度等待机制要处理好并发（多个上游同时完成时的竞态条件），使用简单的锁或原子操作
6. **内存泄漏**：join 完成后要清理 `_pending_join_inputs` 中的对应条目

## 完成标准

- [ ] `backend/app/services/workflow_engine/nodes/fork.py` 创建完成
- [ ] `backend/app/services/workflow_engine/nodes/join.py` 创建完成
- [ ] `engine.py` 多入度等待机制实现
- [ ] `engine.py` fork sourceHandle 路由实现
- [ ] 节点注册完成
- [ ] 后端可正常启动：`cd backend && python3 -c "from app.services.workflow_engine.engine import workflow_engine; print('OK')"`
- [ ] 现有测试仍通过（如果有测试的话）
- [ ] 不要 git commit（等后续阶段完成后一起提交）

## 测试验证建议

可以用 curl 测试一个简单的 fork→两个agent→join 工作流（不需要真的执行 agent，只需要验证引擎的路由和等待逻辑）：

```json
{
  "version": "1.0",
  "name": "fork-join-test",
  "nodes": [
    {"id": "n1", "type": "manual_trigger", "position": {"x": 0, "y": 0}, "data": {"label": "触发"}},
    {"id": "n2", "type": "fork", "position": {"x": 0, "y": 0}, "data": {"label": "Fork", "mode": "broadcast", "branchCount": 2}},
    {"id": "n3", "type": "code", "position": {"x": 0, "y": 0}, "data": {"label": "分支A", "language": "python", "code": "result = 'A'"}},
    {"id": "n4", "type": "code", "position": {"x": 0, "y": 0}, "data": {"label": "分支B", "language": "python", "code": "result = 'B'"}},
    {"id": "n5", "type": "join", "position": {"x": 0, "y": 0}, "data": {"label": "Join", "mode": "all", "mergeStrategy": "append"}},
    {"id": "n6", "type": "output", "position": {"x": 0, "y": 0}, "data": {"label": "输出", "format": "json"}}
  ],
  "edges": [
    {"id": "e1", "source": "n1", "target": "n2"},
    {"id": "e2", "source": "n2", "target": "n3", "sourceHandle": "branch_0"},
    {"id": "e3", "source": "n2", "target": "n4", "sourceHandle": "branch_1"},
    {"id": "e4", "source": "n3", "target": "n5"},
    {"id": "e5", "source": "n4", "target": "n5"},
    {"id": "e6", "source": "n5", "target": "n6"}
  ]
}
```

## 不要做的事
- 不要修改 VariableResolver
- 不要修改 if/switch/loop/parallel 节点
- 不要做数据库迁移
- 不要 git commit
- 不要修改前端代码（本阶段只做后端）
