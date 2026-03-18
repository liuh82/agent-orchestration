# 工作流改造方案评审报告

**评审日期：** 2026-03-18
**评审对象：** `docs/dev-prompts/v2/workflow-node-redesign.md`
**评审者：** 老张（系统架构师）

---

## 一、总体评价

改造方案整体设计思路清晰，节点分类合理，前端类型定义较为完整。但**后端实现与改造方案存在多处不一致**，部分新增节点缺少后端实现规划，数据模型变更不完整。

**建议：** 先修复 P0 问题再进入开发阶段。

---

## 二、修改建议清单

### P0（必须改）

| # | 问题 | 位置 | 修改建议 |
|---|------|------|---------|
| **P0-1** | **engine.py 第 476 行变量未定义** | engine.py:476 | `for e in outgoing:` 引用了 `outgoing` 变量，但该变量在此作用域未定义。应在方法开头计算 `outgoing = [e for e in edges if (e.get("source") or e.get("from", "")) == node_id]` |
| **P0-2** | **fork 节点后端未实现** | registry.py / nodes/ | 改造方案定义了 fork 节点，但后端没有 `ForkNodeExecutor` 实现。需新增 `backend/app/services/workflow_engine/nodes/fork_node.py` |
| **P0-3** | **join 节点后端未实现** | registry.py / nodes/ | 同上，需新增 `join_node.py`。当前引擎的 `_handle_join_upstream` 只是引擎层面的调度逻辑，节点本身的 `execute()` 方法缺失 |
| **P0-4** | **input 节点后端未实现** | registry.py / nodes/ | 需新增 `input_node.py`，实现从 project/task/DB 提取上下文的逻辑 |
| **P0-5** | **context_output 节点后端未实现** | registry.py / nodes/ | 需新增 `context_output_node.py` |
| **P0-6** | **result_output 节点后端未实现** | registry.py / nodes/ | 需新增 `result_output_node.py` |
| **P0-7** | **agent 节点 CONFIG_SCHEMA 不匹配** | 改造方案 3.2 vs agent.py | 改造方案定义了 `agentSelectMode`、`gitEnabled`、`workDir`、`envVars`、`outputFormat`、`outputAlias` 等字段，但现有 `AgentNodeExecutor.CONFIG_SCHEMA` 完全没有这些字段。需同步更新 |
| **P0-8** | **outputAlias 机制未实现** | variable_resolver.py | 改造方案中 input/context_output/agent 节点都支持 `outputAlias`，但 `VariableResolver.set_node_output()` 直接用 `node_id` 作为 key，不支持别名映射 |

### P1（建议改）

| # | 问题 | 位置 | 修改建议 |
|---|------|------|---------|
| **P1-1** | **数据模型缺少 Git 相关字段** | 改造方案 5.2 | 改造方案定义了 8 个 Git 相关字段（git_enabled、git_platform、git_repo_url 等），但未标注哪些需要新增到 `projects` 表。需明确数据库迁移脚本 |
| **P1-2** | **WorkflowNodeExecution 缺少字段** | models/workflow_execution.py | 建议新增：`node_label`、`node_category`、`upstream_node_ids`、`output_alias` 字段，便于 UI 展示和调试 |
| **P1-3** | **join 超时策略实现不完整** | engine.py `_handle_join_upstream` | 改造方案定义了 `onTimeout: fail \| continue_with_ready \| skip`，但引擎只实现了 `continue_with_ready` 逻辑 |
| **P1-4** | **fork distribute 模式数据注入时机错误** | engine.py:472-481 | `branchData` 注入逻辑在 `_execute_node` 方法中，但此时已经调用了 `_schedule_nodes`，数据注入应该更早 |
| **P1-5** | **变量解析器缺少 project/task 快捷访问** | variable_resolver.py | 改造方案提到 `{{ project.name }}`、`{{ task.title }}` 语法，但当前 VariableResolver 不支持这些快捷路径。需扩展 `resolve_variable()` |
| **P1-6** | **agent 节点 Git 集成缺失** | agent.py | 改造方案定义了 `gitEnabled` 配置，但 `AgentNodeExecutor` 没有 Git 操作逻辑 |
| **P1-7** | **loop 嵌套时上下文清理不明确** | engine.py | 当 loop 嵌套（loop 内部还有 loop）时，`_loop_context` 的清理时机不明确，可能导致内层 loop 结束后外层 loop 上下文丢失 |

