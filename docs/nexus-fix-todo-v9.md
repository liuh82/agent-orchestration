# Nexus Fix Todo v9 — 任务详情页功能完善

> 创建时间：2026-03-21 14:17 UTC+8

---

## 概述

用户反馈任务详情页存在以下问题（附截图）：
1. 工作流 DAG 可视化未渲染 / 空白
2. 实时输出流没有内容
3. Job 列表是占位，没有实际功能
4. 日志区域没有内容
5. 返回按钮回到项目页而非上一级

---

## Issue A：工作流 DAG 可视化空白（高优先）

**现状**：
- `TaskWorkflowDAG` 组件存在（`src/components/tasks/TaskWorkflowDAG.tsx`）
- 通过 `workflowId` + `workflowEvents` props 渲染
- `workflowEvents` 从 SSE `useTaskStream` hook 中过滤 `workflow_event` 类型事件

**问题分析**：
1. SSE bridge 是否接通？后端 `WorkflowEventPublisher` 发布事件到 event_store，但 SSE `/api/gateway/tasks/{task_id}/stream` 端点是否正确转发 workflow_event？
2. DAG 组件是否正确解析后端事件格式？后端发布格式 vs 前端期望格式是否一致？
3. 如果 SSE 未连接（后端没跑 workflow），DAG 组件是否有 fallback 静态渲染（从 workflow snapshot 画 DAG）？

**修复方向**：
1. 检查 SSE stream 端点是否返回 workflow_event 类型的事件
2. 如果 SSE 不可用，DAG 组件应 fallback 到从 `task.workflow_snapshot` 静态渲染节点拓扑图（节点状态可以通过轮询 `/tasks/{id}/executions` API 获取）
3. DAG 视觉效果优化 — 当前用户反馈"难看"，考虑用 antd Flow 或 react-flow 渲染，带状态颜色（成功/失败/运行中/等待中）

**涉及文件**：
- `frontend/src/components/tasks/TaskWorkflowDAG.tsx`
- `frontend/src/hooks/useTaskStream.ts`
- `backend/app/routers/gateway.py`（SSE stream 端点）
- `backend/app/services/workflow_engine/event_publisher.py`

---

## Issue B：实时输出流无内容（高优先）

**现状**：
- `useTaskStream` hook 通过 SSE 连接 `/api/gateway/tasks/{task_id}/stream`
- 前端支持的事件类型：`tool_use`、`tool_result`、`thinking`、`error`、`text`、`workflow_event`
- 后端 workflow engine 通过 `WorkflowEventPublisher` 发布事件

**问题分析**：
1. SSE 连接是否成功？截图显示"未连接"状态
2. 后端 SSE 端点 `/api/gateway/tasks/{task_id}/stream` 是否正确读取并转发 workflow engine 的事件？
3. workflow engine 的 `_run_with_independent_session` 在独立线程执行，事件发布到 event_store，SSE 端点是否能跨 session 读取？

**修复方向**：
1. 确保 SSE endpoint 正确认证（当前返回 401 Unauthorized，见后端日志）
2. `WorkflowEventPublisher` 使用 `asyncio.create_task` 发布事件到 event_store，需要确认 event_store 是跨 session/跨进程的全局状态
3. 考虑添加 REST 轮询 fallback：如果 SSE 不可用，定期轮询 `/tasks/{id}/executions` 获取节点状态

**涉及文件**：
- `frontend/src/hooks/useTaskStream.ts`
- `backend/app/routers/gateway.py`
- `backend/app/services/workflow_engine/event_publisher.py`

---

## Issue C：Job 列表占位（中优先）

**现状**：
- 代码：`const jobs: Job[] = []; // TODO: replace with useQuery for job API`
- 前端已定义 `Job` type 和 job table columns
- 后端有 `jobs` 表和 CRUD API

**修复方向**：
1. 后端确认 jobs API 是否存在：`GET /api/v1/tasks/{task_id}/jobs`
2. 如果不存在，创建该 API（查询 jobs 表 WHERE task_id = X）
3. 前端用 `useQuery` 替换空数组
4. 如果 jobs 概念在当前工作流体系中不需要（workflow node_executions 已经替代了 job 概念），考虑移除 Job 列表 tab，改名为"执行记录"展示 node_executions

**涉及文件**：
- `frontend/src/pages/tasks/TaskDetailPage.tsx`（line 292）
- `backend/app/routers/tasks.py`（可能需要新增端点）

---

## Issue D：日志区域无内容（中优先）

**现状**：
- 前端调用 `api.get(`/tasks/${id}/logs`)`
- 后端日志显示 `GET /api/v1/tasks/{id}/logs` 返回 404 Not Found

**修复方向**：
1. 方案 A：实现 `/tasks/{id}/logs` API，返回任务相关的日志记录（从 agent_logs 或 task_files 表）
2. 方案 B：如果当前没有独立的任务日志概念，将"日志"tab 改为展示 node_executions 的 error_message 和 output_data 摘要
3. 方案 C：合并到"实时输出"tab，去掉单独的日志 tab

推荐方案 B — 展示 node_executions 的执行记录比空白日志更有价值。

**涉及文件**：
- `frontend/src/pages/tasks/TaskDetailPage.tsx`（logs tab 部分）
- `backend/app/routers/tasks.py`

---

## Issue E：返回按钮回到项目页（低优先）

**现状**：
- 返回按钮用 `navigate(-1)` 浏览器 history API
- 路由是 `/projects/:id/tasks/:taskId`，用户从项目详情页进入任务详情
- `navigate(-1)` 理论上应该回退到项目详情页

**问题分析**：
- 可能原因：路由跳转时没有正确 push 到 history（比如用了 `replace` 而非 `push`）
- 或者用户是从项目列表页直接打开任务详情（没有经过项目详情页）

**修复方向**：
1. 返回按钮改为 `navigate(`/projects/${projectId}`)` 明确导航到项目详情页（而非 history API）
2. 或者根据来源页动态决定返回目标（如果来自任务中心，返回任务中心）

**涉及文件**：
- `frontend/src/pages/tasks/TaskDetailPage.tsx`（line 392, 416）

---

## 建议优先级

1. **Issue E**（返回按钮）— 改动最小，用户体验最直接
2. **Issue A**（DAG 可视化）— 核心功能，需要 SSE 或 fallback 轮询
3. **Issue B**（实时输出）— 依赖 SSE bridge 修复
4. **Issue D**（日志）— 改为展示 node_executions
5. **Issue C**（Job 列表）— 需要确认是否保留该概念
