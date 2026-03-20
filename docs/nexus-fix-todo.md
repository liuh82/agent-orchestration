# Nexus 待修复问题清单（2026-03-20）

> 由助手诊断，用户用本地 CC 修复。

---

## Fix #10: engine.py — asyncio.gather 改串行

**文件**: `backend/app/services/workflow_engine/engine.py`
**问题**: `_schedule_nodes` 中 `asyncio.gather` 并发执行节点，多个协程共享同一个 SQLAlchemy db session，导致 `ResourceClosedError: This transaction is closed`。
**修复方案**: 将 `asyncio.gather(*tasks, return_exceptions=True)` 改为 `for ... await` 串行执行。

```python
# 找到约第 165-178 行，将：
tasks = []
for node_def in node_defs:
    tasks.append(
        self._execute_node(
            execution_id, node_def, all_nodes, edges,
            input_data, db, upstream_outputs, workflow_config,
        )
    )
results = await asyncio.gather(*tasks, return_exceptions=True)
for i, r in enumerate(results):
    if isinstance(r, Exception):
        print(f"[DEBUG] gather task {i} exception: {type(r).__name__}: {r}", flush=True)
    elif isinstance(r, BaseException):
        print(f"[DEBUG] gather task {i} base exception: {r}", flush=True)

# 改为：
for node_def in node_defs:
    node_def["_all_nodes"] = all_nodes
    try:
        await self._execute_node(
            execution_id, node_def, all_nodes, edges,
            input_data, db, upstream_outputs, workflow_config,
        )
    except Exception as e:
        print(f"[DEBUG] node {node_def['id']} exception: {type(e).__name__}: {e}", flush=True)
```

---

## Fix #11: plan_node.py — `_parse_json` 参数错误

**文件**: `backend/app/services/workflow_engine/nodes/plan_node.py`
**问题**: 运行时报 `PlanNode._parse_json() takes from 1 to 2 positional arguments but 3 were given`。
`_parse_json` 标记为 `@staticmethod`（签名 `text, default=None`），但以 `self._parse_json(result, [])` 调用。
**修复方案**: 给 `_parse_json` 加上 `self` 参数（去掉 `@staticmethod`），与 `spec_node.py`、`verify_node.py` 保持一致。

```python
# 找到约第 327 行，将：
@staticmethod
def _parse_json(text: str, default: Any = None) -> Any:

# 改为：
def _parse_json(self, text: str, default: Any = None) -> Any:
```

同时检查 `review_node.py`、`verify_node.py`、`spec_node.py` 是否有同样问题，统一修复。

---

## Fix #12: spec_1 节点执行记录未写入 DB

**文件**: `backend/app/services/workflow_engine/engine.py`
**问题**: spec_1 执行成功（日志显示 `_get_next_nodes_v1(spec_1)` 被调用），但 `workflow_node_executions` 表中没有 spec_1 的记录。可能原因：
1. `_execute_node` 中创建记录后 `db.flush()` 成功，但 `_schedule_nodes` 循环中每次迭代结束没有 `db.commit()`，最后统一 commit 时前面迭代的记录丢失
2. 或 `_execute_node` 中 spec 节点的异常处理路径跳过了记录写入

**修复方案**: 在 `_schedule_nodes` 的每次节点执行循环后加 `db.flush()`（不动 commit 位置），确保每轮写入。

```python
# 在串行执行循环的末尾，`except` 块之后加：
    db.flush()  # 确保当前轮节点执行记录写入
```

如果还是不行，需要在 `_execute_node` 内部排查：确认 `_create_execution_record` 和 `_update_execution_record` 都调用了 `db.flush()`。

---

## Fix #13: 任务中心 Select 下拉框交互异常

**文件**: `frontend/src/pages/tasks/TaskCenterPage.tsx` 或相关组件
**问题**: 用户反馈任务中心"筛选状态"下拉框点选操作有问题。
**当前代码**: AntD `<Select allowClear placeholder="筛选状态" />` 放在 `PageHeader` 的 `actions` slot 中。
**可能原因**（需用户确认具体症状）：
1. **下拉菜单被遮挡**: `MainLayout` 中 `StyledHeader` 的 `z-index: 100` 可能高于 Select dropdown 的 z-index
2. **overflow hidden**: `Content` 或 `ContentInner` 有 `overflow-y: auto`，可能导致 dropdown 被裁剪
3. **styled-components 样式冲突**: 全局 `* { box-sizing: border-box }` 影响 antd 下拉定位

**排查步骤**:
1. 打开浏览器 DevTools，点击 Select，检查 dropdown 的 z-index 是否被 header 遮挡
2. 检查 dropdown 是否被 `overflow: hidden` 的父元素裁剪
3. 如果被遮挡，给 `<Select>` 加 `getPopupContainer={(triggerNode) => triggerNode.parentElement}` 让 dropdown 渲染在父元素内

```tsx
// 在 TaskCenterPage.tsx 中，给 Select 加 getPopupContainer：
<Select
  allowClear
  placeholder="筛选状态"
  style={{ width: 140 }}
  options={statusOptions}
  value={statusFilter}
  onChange={(val) => setStatusFilter(val)}
  getPopupContainer={(trigger) => trigger.parentElement as HTMLElement}
/>
```

---

## 待验证：Workflow DB 模型持久化流程

**问题**: 之前多次通过 SQL 直接更新 `workflows.definition` 字段中的节点 model 配置，但后端重启后配置回退。
**根因**: 后端进程持有 SQLite 锁，SQL UPDATE 静默失败（`database is locked`）。
**建议**: 在后端增加一个 API 端点（如 `PATCH /api/v1/workflows/:id/nodes-config`）来更新节点配置，避免直接操作 SQLite。

---

## 操作顺序

修复后端代码后，部署步骤：
1. `kill -9` 所有 uvicorn 进程
2. 清理 DB：`DELETE FROM workflow_node_executions; DELETE FROM workflow_executions; DELETE FROM tasks WHERE project_id='b8261dca-f7e9-458a-9bf2-9e8f1f4a82c3'`
3. 停后端，更新 workflow model 配置（`MiniMax-M2.7-highspeed`）
4. 启动后端：`NEXUS_LLM_PROVIDERS=... NEXUS_LLM_TIMEOUT=60 python3 -m uvicorn main:app --host 0.0.0.0 --port 8082`
5. 前端 rebuild（如果修了前端）：`cd frontend && npm run build`
6. 创建任务并执行，验证 spec_1 → plan_1 通过
