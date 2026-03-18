# 迭代三 T2.1：工作流端到端集成验证

## 背景
P0 已修复，后端 5 个新节点（input/context_output/result_output/fork/join）和前端组件都已存在。T2.1 的目标是**用真实工作流验证整个系统是否能端到端跑通**，发现并修复集成问题。

## 现有代码状态
- ✅ 后端节点文件全部存在且有 execute()
- ✅ 前端节点组件全部存在
- ✅ 前端类型定义完整
- ✅ 引擎层 fork/join 调度逻辑已实现
- ✅ P0 修复（outgoing bug、agent schema、outputAlias）

## 任务

### 第一步：代码审查
仔细阅读以下文件，理解 fork/join 的完整执行路径：

**后端执行路径（必读）：**
- `backend/app/services/workflow_engine/engine.py` — 重点看 `_execute_node`、`_handle_join_upstream`、`_get_next_nodes_v1`
- `backend/app/services/workflow_engine/nodes/fork.py` — ForkNode execute()
- `backend/app/services/workflow_engine/nodes/join.py` — JoinNode execute()
- `backend/app/services/workflow_engine/nodes/input.py` — InputNode execute()
- `backend/app/services/workflow_engine/nodes/agent.py` — AgentNode execute()
- `backend/app/services/workflow_engine/variable_resolver.py` — 变量解析（含 outputAlias）

**前端（必读）：**
- `frontend/src/components/workflow/nodes/ForkNode.tsx` — fork 节点 UI
- `frontend/src/components/workflow/nodes/JoinNode.tsx` — join 节点 UI
- `frontend/src/components/workflow/nodes/InputNode.tsx` — input 节点 UI
- `frontend/src/stores/useWorkflowStore.ts` — 工作流编辑器状态管理

### 第二步：设计一个测试工作流

设计一个简单但完整的测试工作流，在 Nexus 前端手动创建：

```
[Input: "开发一个 TODO 应用"] 
  → [Agent: "架构设计"] (Claude Code)
  → [Fork (broadcast)]
    → [Agent: "后端开发"] (Claude Code)
    → [Agent: "前端开发"] (Claude Code)
  → [Join (all)]
  → [Result Output: 输出结果]
```

**注意**：这个测试工作流用于验证系统逻辑，实际执行时 Agent 可以用 mock 或简单 prompt（如 "输出 hello"）避免耗时。

### 第三步：代码审查 + Bug 修复

基于代码审查，找出并修复以下潜在问题：

1. **fork 节点连线问题**：
   - fork 节点到多个下游的边是否正确（sourceHandle 应为 branch_0, branch_1 等）
   - join 节点接收多个上游边的逻辑是否正确
   - `_pending_join_inputs` 全局变量在并发执行时是否安全

2. **outputAlias 传递链路**：
   - input 节点的 outputAlias 是否能被下游 agent 节点的 `{{ input.xxx }}` 引用
   - agent 节点的 outputAlias 是否能被 join/result_output 引用
   - fork broadcast 模式下上游输出是否正确传递到所有分支

3. **变量解析**：
   - `{{ node_id.field }}` 在 fork 后的分支中是否正确解析
   - join 节点的 `_branch_outputs` 是否正确存储到 output_data

4. **前端渲染**：
   - fork 节点是否显示多个输出端口
   - join 节点是否显示多个输入端口
   - 连线是否正确渲染（React Flow 的 handle 连接）

5. **任何发现的 bug**：直接修复，不分 P0/P1。

### 第四步：修复验证

修复后：
1. 重启后端（需要你手动重启）
2. 在 Nexus 前端创建上述测试工作流
3. 提交执行，观察是否能正确走完 fork→parallel→join→output 全链路
4. 如果有问题，根据日志排查并修复

## 关键注意事项

- `node_config` 和 `node.data` 的区别：前端可能存到 `data` 里，后端从 `node_config` 读取。检查两边命名是否一致。
- fork 的 `sourceHandle` 命名约定：前端用 `branch_0`、`branch_1`，后端按此解析。
- join 的 `_pending_join_inputs` 用 `execution_id` + `join_node_id` 作为 key，注意初始化时机。
- 边（edge）格式：前端可能用 `source/target`，旧代码用 `from/to`，需要兼容。

## 交付物
1. 修复后的代码（commit + push）
2. 简短说明修复了哪些问题

## 禁止事项
- 不要新增节点类型
- 不要修改数据库 schema
- 不要实现 Git 集成（P1）
- 不要修改前端样式/颜色
