# Nexus Fix Todo v8 — spec_1 约束为空 + request 阻塞

> 创建时间：2026-03-21 11:17 UTC+8

---

## 已修复（engine.py）✅

### Fix J：`asyncio.create_task` → `await _schedule_nodes`

**文件**：`backend/app/services/workflow_engine/engine.py` line 142

**根因**：`start()` 方法用 `asyncio.create_task(_schedule_nodes(...))` 把工作流调度为后台任务，但传入的 `db` session 来自 FastAPI `Depends(get_db)`，request 返回后 session 被 close。短耗时节点（trigger <1ms, input <5ms）在 session 关闭前完成，长耗时节点（spec ~15s 调 LLM）回来时 session 已失效，`db.commit()` 静默丢失数据。

**现象**：`workflow_node_executions` 表中 trigger_1/input_1 有记录，spec_1 始终缺失，plan_1 直接收到空约束。

**修复**：改为 `await self._schedule_nodes(...)`，workflow 在 request 生命周期内同步完成。

**副作用**：HTTP request 会阻塞整个 workflow 执行周期（15s-120s+），前端体验差。需要后续改为后台执行 + 独立 db session（见下方 Issue A）。

---

## 待修复 Issues

### Issue A：workflow 后台执行 + 独立 db session（高优先）

**现状**：`await` 改后 workflow 同步执行，HTTP 请求阻塞直到完成。

**修复方向**：
1. `engine.start()` 恢复 `asyncio.create_task` 后台执行
2. 在 `_schedule_nodes` 入口创建独立的 db session（不依赖 request 的 session）
3. 用 `SessionLocal()` 创建新 session，执行完毕后 `session.close()`
4. 需要处理：session 与 request session 的数据一致性（避免读到陈旧数据）

**涉及文件**：`backend/app/services/workflow_engine/engine.py`

**参考**：
```python
# engine.py start() 或 _schedule_nodes()
from app.database import SessionLocal

def _create_session():
    """创建独立的 db session，不依赖 request lifecycle。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

### Issue B：spec_1 requirement 模板变量解析失败（高优先）

**现象**：spec_1 输出的 `enhanced_requirement` 全是"【需求缺失】"，constraints 为空列表。

**根因**：spec_1 的 `requirement` 模板用了 `{{input.task_description}}`，但 input_1 输出的字段是 `title`、`description`、`documents`，没有 `task_description`。

**模板中的变量**：
```
## 当前任务需求
{{input.task_description}}    ← 不存在于 input_1 输出中

## 项目背景
{{input.title}}               ← ✅ 存在
{{input.description}}         ← ✅ 存在

## 相关文档
{{input.documents}}           ← ✅ 存在
```

**input_1 实际输出**（outputAlias = "input"）：
```json
{
  "input": {
    "title": "Claude Code Desktop",
    "description": "Claude Code 桌面客户端 - Tauri v2 + React 18 + TypeScript 多面板编程环境",
    "documents": [...]
  }
}
```

**修复方向**（二选一）：
- **方案 A**：改 spec_1 模板，`{{input.task_description}}` → `{{input.description}}`
- **方案 B**：input_1 输出时增加 `task_description` 字段，从 `input_params.description` 取值

推荐方案 A，因为 workflow definition 是 DB 配置，修改模板更直接。

**涉及**：DB 中 `workflows` 表 `definition` 字段的 `spec_1.requirement` 配置。

---

### Issue C：plan_1 前置校验失败后的错误信息（低优先）

**现象**：plan_1 直接报错 "spec 节点输出的约束列表为空"，没有提供有意义的上下文。

**修复方向**：plan_node.py 在 `constraints` 为空时，输出 warning 并跳过约束注入（而非直接 fail），或者返回更详细的错误信息说明是上游 spec_1 输出异常。

**涉及文件**：`backend/app/services/workflow_engine/nodes/plan_node.py`
