# Claude Code 执行指令 — Nexus 前端 TaskDetailPage 修复 + DAG 美化

## 背景
Nexus 工作流引擎 E2E 已跑通，后端 SSE 事件推送正常（`/api/gateway/tasks/{id}/stream` 返回 200）。但前端任务详情页有 3 个问题需要修复。

---

## 任务 1：DAG 可视化美化

**文件**：`frontend/src/components/tasks/TaskWorkflowDAG.tsx`

### 1.1 画布增强
- `CanvasContainer` 高度从 280px 改为 360px
- 背景色改为 `#f1f5f9`（slate-100），增加与白底节点的对比度
- 给 `CanvasContainer` 加 `border-radius: 0 0 16px 16px` 与外层 Wrapper 的圆角匹配

### 1.2 节点运行中脉冲动画
在 `TaskWorkflowDAG.tsx` 中 `styledNodes` 的 style 里，给 `status === 'running'` 的节点加动画：

```tsx
import { keyframes } from 'styled-components';

const pulseAnimation = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
`;
```

在节点 style 中：
```tsx
...(isRunning ? { animation: `${pulseAnimation} 2s ease-in-out infinite` } : {}),
```

### 1.3 节点完成/失败 Badge
在 `styledNodes` 中，给已完成的节点数据注入额外字段，然后在 ReactFlow 的 nodes 上用 data 传递 status。

修改 `styledNodes` 构建逻辑：
```tsx
const styledNodes = useMemo(() => {
  if (!definition?.nodes) return [];
  const raw = definition.nodes.map((n: any) => {
    const runState = nodeStates[n.id]?.status;
    const borderColor = runState ? STATUS_COLORS[runState] : undefined;
    const isPending = !runState;
    const isRunning = runState === 'running';
    const isSuccess = runState === 'success' || runState === 'completed';
    const isFailed = runState === 'failed';
    return {
      ...n,
      draggable: false,
      selectable: false,
      data: {
        ...n.data,
        _runStatus: runState,  // 传递给节点组件
      },
      style: {
        ...(borderColor ? { border: `2px solid ${borderColor}` } : {}),
        opacity: isPending ? 0.5 : 1,
        ...(isRunning ? { animation: `${pulseAnimation} 2s ease-in-out infinite` } : {}),
      },
    };
  });
  return layoutWithDagre(raw, edges);
}, [definition, nodeStates]);
```

### 1.4 边（连线）样式增强
给 edges 根据 source/target 节点状态着色：

```tsx
const styledEdges = useMemo(() => {
  return (edges || []).map((e: any) => {
    const srcStatus = nodeStates[e.source || e.from]?.status;
    let stroke = '#cbd5e1'; // 默认灰色
    let animated = false;
    if (srcStatus === 'success' || srcStatus === 'completed') stroke = '#22c55e';
    else if (srcStatus === 'failed') stroke = '#ef4444';
    else if (srcStatus === 'running') { stroke = '#3b82f6'; animated = true; }
    return {
      ...e,
      animated,
      style: { strokeWidth: 2, stroke },
    };
  });
}, [edges, nodeStates]);
```

然后在 `<ReactFlow>` 中使用 `edges={styledEdges}` 替代 `edges={edges}`。

### 1.5 ReactFlow fitView padding
```tsx
<ReactFlow
  nodes={styledNodes}
  edges={styledEdges}  // ← 改这里
  ...
  fitView
  fitViewOptions={{ padding: 0.3 }}  // ← 加这行
>
```

---

## 任务 2：SSE 连接状态修复

**文件**：`frontend/src/pages/tasks/TaskDetailPage.tsx` + `frontend/src/hooks/useTaskStream.ts`

### 2.1 "连接中..." 文案优化
在 `TaskDetailPage.tsx` 中找到显示连接状态的地方（搜索 "连接中"），改为：
- `isConnected && !isDone` → 显示 "● 已连接"（绿色圆点）
- `!isConnected && !isDone` → 显示 "○ 等待连接..."（灰色圆点）
- `isDone` → 显示 "✓ 已完成"（绿色）

### 2.2 useTaskStream 增加 reconnect 逻辑
在 `useTaskStream.ts` 的 `es.onerror` 中，如果 taskId 存在且 enabled 仍为 true，不要立即设 isConnected=false，而是保持连接让 EventSource 自动重试。只有在 `es.onclose` 时才设 false。

修改 `es.onerror`：
```tsx
es.onerror = () => {
  // EventSource 会自动重连，不立即更新状态避免闪烁
  // 只有真正关闭时才更新
};
```

---

## 任务 3：执行记录 Tab 数据修复

**文件**：`frontend/src/pages/tasks/TaskDetailPage.tsx`

### 3.1 确认 executions API 调用
找到执行记录 Tab 的数据获取代码，确保使用：
```
GET /api/v1/tasks/{taskId}/executions
```

### 3.2 处理返回数据格式
API 返回格式为：
```json
{
  "code": 0,
  "data": {
    "task_id": "...",
    "status": "running",
    "executions": [
      {
        "id": "execution-uuid",
        "workflow_id": "...",
        "status": "running",
        "nodes": [
          {
            "node_id": "trigger_1",
            "status": "success",
            "duration_ms": 0,
            "error_message": null,
            "started_at": "2026-03-21T08:17:07Z",
            "completed_at": "2026-03-21T08:17:07Z"
          }
        ]
      }
    ]
  }
}
```

前端需要从 `response.data.executions[0].nodes` 取节点执行列表。

### 3.3 将 executions 数据传给 DAG 组件
在 TaskDetailPage 中，当 SSE 没有事件数据时，用 executions API 的节点数据作为 `executionNodes` prop 传给 `TaskWorkflowDAG`：

```tsx
<TaskWorkflowDAG
  workflowId={task?.workflow_id}
  workflowEvents={streamEvents}
  executionNodes={executions?.[0]?.nodes}
/>
```

---

## 注意事项

1. **不要改动后端代码**，只改前端
2. **不要新增 npm 依赖**，用已有的 styled-components + @xyflow/react
3. 修改完成后在项目根目录执行 `cd frontend && npm run build`
4. 提交信息格式：`fix: 任务详情页 — DAG美化+SSE连接状态+执行记录修复`
5. 推送到 main 分支

---

## 验证方式

1. 打开 Nexus 前端，进入任意任务详情页
2. 确认 DAG 图：
   - 节点有颜色左边框和状态指示
   - 运行中节点有蓝色脉冲动画
   - 连线根据状态着色（绿=成功，蓝=运行中，红=失败，灰=未执行）
   - 画布高度足够不拥挤
3. 确认 SSE 状态：
   - 任务 running 时显示 "● 已连接"
   - 任务未运行时显示 "○ 等待连接..."
4. 确认执行记录 Tab 有数据（节点列表 + 状态 + 耗时）
