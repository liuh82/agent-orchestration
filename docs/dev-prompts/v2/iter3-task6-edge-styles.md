# Nexus 工作流改造 — 阶段6: 连线样式增强

> 请在 agent-orchestration 项目根目录执行。
> 无前置依赖，可与阶段1-5并行执行。

## 必读文件
1. CLAUDE.md — 项目规范
2. `docs/dev-prompts/v2/workflow-node-redesign.md` — §4 连线样式增强
3. `frontend/src/types/workflow.ts` — 找到 EdgeData 或 edge 相关类型
4. `frontend/src/pages/workflows/WorkflowEditorPage.tsx` — 编辑器主页面，找到 edgeTypes 和 defaultEdgeOptions
5. `frontend/src/stores/useWorkflowStore.ts` — Store 中与 edges 相关的逻辑

## 任务目标
增强工作流编辑器的连线视觉表现，让不同类型的连线有区分度。

### 1. 自定义 Edge 组件
创建 `frontend/src/components/workflow/edges/` 目录：

#### 1a. ConditionalEdge（条件连线）
文件：`frontend/src/components/workflow/edges/ConditionalEdge.tsx`

用于 if/switch 节点的条件分支连线：
- 颜色：根据 sourceHandle 变化
  - `true` / `case_0` → `#10b981`（绿色）
  - `false` / `default` → `#ef4444`（红色）
  - `case_1` ~ `case_N` → 循环使用调色板 `['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']`
- 样式：虚线（strokeDasharray: "8 4"）
- 标签：在连线中段显示条件文字（如 "true"、"case: 代码审查"）
- 动画：流动效果（strokeDashoffset 动画）

#### 1b. ParallelEdge（并行连线）
文件：`frontend/src/components/workflow/edges/ParallelEdge.tsx`

用于 parallel/fork/join 的并行分支连线：
- 颜色：`#3b82f6`（蓝色）
- 样式：实线但较粗（strokeWidth: 2.5）
- 标签：显示分支索引（如 "Branch 0"、"Branch 1"）
- 动画：脉冲效果（opacity 呼吸）

#### 1c. NormalEdge（默认连线增强）
文件：`frontend/src/components/workflow/edges/NormalEdge.tsx`

替代现有默认连线，保持简洁但有品牌感：
- 颜色：`#94a3b8`（slate-400）
- 样式：实线（strokeWidth: 1.5）
- 无标签、无动画
- hover 时变为 `#64748b` 并显示 source → target 提示

### 2. 类型定义
在 `workflow.ts` 中添加：
```typescript
export interface CustomEdgeData {
    label?: string;
    edgeType?: 'normal' | 'conditional' | 'parallel' | 'loop';
    animated?: boolean;
    color?: string;
    sourceNodeType?: string;  // 用于自动推断 edgeType
}

// Edge 类型映射规则
export const EDGE_TYPE_RULES: Record<string, string> = {
    if: 'conditional',
    switch: 'conditional',
    parallel: 'parallel',
    fork: 'parallel',
    join: 'parallel',
    loop: 'loop',
};
```

### 3. 编辑器注册
在 `WorkflowEditorPage.tsx` 中：
```typescript
import { ConditionalEdge, ParallelEdge, NormalEdge } from '../components/workflow/edges';

const edgeTypes = {
    conditional: ConditionalEdge,
    parallel: ParallelEdge,
    normal: NormalEdge,
};
```

### 4. Store 自动推断
在 `useWorkflowStore.ts` 中，当添加 edge 时：
1. 查找 source 节点的 type
2. 根据 `EDGE_TYPE_RULES` 自动设置 edge 的 type
3. 如果用户手动修改了 edge type，优先使用用户设置

### 5. 连线交互增强
- **右键连线**：弹出菜单（删除、更改颜色、更改类型）
- **拖拽连线**：连接时高亮可连接的 handle
- **选中连线**：显示 source → target 信息面板

## 完成标准
- [ ] 3种自定义 Edge 组件创建完成
- [ ] Edge 类型自动推断正常工作
- [ ] 条件连线根据 sourceHandle 显示不同颜色和标签
- [ ] 并行连线有分支标签
- [ ] 编辑器中 edges 视觉区分明显
- [ ] 前端 TypeScript 无类型错误
- [ ] 不要 git commit

## 不要做的事
- 不要修改 backend/ 下任何文件
- 不要修改现有的节点组件
- 不要使用复杂的动画库（用 CSS animation 即可）
- 不要 git commit
