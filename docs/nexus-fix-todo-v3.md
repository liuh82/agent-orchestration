# Nexus 待修复/需求清单 v3（2026-03-20 23:45）

> 助手诊断，用户本地 CC 修复。只给约束，不给代码。

---

## Fix A（P0）：MiniMax thinking tokens 导致 JSON 解析失败

**问题**：MiniMax-M2.7-highspeed 在 JSON 回答前输出 `<thinkin>` 标签包裹的推理过程。`_parse_json` 直接 `json.loads()` 失败，所有 LLM 节点的 JSON 输出都无法解析。

**修复方向**：在 `llm_provider.chat_completion()` 返回内容前，用正则去除 `<thinkin>...</thinkin>` 标签及其内容（非贪婪匹配）。这样所有下游节点自动受益。

---

## Fix B（P1）：verify_node.py / review_node.py `_parse_json` 还是 `@staticmethod`

**问题**：与 plan_node/spec_node 之前的问题一样，去掉 `@staticmethod`，加 `self` 参数。

---

## Fix C（P0）：前端任务详情"实时输出"收不到 workflow 执行事件

**问题**：前端 `useTaskStream` hook 连接的是 Gateway SSE 端点（`/api/gateway/tasks/{taskId}/stream`），该端点从 `event_store`（Gateway 内存事件队列）读事件。但工作流引擎的 `WorkflowEventPublisher` 把事件发到 `ws_manager`（WebSocket broadcast），**两个事件系统互不相通**。只有 agent bridge（task_router）会往 `event_store` 推事件，workflow 节点执行不会。

**根因**：`WorkflowEventPublisher.publish()` → `ws_manager.broadcast()`，但前端读的是 `event_store`。两套 pub/sub 机制没有桥接。

**修复方向**（二选一）：

**C1（推荐）：WorkflowEventPublisher 同时写 event_store**
- 文件：`backend/app/services/workflow_engine/event_publisher.py`
- 在 `publish()` 方法里，除了 `ws_manager.broadcast()` 之外，同步把事件推入 `event_store`
- 需要知道 task_id 来推 event_store，而当前 publisher 只有 execution_id
- 方案：在 workflow 启动时建立 execution_id → task_id 的映射（`_execution_task_map`），publish 时查找映射

**C2（备选）：前端改用 WebSocket 替代 SSE**
- 改 `useTaskStream` hook 连接 WebSocket 而不是 SSE
- 订阅 `workflow:{execution_id}` topic
- 需要先从 task 详情获取 execution_id

---

## 需求 D（P1）：任务详情页实时输出增加工作流可视化

**场景**：用户在任务详情页的"实时输出"tab，希望能看到该任务关联的工作流 DAG，当前执行到哪个节点就高亮哪个节点，节点下方展示详细执行信息。

**约束**：

1. **数据获取**
   - 从 task 的 workflow_id 字段获取工作流定义（`GET /api/v1/workflows/{workflowId}`）
   - 从 task 的最新 execution 获取节点执行状态（需要一个 API 返回某次执行的所有节点状态，或用已有 API 拼接）
   - 节点状态通过 SSE/WebSocket 实时更新（依赖 Fix C）

2. **布局**：实时输出 tab 分上下两部分
   - **上半部**：工作流 DAG 缩略图（紧凑布局，不需要可编辑），节点用图标+名称表示
   - **下半部**：当前选中节点（默认选中正在执行的节点）的详细执行信息

3. **节点状态视觉**
   - 未执行：灰色/虚线
   - 执行中：蓝色/脉冲动画
   - 成功：绿色
   - 失败：红色
   - 人工干预：橙色

4. **交互**
   - 点击节点可查看该节点的详细输出
   - 自动滚动跟踪：新节点开始执行时自动选中
   - DAG 布局参考 `WorkflowMonitorPage` 的现有实现

5. **参考**：现有的 `WorkflowMonitorPage` 已有 DAG 可视化，可复用其渲染逻辑

---

## 优先级

| 优先级 | 项目 | 理由 |
|--------|------|------|
| P0 | Fix A | 不修 workflow 全链路不通 |
| P0 | Fix C | 不修前端看不到任何执行日志 |
| P1 | Fix B | verify/review 到时会崩 |
| P1 | 需求 D | 依赖 Fix C 完成后才有意义 |
