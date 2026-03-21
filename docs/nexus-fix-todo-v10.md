# Nexus Fix Todo v10 — SSE 认证 + 执行记录 API + 任务状态可见性

> 创建时间：2026-03-21 15:19 UTC+8

---

## 问题概述

用户在前端 Nexus 任务详情页看不到任何任务执行情况：
- 实时输出流显示"未连接"
- DAG 可视化空白
- Job 列表空白
- 日志空白

根因：SSE 认证不匹配 + 缺失 API 端点。

---

## Issue A：SSE stream 端点认证不匹配（🔴 阻塞性）

**文件**：`backend/app/routers/gateway.py` line 422-470

**现状**：
```python
@router.get("/tasks/{task_id}/stream")
@limiter.limit("30/minute")
async def stream_task_events(
    request: Request,
    task_id: str,
    db: Session = Depends(get_db),
    _api_key: str = Depends(verify_api_key),  # ← 只认 API key
):
```

**前端调用方式**（`frontend/src/hooks/useTaskStream.ts`）：
```typescript
const token = useAuthStore.getState().accessToken;
const url = new URL(`${baseUrl}/gateway/tasks/${taskId}/stream`, window.location.origin);
url.searchParams.set('token', token);  // ← 传的是 JWT token
const es = new EventSource(url.toString());
```

EventSource API 不支持自定义 header，只能通过 query parameter 传 token。但后端 `verify_api_key` 只检查 `X-API-Key` header 或 `?api_key=` query parameter。

**修复方向**：
1. 为 SSE stream 端点增加 JWT token 认证支持
2. 在 `stream_task_events` 的依赖中，除了 `verify_api_key`，还支持从 `?token=` query parameter 验证 JWT

**具体方案**：
```python
# gateway.py 或 auth.py 新增
async def verify_stream_token(request: Request, db: Session = Depends(get_db)):
    """支持 SSE 流的认证：X-API-Key header 或 ?token= JWT query parameter。"""
    # 1. 先尝试 API key
    api_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
    if api_key:
        return await verify_api_key(request, api_key=api_key)

    # 2. 再尝试 JWT token（EventSource 不支持自定义 header）
    token = request.query_params.get("token")
    if token:
        from app.services.auth import verify_jwt_token
        user = verify_jwt_token(token, db)
        if user:
            return user

    raise HTTPException(status_code=401, detail="Unauthorized")
```

然后 SSE 端点改为：
```python
@router.get("/tasks/{task_id}/stream")
async def stream_task_events(
    request: Request,
    task_id: str,
    db: Session = Depends(get_db),
    _user = Depends(verify_stream_token),  # ← 改这里
):
```

---

## Issue B：`/tasks/{id}/executions` API 缺失（🔴 阻塞性）

**现状**：前端 TaskDetailPage 需要 API 获取节点执行记录，但后端没有这个端点。

**修复方向**：
在 `backend/app/routers/tasks.py` 新增端点：

```python
@router.get("/{task_id}/executions")
async def get_task_executions(
    task_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取任务关联的工作流节点执行记录。"""
    # 1. 查 task 关联的 workflow_executions
    executions = db.query(WorkflowExecution).filter(
        WorkflowExecution.task_id == task_id
    ).order_by(WorkflowExecution.started_at.desc()).all()
    
    # 2. 返回 execution 列表 + 每个 execution 下的 node_executions
    result = []
    for exec in executions:
        nodes = db.query(WorkflowNodeExecution).filter(
            WorkflowNodeExecution.task_id == task_id,
            WorkflowNodeExecution.execution_id == exec.id,
        ).order_by(WorkflowNodeExecution.started_at).all()
        result.append({
            "id": exec.id,
            "status": exec.status,
            "started_at": exec.started_at,
            "completed_at": exec.completed_at,
            "error_message": exec.error_message,
            "nodes": [
                {
                    "node_id": n.node_id,
                    "node_type": n.node_type,
                    "status": n.status,
                    "duration_ms": n.duration_ms,
                    "error_message": n.error_message,
                    "started_at": n.started_at,
                    "completed_at": n.completed_at,
                }
                for n in nodes
            ]
        })
    return success_response({"items": result, "total": len(result)})
```

注意：需要确认 `WorkflowExecution` 和 `WorkflowNodeExecution` 模型中 `task_id` 字段的存在。如果 ORM 模型中没有 `task_id`，需要通过 `workflow_executions` 表的 `id` 和 `workflow_node_executions` 表的 `execution_id` 关联，task_id 需要从 input_params 中解析或添加外键。

---

## Issue C：Job 列表和日志 tab 适配（🟡 功能性）

**现状**：
- Job 列表 tab：前端调用 `/tasks/{id}/jobs` → 404
- 日志 tab：前端调用 `/tasks/{id}/logs` → 404
- Job 概念在当前 workflow engine 中已被 node_executions 替代

**修复方向（二选一）**：

**方案 A（推荐）：** 改前端 tab 内容
- "Job 列表" tab 改为 "执行记录"，展示 `/tasks/{id}/executions` 的 node_executions 数据
- "日志" tab 改为展示 node_executions 的 output_data 摘要和 error_message
- 如果 SSE 实时事件已通，可以合并到"实时输出"tab，只保留两个 tab：实时输出 + 执行记录

**方案 B：** 实现后端 API
- `/tasks/{id}/jobs` → 查询 jobs 表
- `/tasks/{id}/logs` → 查询 agent_logs 或 task_files 表

推荐方案 A — 更简单且信息更相关。

---

## Issue D：DATABASE_URL 应使用绝对路径（🟡 稳定性）

**文件**：`backend/.env`

**现状**：`DATABASE_URL=sqlite:///./data/nexus.db`（相对路径）

不同方式启动后端时 cwd 不同（nohup/bash -c/exec 的行为差异），导致连接到不同的 DB 文件。

**修复**：已改为绝对路径：
```
DATABASE_URL=sqlite:////root/.openclaw/workspace/agent-orchestration/backend/data/nexus.db
```

确认 `.env` 文件已更新。如果代码中有硬编码的相对路径也需要一并修改。

---

## Issue E：TaskWorkflowDAG fallback 渲染（🟢 体验优化）

**文件**：`frontend/src/components/tasks/TaskWorkflowDAG.tsx`

**现状**：组件依赖 SSE `workflow_event` 事件来更新节点状态。如果 SSE 不通（Issue A），DAG 完全空白。

**修复方向**：
1. 如果 `workflowEvents` 为空，从 `task.workflow_snapshot` 静态渲染节点拓扑图
2. 通过轮询 `/tasks/{id}/executions`（Issue B）获取节点执行状态
3. 节点状态用颜色区分：pending(灰)、running(蓝)、success(绿)、failed(红)

---

## 修复顺序建议

1. **Issue A**（SSE 认证）→ 解除实时输出阻塞
2. **Issue B**（executions API）→ 提供数据源
3. **Issue C**（前端 tab 适配）→ 替换空白 Job/日志
4. **Issue E**（DAG fallback）→ 即使 SSE 断开也能看到流程图
5. **Issue D**（DB 路径）→ 确认 .env 已更新
