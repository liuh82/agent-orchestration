# Nexus 工作流改造 — 阶段6: 连线样式增强

> 请在 agent-orchestration 项目根目录执行。
> 无前置依赖，可与任何阶段并行执行。

## 必读文件
1. CLAUDE.md — 项目规范
2. `docs/dev-prompts/v2/workflow-node-redesign.md` — §4 连线样式规范
3. `frontend/src/pages/workflows/WorkflowEditorPage.tsx` — 编辑器主页面
4. `frontend/src/components/workflow/EditorToolbar.tsx` — 工具栏
5. `frontend/src/types/workflow.ts` — WorkflowEdge 类型

## 任务目标
增强工作流编辑器中的连线视觉表现，让不同类型的连线一眼可辨。

### 1. 连线类型配色
根据 sourceHandle（连接端口）或 source node type，为连线设置不同颜色：

| 连线类型 | 颜色 | 虚线 | 说明 |
|---------|------|------|------|
| 普通数据流 | `#666`（灰色） | 实线 | 默认 |
| fork 分支 | `#6366f1`（靛蓝） | 实线 | fork → 下游 |
| join 合并 | `#6366f1`（靛蓝） | 实线 | 上游 → join |
| 条件分支 true | `#22c55e`（绿色） | 实线 | if true / switch case |
| 条件分支 false | `#ef4444`（红色） | 实线 | if false |
| 条件默认 | `#f59e0b`（琥珀） | 虚线 | switch default |
| 循环 body | `#06b6d4`（青色） | 实线 | loop body |
| 循环 done | `#06b6d4`（青色） | 虚线 | loop done |
| 上下文传递 | `#f59e0b`（琥珀） | 虚线 | context_output |
| 错误/异常 | `#ef4444`（红色） | 虚线 | onError=skip 路径 |

### 2. 实现
在 `WorkflowEditorPage.tsx` 或单独新建 `edgeUtils.ts`：

```typescript
export function getEdgeStyle(edge: Edge, nodes: Node[]): { stroke: string; animated?: boolean; strokeDasharray?: string } {
    const sourceHandle = edge.sourceHandle || '';
    const sourceNode = nodes.find(n => n.id === edge.source);
    
    // fork/join 分支
    if (sourceHandle.startsWith('branch_')) {
        return { stroke: '#6366f1' };
    }
    
    // if 条件
    if (sourceHandle === 'true') return { stroke: '#22c55e' };
    if (sourceHandle === 'false') return { stroke: '#ef4444' };
    
    // switch case
    if (sourceHandle.startsWith('case_')) return { stroke: '#22c55e' };
    if (sourceHandle === 'default') return { stroke: '#f59e0b', strokeDasharray: '5 5' };
    
    // loop
    if (sourceHandle === 'body') return { stroke: '#06b6d4' };
    if (sourceHandle === 'done') return { stroke: '#06b6d4', strokeDasharray: '5 5' };
    
    // context_output
    if (sourceNode?.type === 'context_output') {
        return { stroke: '#f59e0b', strokeDasharray: '5 5' };
    }
    
    // 默认
    return { stroke: '#666' };
}
```

在 React Flow 的 defaultEdgeOptions 或每条 Edge 的 style 属性上应用。

### 3. 连线标签（可选增强）
对于条件分支，在连线上显示标签文字：
- if true → "✓" 绿色
- if false → "✗" 红色
- switch case → case 名称
- fork branch → "分支 N"
- loop body → "循环体"
- loop done → "完成"

使用 React Flow 的 `edgeTypes` 自定义带标签的 Edge 组件。

### 4. 工具栏图例
在 EditorToolbar 底部或编辑器角落添加一个小图例，显示连线颜色含义。

## 完成标准
- [ ] 不同类型的连线颜色正确区分
- [ ] 条件分支连线实线/虚线正确
- [ ] fork/join 连线靛蓝色
- [ ] 可选：连线标签显示
- [ ] 可选：图例
- [ ] 前端 TypeScript 无类型错误
- [ ] 不要 git commit

## 不要做的事
- 不要修改后端任何文件
- 不要修改节点的连线逻辑
- 不要 git commit
