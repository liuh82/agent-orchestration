# Nexus P1 修复 — 开发 Prompt

## 目标
修复 2 个 P1 问题：
1. 工作流编辑器连线功能（显示 node label 而非 ID、支持删除连线、选中效果）
2. Agent 创建页 Bridge 列表为空（显示所有 bridge，离线标注状态）

## 项目路径
/root/.openclaw/workspace/agent-orchestration

---

## 修复 1: 连线功能

### 1.1 浮动窗口显示 node label 而非 node ID

**文件**: `frontend/src/components/workflow/edges/NormalEdge.tsx`

当前 NormalEdge 的 hover tooltip 显示 `{source} → {target}`，这是 node ID（UUID），用户看不懂。

**需要修改**：`NormalEdge` 组件需要能获取到 source/target 节点的 label。但 edge 组件默认只接收 `source`（node ID）和 `target`（node ID），没有节点数据。

**方案**：使用 ReactFlow 的 `useNodesState` 或 `useStore` 在 edge 组件中查找节点 label。

```tsx
import { useStore } from '@xyflow/react';

// 在 NormalEdge 组件内部：
const sourceNode = useStore((s) => s.nodeLookup?.get(source));
const targetNode = useStore((s) => s.nodeLookup?.get(target));
const sourceLabel = (sourceNode?.data as any)?.label || sourceNode?.type || source;
const targetLabel = (targetNode?.data as any)?.label || targetNode?.type || target;
```

然后 tooltip 显示 `sourceLabel → targetLabel`。

同样修改 `ConditionalEdge.tsx` 和 `ParallelEdge.tsx` 的 label（如果有的话）。

### 1.2 支持删除连线

**文件**: `frontend/src/pages/workflows/WorkflowEditorPage.tsx`

当前 ReactFlow 的 `deleteKeyCode={null}`，禁用了键盘删除。需要：
1. 恢复 `deleteKeyCode`，改为 `['Backspace', 'Delete']`
2. 添加 `onEdgesDelete` 回调（如果需要），或依赖默认行为
3. **添加右键菜单或工具栏删除按钮**：点击连线后可以删除

**最小修改方案**：
1. 去掉 `deleteKeyCode={null}`（让默认的 Backspace/Delete 生效）
2. 添加 `onEdgeClick` handler 高亮选中连线
3. 添加一个工具栏删除按钮（在 EditorToolbar 或浮动工具栏中）

### 1.3 选中效果

**文件**: `frontend/src/pages/workflows/WorkflowEditorPage.tsx`

当前没有 edge 选中逻辑。需要：
1. 添加 `selectedEdges` 状态（ReactFlow 自带 `onEdgesChange` 会处理选中）
2. 给 edge 组件添加 `selected` prop 样式（加粗、改颜色）
3. 或者在 NormalEdge/ConditionalEdge/ParallelEdge 中处理 selected 状态

**方案**：ReactFlow 默认支持 edge 选中（点击选中，显示选中样式）。只需：
1. 确认 `onEdgesChange` 正确传递了 selection change
2. 在 edge 组件中根据 `selected` prop 添加视觉反馈（加粗 stroke、加阴影）

---

## 修复 2: Bridge 列表

### 2.1 显示所有 Bridge（含离线）

**文件**: `frontend/src/pages/agents/AgentNewPage.tsx`

当前第 417 行：`bridges.filter((b) => b.status === 'online')` 只显示在线 bridge。

**修改为**：显示所有 bridge，离线的用 Option disabled + 标注状态：

```tsx
{bridges.map((b) => (
  <Select.Option
    key={b.bridge_id}
    value={b.bridge_id}
    disabled={b.status !== 'online'}
    style={b.status !== 'online' ? { color: '#999' } : undefined}
  >
    {b.hostname || b.bridge_id} ({b.platform})
    {b.status !== 'online' ? ` [${b.status}]` : ''}
  </Select.Option>
))}
```

### 2.2 更新 notFoundContent

当没有任何 bridge 时提示用户去添加：
```tsx
notFoundContent={
  bridges.length === 0 ? (
    <span style={{ color: colors.text.error }}>暂无 Bridge，请先在设置或后台管理中添加</span>
  ) : undefined
}
```

---

## 验收标准

1. 拖拽连线后，hover 连线看到的是节点 label（如 "代码审查 → Claude Code"），不是 UUID
2. 选中连线后有明显视觉反馈（颜色/粗细变化）
3. 选中连线后按 Delete/Backspace 可以删除
4. Agent 创建页 Bridge 下拉框显示所有 bridge，离线 bridge 灰色可看但不可选
5. 前端构建成功：`cd frontend && npx tsc --noEmit && npm run build`

## 注意事项
- 只修改前端，不改后端
- 保持现有 edge 类型（normal/conditional/parallel）的视觉风格
- 确保 `useStore` 从 `@xyflow/react` 正确导入
- 修改完后 `git add -A && git commit -m "fix: P1 连线功能优化 + Bridge 列表显示修复"`
