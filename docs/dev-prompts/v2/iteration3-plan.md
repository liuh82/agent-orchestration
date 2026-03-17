# Nexus 工作流改造 — 迭代三实施计划

> 基于 CC 技术评审结论，2026-03-17
> 状态：待实施

## 评审结论摘要
- 方案可行，中等改造量
- 仅 fork/join 需动引擎底层（engine.py + base.py），其余6项上层实现
- VariableResolver 无需改动
- 无需数据库迁移
- 发现 engine.py:30 bug（`_completed_nodes` 初始化为 set() 应为 {}）

## 实施顺序

| 阶段 | 任务 | 范围 | 依赖 | 预估复杂度 |
|------|------|------|------|-----------|
| 0 | Bug修复: engine.py:30 | 后端 | 无 | 低 |
| 1 | fork/join 引擎层改造 | 后端 | 阶段0 | 高 |
| 2 | input 节点（后端+前端） | 全栈 | 阶段1 | 中 |
| 3 | context_output + result_output 节点 | 全栈 | 阶段2 | 中 |
| 4 | agent 节点配置改造 | 前端 | 无（可并行） | 中 |
| 5 | sub_workflow 配置改造 | 前端 | 阶段3 | 低 |
| 6 | 连线样式增强 | 前端 | 无（可并行） | 低 |

**可并行的组：**
- 组A：阶段0 → 阶段1 → 阶段2 → 阶段3 → 阶段5（有依赖链）
- 组B：阶段4（agent配置，可与组A并行）
- 组C：阶段6（连线样式，可与组A并行）

## 关键约束
- 不改动 VariableResolver（新语法天然兼容）
- 不做数据库迁移
- 不改动现有节点的执行逻辑（if/switch/loop/parallel 保持不变）
- parallel 节点保留兼容，fork/join 是新增而非替代