### P2（可选优化）

| # | 问题 | 位置 | 修改建议 |
|---|------|------|---------|
| **P2-1** | **webhook_trigger 前端配置面板缺失** | 改造方案 | 标注为「新增前端」，但未定义配置面板结构 |
| **P2-2** | **transform 节点前端配置面板缺失** | 改造方案 | 同上 |
| **P2-3** | **notification 节点前端配置面板缺失** | 改造方案 | 同上 |
| **P2-4** | **human 节点前端配置面板缺失** | 改造方案 | 同上 |
| **P2-5** | **连线样式实现细节不足** | 改造方案 4 | 定义了 5 种边样式，但未说明如何与 React Flow 的 edge types 对应 |
| **P2-6** | **错误策略细化不足** | 改造方案 | `errorStrategy: stop \| skip \| continue` 对每个节点可配置，但引擎只读取 `node_config.errorStrategy`，未区分节点级和 workflow 级策略优先级 |

---

## 三、逐项详细分析

### 3.1 新增节点与现有引擎兼容性

#### 3.1.1 input 节点

**现状分析：**
- 前端类型定义完整（`workflow.ts` 第 48-55 行）
- **后端无实现**

**兼容性风险：**
- `source: 'upstream'` 选项语义不清：input 节点作为起点节点，不应有上游
- `includeFiles: true` 时，文件内容读取逻辑未定义（文本文件读内容？二进制文件给路径？）
- `template` 组装逻辑与 VariableResolver 的关系不明确

**建议实现：**
```python
# backend/app/services/workflow_engine/nodes/input_node.py

@NodeRegistry.register("input", label="输入", category="trigger")
class InputNodeExecutor(BaseNodeExecutor):
    CONFIG_SCHEMA = { ... }  # 与前端一致
    
    async def execute(self, context: NodeContext) -> NodeResult:
        source = context.node_config.get("source", "project")
        fields = context.node_config.get("fields", [])
        include_files = context.node_config.get("includeFiles", True)
        template = context.node_config.get("template")
        output_alias = context.node_config.get("outputAlias", "input")
        
        # 根据 source 提取数据
        data = await self._extract_data(source, fields, include_files, context)
        
        # 有模板时组装
        if template:
            rendered = resolve_template(template, {}, data, ...)
            output = {"content": rendered, "raw": data}
        else:
            output = data
        
        # 注册到 resolver（支持 outputAlias）
        if resolver := context.input_data.get("_resolver"):
            resolver.set_node_output(output_alias, output)
        
        return NodeResult(status=NodeStatus.SUCCESS, output_data=output)
```

#### 3.1.2 fork/join 节点

**现状分析：**
- 前端类型定义完整（`workflow.ts` 第 189-222 行）
- 引擎有 `_handle_join_upstream` 方法处理 join 调度
- **但没有 ForkNodeExecutor 和 JoinNodeExecutor**

**问题 1：fork branchData 注入位置错误**

```python
# engine.py 第 472-481 行（有 bug）
# 12a. Handle fork downstream: inject branch info per target
if node_type == "fork":
    fork_mode = node_config.get("mode", "broadcast")
    branch_data_list = node_config.get("branchData", [])
    for e in outgoing:  # ❌ outgoing 未定义
        handle = e.get("sourceHandle", "")
        ...
```

**修复建议：**
```python
# 在 _execute_node 方法开头计算 outgoing
outgoing = [
    e for e in edges 
    if (e.get("source") or e.get("from", "")) == node_id
]

# fork 分支数据注入
if node_type == "fork":
    fork_mode = node_config.get("mode", "broadcast")
    branch_data_list = node_config.get("branchData", [])
    
    for e in outgoing:
        handle = e.get("sourceHandle", "")
        target_id = e.get("target") or e.get("to", "")
        if handle.startswith("branch_"):
            if fork_mode == "distribute" and branch_data_list:
                idx = int(handle.split("_")[1])
                if idx < len(branch_data_list):
                    branch_data = branch_data_list[idx].get("data", "")
                    new_upstream["_fork_branch_data"] = branch_data
```

