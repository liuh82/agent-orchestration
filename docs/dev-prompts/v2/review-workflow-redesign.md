# Nexus 工作流改造方案 — CC 技术评审 Prompt

> 请在 agent-orchestration 项目根目录执行，先读完所有必读文件再输出评审意见。

## 必读文件

请按顺序阅读以下文件（每个文件都要读完整内容）：

### 1. 改造方案
- `docs/dev-prompts/v2/workflow-node-redesign.md` — 本次要评审的核心方案

### 2. 现有底层架构（重点）
- `backend/app/services/workflow_engine/engine.py` — 工作流执行引擎
- `backend/app/services/workflow_engine/nodes/base.py` — 节点基类（NodeContext, NodeResult, BaseNodeExecutor）
- `backend/app/services/workflow_engine/registry.py` — 节点注册机制
- `backend/app/services/workflow_engine/variable_resolver.py` — 变量解析器

### 3. 现有节点实现（各挑一个看）
- `backend/app/services/workflow_engine/nodes/agent.py` — Agent 节点（需改造）
- `backend/app/services/workflow_engine/nodes/if_node.py` — IF 条件节点
- `backend/app/services/workflow_engine/nodes/parallel.py` — 并行节点（方案中要被 fork/join 替代）
- `backend/app/services/workflow_engine/nodes/output_node.py` — 输出节点（方案中要拆分）

### 4. 数据模型
- `backend/app/models/workflow.py` — 工作流模型
- `backend/app/models/workflow_execution.py` — 执行记录模型
- `backend/app/models/task.py` — 任务模型
- `backend/app/models/task_agent_config.py` — 任务级Agent配置

### 5. 前端
- `frontend/src/types/workflow.ts` — 前端工作流类型定义
- `frontend/src/stores/useWorkflowStore.ts` — 工作流编辑器状态管理
- `frontend/src/components/workflow/nodes/base.tsx` — 基础节点组件
- `frontend/src/pages/workflows/WorkflowEditorPage.tsx` — 编辑器页面

### 6. 其他参考
- `docs/dev-prompts/v2/workflow-schema-v1.md` — Schema v1 规范
- `backend/app/services/workflow_engine/state_machine.py` — 执行状态机

---

## 评审要求

读完以上所有文件后，请输出一份**技术可行性评审报告**，包含以下内容：

### 一、总体评估
- 方案与现有架构的兼容程度（完全兼容 / 需要小改 / 需要大改）
- 是否需要动底层架构？如果需要，具体动哪些？

### 二、逐项分析（P0 的 8 项）

对以下每项，分析：
1. **是否需要改底层架构**（engine.py / base.py / registry.py / variable_resolver.py / state_machine.py）
2. **如果需要改，改什么？改动量多大？**
3. **有没有技术风险或潜在坑？**

P0 清单：
1. input 节点（后端+前端）
2. agent 节点配置改造（前端面板）
3. context_output 节点（后端+前端）
4. result_output 节点（后端+前端）
5. fork 节点（后端+前端）
6. join 节点（后端+前端）
7. sub_workflow 配置改造（前端面板）
8. 连线样式增强（前端）

### 三、关键问题

1. **引擎层改动**：`engine.py` 的 `_schedule_nodes` 和 `_execute_node` 方法是否需要重构才能支持 fork/join 的并行分叉+汇合？当前的 `_completed_nodes` 追踪机制能否处理 fork/join 场景？

2. **变量传递**：`VariableResolver` 当前的 `{{ node_id.output.field }}` 语法，方案中的 `{{ input.xxx }}`、`{{ join.branch_0.xxx }}` 是否兼容？fork/join 的分支数据在 resolver 中如何隔离？

3. **NodeContext 数据流**：当前 `upstream_outputs` 是扁平的 `Dict[str, Any]`，fork 的 broadcast/distribute 模式和 join 的合并策略是否需要改数据结构？

4. **数据模型影响**：方案中有没有需要新增/修改数据库表的地方？对现有的 `workflows`、`tasks`、`workflow_executions` 表有没有影响？

5. **parallel 节点迁移**：现有 `parallel.py` 节点是否可以直接被 fork/join 替代？有没有正在使用 parallel 节点的工作流需要兼容？

6. **output 节点拆分**：现有 `output_node.py` 拆成 `context_output` 和 `result_output`，有没有风险？

### 四、建议

1. **实施顺序调整建议**：当前的 P0 排序是否合理？有没有应该提前或推迟的？
2. **风险缓解建议**：有没有什么可以提前做的防护措施？
3. **是否需要先做其他准备工作**（比如引擎层重构、测试框架完善等）？

---

## 输出格式

请用 Markdown 输出，结构清晰，直接给结论，不要绕弯。重点关注"是否需要动底层架构"这个问题。
