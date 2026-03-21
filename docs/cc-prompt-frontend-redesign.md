# Claude Code 执行指令 — Nexus 前端全面重制

## 背景
Nexus 工作流引擎后端已完全跑通（8 节点 E2E 验证通过，SSE 实时事件推送正常）。前端需要全面升级：
1. 工作流 DAG 可视化（任务详情页，只读）
2. 工作流编辑器（可编辑，拖拽连线）
3. 实时输出 Stream tab 功能修复
4. 执行记录 Tab 数据对接

**设计参考：n8n 工作流编辑器**（https://n8n.io）
- GitHub: https://github.com/n8n-io/n8n
- 截图参考：打开 n8n workflow 编辑器页面观察其节点样式

---

## 设计规范（n8n 风格）

### 节点样式
- **尺寸**：最小宽度 200px，高度自适应（标题 32px + 内容区）
- **背景**：白色 `#ffffff`，圆角 `10px`
- **阴影**：`0 2px 8px rgba(0,0,0,0.08)`，hover 时 `0 4px 12px rgba(0,0,0,0.12)`
- **左侧色条**：4px 宽，按节点类型着色（复用现有 NODE_META.color）
- **顶栏**：高度 28px，背景色 = 节点类型 color 的 20% 透明度，内含彩色小图标 + 节点标题
- **内容区**：padding 8px 12px，显示节点类型副标题或简要描述
- **选中态**：蓝色 2px 边框 `#3b82f6` + `0 0 0 3px rgba(59,130,246,0.2)` 外发光
- **disabled 态**：opacity 0.5，边框虚线
- **运行中态**：蓝色脉冲光晕动画（`box-shadow` 呼吸效果 2s 循环）
- **成功态**：左上角叠加 ✅ 小 badge（绿色圆圈 18px，白色勾号）
- **失败态**：左上角叠加 ❌ 小 badge（红色圆圈 18px，白色叉号）+ 轻微抖动动画

### 连线样式
- **类型**：`smoothstep`（n8n 风格，带圆角的直角连线）
- **粗细**：2px
- **颜色**：
  - 未执行：`#cbd5e1`（灰色）
  - 已完成：`#22c55e`（绿色）
  - 运行中：`#3b82f6`（蓝色）+ 虚线动画（`stroke-dasharray: 5 5`，`stroke-dashoffset` 动画 1s 循环）
  - 失败：`#ef4444`（红色）
- **箭头**：连线末端实心三角箭头，颜色与连线一致

### 画布
- **背景**：`#f8fafc`（slate-50），点阵网格 `#e2e8f0`，间距 20px，点径 1.5px
- **暗色模式背景**：`#1e293b`，点阵 `#334155`
- **fitView padding**：0.3
- **minimap**：启用，右下角，半透明背景
- **controls**：仅显示 +/- 缩放按钮，隐藏交互式控件

---

## 任务 1：重写 BaseNode 组件

**文件**：`frontend/src/components/workflow/nodes/BaseNode.tsx` + `node-styles.ts`

按照上面设计规范重写节点组件。保持现有 props 接口不变，只改视觉样式。

关键变更：
1. `NodeWrapper` — 增加顶栏样式、调整阴影、hover 效果
2. 新增 `NodeBadge` 组件 — 用于成功/失败状态角标
3. `HandleContainer` — 调整为顶栏底部居中（target 在顶栏上方，source 在底部）
4. `HandleLabelTag` — 多输出时的标签样式调整
5. 增加 CSS keyframes 动画（pulse、shake）

**注意**：BaseNode 被所有节点组件引用，改动要向后兼容。

---

## 任务 2：TaskWorkflowDAG 组件升级

**文件**：`frontend/src/components/tasks/TaskWorkflowDAG.tsx`

### 2.1 画布增强
- 高度从 280px → 380px
- 背景 `#f8fafc`
- 添加 `<MiniMap>` 组件
- `<Controls showInteractive={false} />`

### 2.2 边（连线）样式
新增 `styledEdges` useMemo，根据 source 节点状态着色和动画：

```tsx
const styledEdges = useMemo(() => {
  return (edges || []).map((e: any) => {
    const srcStatus = nodeStates[e.source || e.from]?.status;
    let stroke = '#cbd5e1';
    let animated = false;
    if (srcStatus === 'success' || srcStatus === 'completed') stroke = '#22c55e';
    else if (srcStatus === 'failed') stroke = '#ef4444';
    else if (srcStatus === 'running') { stroke = '#3b82f6'; animated = true; }
    return {
      ...e,
      type: 'smoothstep',  // n8n 风格
      animated,
      style: { strokeWidth: 2, stroke },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke },
    };
  });
}, [edges, nodeStates]);
```