**问题 2：join 节点需要独立的 execute() 方法**

当前 join 节点的逻辑完全在引擎层处理，但改造方案定义了 `mergeStrategy: append | merge | custom`。这些策略应该在节点的 `execute()` 中实现：

```python
# backend/app/services/workflow_engine/nodes/join_node.py

@NodeRegistry.register("join", label="Join", category="logic")
class JoinNodeExecutor(BaseNodeExecutor):
    async def execute(self, context: NodeContext) -> NodeResult:
        branch_outputs = context.input_data.get("_branch_outputs", {})
        merge_strategy = context.node_config.get("mergeStrategy", "append")
        extract_fields = context.node_config.get("extractFields", [])
        
        if merge_strategy == "append":
            merged = [v for v in branch_outputs.values()]
        elif merge_strategy == "merge":
            merged = {}
            for branch_data in branch_outputs.values():
                merged.update(branch_data)
        elif merge_strategy == "custom":
            merged = {k: v for k, v in branch_outputs.items() if k in extract_fields}
        else:
            merged = list(branch_outputs.values())
        
        return NodeResult(
            status=NodeStatus.SUCCESS,
            output_data={
                "branch_outputs": branch_outputs,
                "merged": merged,
                "branch_count": len(branch_outputs),
            }
        )
```

#### 3.1.3 context_output / result_output 节点

**现状分析：**
- 前端类型定义完整
- **后端无实现**

**建议实现：**

```python
# context_output_node.py
async def execute(self, context: NodeContext) -> NodeResult:
    extract_fields = context.node_config.get("extractFields", ["content", "files_changed"])
    instructions = context.node_config.get("instructions", "")
    output_alias = context.node_config.get("outputAlias", "context")
    
    # 从上游提取字段
    extracted = {}
    for field in extract_fields:
        for node_id, output in context.upstream_outputs.items():
            if field in output:
                extracted[field] = output[field]
                break
    
    # 添加指令
    if instructions:
        extracted["instructions"] = instructions
    
    return NodeResult(status=NodeStatus.SUCCESS, output_data=extracted)

# result_output_node.py
async def execute(self, context: NodeContext) -> NodeResult:
    target = context.node_config.get("target", "task_result")
    format_type = context.node_config.get("format", "markdown")
    notify = context.node_config.get("notify", False)
    
    # 收集上游输出
    all_outputs = context.upstream_outputs
    
    # 根据 target 处理
    if target == "task_result":
        # 写入任务结果
        ...
    elif target == "task_documents":
        # 写入任务文档
        ...
    elif target == "file":
        # 写入文件
        file_path = context.node_config.get("filePath")
        ...
    
    # 发送通知
    if notify:
        await self._send_notification(...)
    
    return NodeResult(status=NodeStatus.SUCCESS, output_data={...})
```

---

### 3.2 agent 节点改造方案

**配置对比：**

| 字段 | 改造方案 | 现有实现 | 差异 |
|------|---------|---------|------|
| agentId | ✅ | ✅ | 一致 |
| agentType | ✅ | ✅ | 一致 |
| agentSelectMode | ✅ | ❌ | **缺失** |
| prompt | ✅ | ✅ | 一致 |
| model | ✅ | ✅ | 一致 |
| temperature | ✅ | ✅ | 一致 |
| maxTokens | ✅ | ✅ | 一致 |
| timeout | ✅ | ✅ | 一致 |
| workDir | ✅ | ❌ | **缺失** |
| envVars | ✅ | ❌ | **缺失** |
| outputFormat | ✅ | ❌ | **缺失** |
| outputAlias | ✅ | ❌ | **缺失** |
| gitEnabled | ✅ | ❌ | **缺失** |

