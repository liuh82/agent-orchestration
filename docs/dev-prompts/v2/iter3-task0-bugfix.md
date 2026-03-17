# Nexus 工作流改造 — 阶段0: Bug修复

> 请在 agent-orchestration 项目根目录执行。

## 必读文件
- CLAUDE.md — 项目规范
- `backend/app/services/workflow_engine/engine.py` — 找到第30行的 bug

## 问题描述
`engine.py` 第30行：
```python
_completed_nodes: Dict[str, Set[str]] = set()
```

类型声明为 `Dict[str, Set[str]]`，但初始化为 `set()`（应该是 `{}`）。这会导致后续代码中 `_completed_nodes.get(execution_id, set())` 和 `_completed_nodes[execution_id] = set()` 的行为不一致。

## 修复内容
1. 将 `set()` 改为 `{}`（空字典）
2. 检查 `_completed_nodes` 在 engine.py 中的所有使用点，确保类型一致
3. 同样检查 `_running_executions`、`_variable_resolvers`、`_execution_definitions` 的初始化是否正确

## 完成标准
- [ ] engine.py 第30行修复
- [ ] 其他3个模块级变量的初始化也检查过
- [ ] `cd backend && python3 -c "from app.services.workflow_engine.engine import workflow_engine; print('OK')"` 无报错
- [ ] 不要 git commit（等阶段1完成后一起提交）

## 不要做的事
- 不要修改其他文件
- 不要改动节点的执行逻辑
- 不要 git commit