需要在顶部 import `MarkerType` from `@xyflow/react`。

### 2.3 节点状态传递
在 `styledNodes` 中将 `_runStatus` 传入节点 data：

```tsx
data: { ...n.data, _runStatus: runState },
style: {
  ...(borderColor ? { border: `2px solid ${borderColor}` } : {}),
  opacity: isPending ? 0.5 : 1,
  ...(isRunning ? { animation: `${pulseAnimation} 2s ease-in-out infinite` } : {}),
},
```

### 2.4 进度条
进度数据从 workflow_event 中提取（已有代码 `wfProgress`），传递给 Progress 组件。

---

## 任务 3：Stream Tab 功能修复

**文件**：`frontend/src/pages/tasks/TaskDetailPage.tsx`

### 3.1 workflow_event 渲染（已修复，确保代码正确）
确认以下渲染逻辑存在且工作正常：
- `node.status_changed` → 显示节点状态行（✅/❌/🔵 节点名: status）
- `execution.progress` → 显示进度行（📊 进度: x/y）
- `execution.status_changed` → 显示执行完成/失败

### 3.2 "接收中..." 文案
`isConnected && streamEvents.length === 0` 时显示 "接收中..."（已修复）。
`isConnected && streamEvents.length > 0` 时不显示任何状态标签。

### 3.3 进度条数据源
使用 `wfProgress`（从 workflow_event.progress 计算）替代 `streamProgress`（已修复）。

---

## 任务 4：执行记录 Tab 数据对接

**文件**：`frontend/src/pages/tasks/TaskDetailPage.tsx`

### 4.1 获取 executions 数据
确认已通过 API 获取执行记录：
```
GET /api/v1/tasks/{taskId}/executions
```

### 4.2 渲染节点执行列表
在执行记录 tab 中展示每个节点的：
- 节点名称 + 类型
- 状态（badge：成功/失败/运行中/等待）
- 耗时
- 错误信息（如果有）

使用 Ant Design 的 `<Table>` 或 `<List>` 组件，columns:
| 节点 | 类型 | 状态 | 耗时 | 错误 |

### 4.3 传递给 DAG 组件
将 executions 数据作为 `executionNodes` prop 传给 `TaskWorkflowDAG`，确保 SSE 没有数据时 DAG 也能显示节点状态。

---

## 任务 5：工作流编辑器节点样式统一

**文件**：`frontend/src/components/workflow/WorkflowEditorPage.tsx` + `nodes/` 目录

### 5.1 节点面板样式
确认编辑器中的节点复用 BaseNode 组件，样式与任务详情页一致。

### 5.2 连线样式
编辑器中的连线也使用 smoothstep 类型：
```tsx
defaultEdgeOptions={{ type: 'smoothstep', style: { strokeWidth: 2, stroke: '#cbd5e1' } }}
```

### 5.3 画布背景
编辑器画布背景与任务详情页一致（`#f8fafc` + 点阵）。

---

## 执行步骤

1. 先修改 `node-styles.ts`（全局节点样式变量和组件）
2. 修改 `BaseNode.tsx`（节点组件结构）
3. 修改 `TaskWorkflowDAG.tsx`（DAG 只读视图）
4. 修改 `TaskDetailPage.tsx`（Stream + 执行记录）
5. 修改 `WorkflowEditorPage.tsx`（编辑器连线/画布）
6. 在项目根目录执行 `cd frontend && npm run build`
7. 提交信息：`feat: 前端 UI 全面升级 — n8n 风格节点 + 实时输出 + 执行记录`
8. 推送到 main 分支

## 注意事项

- **不要改动后端代码**
- **不要新增 npm 依赖**
- 保持所有现有 props 接口不变
- 使用 styled-components 的 `keyframes` 做动画
- `MarkerType` 从 `@xyflow/react` 导入
- 编辑器已有的拖拽、连线、缩放功能不要破坏
- 所有中英文文案保持现有风格

## 验证方式

1. 打开工作流编辑器 → 节点应为 n8n 风格（彩色顶栏、白色卡片、阴影）
2. 创建任务并执行 → DAG 页应实时显示节点状态（脉冲动画、成功 badge、连线着色）
3. Stream tab 应显示 workflow 事件流（节点状态变更行、进度行）
4. 执行记录 tab 应显示节点列表（名称、类型、状态、耗时、错误）
5. 编辑器中拖拽/连线功能正常不受影响