**建议：**
1. 更新 `AgentNodeExecutor.CONFIG_SCHEMA` 与改造方案同步
2. 实现 `outputFormat` 处理逻辑
3. 实现 `outputAlias` 注册到 VariableResolver
4. Git 集成作为独立模块实现（可在 Phase 2）

---

### 3.3 变量解析器问题

**现状：**
- 支持 `loop.*`、`node_id.*`、`workflow.*`、`env.*`、`context.*`
- **不支持** `project.*`、`task.*` 快捷访问

**改造方案要求：**
```
{{ project.name }}       # 需要支持
{{ task.title }}        # 需要支持
{{ node_id.output.field }}  # 已支持
{{ input.field }}       # 需要支持（outputAlias）
```

**建议扩展：**

```python
# variable_resolver.py

def resolve_variable(...):
    # 新增：project/task 快捷访问
    if root == "project":
        project_ctx = execution_context.get("_project", {})
        return _navigate_path(project_ctx, path)
    
    if root == "task":
        task_ctx = execution_context.get("_task", {})
        return _navigate_path(task_ctx, path)
    
    # 新增：outputAlias 支持
    # 当 node_id 是一个 outputAlias 时，需要查找映射
    if root not in ("workflow", "env", "context", "loop", "project", "task"):
        # 检查是否是 outputAlias
        alias_map = execution_context.get("_output_alias_map", {})
        actual_node_id = alias_map.get(root, root)
        if actual_node_id in node_outputs:
            return _navigate_path(node_outputs[actual_node_id], path)
```

---

### 3.4 数据模型变更完整性

**改造方案定义的变更：**

```sql
-- projects 表新增
git_enabled BOOLEAN DEFAULT FALSE
git_platform VARCHAR(20)
git_repo_url VARCHAR(500)
git_default_branch VARCHAR(100)
git_auth_type VARCHAR(20)
git_auth_value TEXT
git_branch_strategy VARCHAR(20)
git_branch_template VARCHAR(200)
git_post_push VARCHAR(20)
```

**问题：**
1. 改造方案未明确哪些字段需要加密存储（`git_auth_value`）
2. 未定义数据库迁移脚本
3. OpenClaw 集成权限字段 `openclaw_permission` 也需同步

**建议：**
1. 在改造方案中补充「数据库迁移」章节
2. 明确 `git_auth_value` 使用 AES 加密或系统密钥链
3. 前端 UI 配置面板与字段一一对应

---

### 3.5 边界情况遗漏

| 场景 | 改造方案 | 现有实现 | 问题 |
|------|---------|---------|------|
| join 所有上游都失败 | 未说明 | 超时后 `continue_with_ready` | 如果没有任何上游成功，join 输出为空 |
| fork branchCount 与实际连线不一致 | 未说明 | 无校验 | UI 可能配置 3 分支但只连 2 条边 |
| loop 嵌套时上下文清理 | 未说明 | `_loop_context` 单一 | 内层 loop 可能污染外层 |
| sub_workflow 循环调用 | `maxDepth: 5` | 未验证 | 引擎无循环检测 |
| agent timeout 同时 gitEnabled=true | 未说明 | 无 Git 逻辑 | Git 操作在 timeout 前未完成如何处理 |

---

## 四、修复优先级建议

### 第一批（进入开发前必须完成）

1. **P0-1**：修复 engine.py 变量未定义 bug
2. **P0-2 ~ P0-6**：实现 5 个新增节点的后端 Executor
3. **P0-7**：同步 agent 节点 CONFIG_SCHEMA
4. **P0-8**：实现 outputAlias 机制

### 第二批（开发过程中完成）

1. **P1-1 ~ P1-7**：数据模型变更、Git 集成、变量解析器扩展

### 第三批（可选优化）

1. **P2-1 ~ P2-6**：前端配置面板、连线样式、错误策略细化

---

## 五、结论

改造方案**设计完整度 80%**，主要问题集中在**后端实现缺失**和**配置不一致**。

**建议：**
1. 先修复 P0 问题再启动开发
2. 后端实现与改造方案同步更新
3. 数据模型变更提前准备迁移脚本
4. 新增节点按批次实现，优先 input → agent → fork/join → output 类
