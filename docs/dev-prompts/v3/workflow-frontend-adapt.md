# 迭代三 T2.2：前端工作流编辑器适配

## 背景
T2.1 后端集成验证已完成，fork/join/outputAlias 逻辑可工作。现在需要补齐前端编辑器的适配问题，确保用户能正确创建和配置包含 fork/join 的多分支工作流。

## 现有状态
- ✅ 前端节点组件存在（ForkNode/JoinNode/InputNode/ContextOutputNode/ResultOutputNode），但都是空壳（只渲染 BaseNode）
- ✅ 配置面板已有表单（InputForm/ContextOutputForm/ResultOutputForm/ForkForm/JoinForm）
- ✅ 类型定义完整（NODE_META 中各节点的 handles、defaultData）
- ⚠️ Fork 节点 handles 硬编码为 branch_0 + branch_1，但 branchCount 可调到 10
- ⚠️ Agent 配置面板缺少 6 个新字段（后端已添加）
- ⚠️ Fork 节点组件没有动态 handles 支持

## 任务

### 1. Fork 节点动态 Handles

**问题**：`NODE_META.fork.handles.outputs` 硬编码 2 个输出（branch_0, branch_1），但用户可以在配置面板调 `branchCount` 到 2-10。当 branchCount > 2 时，多余的分支没有对应的 Handle，无法连线。

**修复方案**：在 `ForkNode.tsx` 中根据 `data.branchCount` 动态生成 extraOutputs 传给 BaseNode。

```tsx
export const ForkNode = memo(function ForkNode({ data, selected, type }: NodeProps) {
  const branchCount = (data as any).branchCount ?? 2;
  const extraOutputs = useMemo(() => {
    return Array.from({ length: branchCount }, (_, i) => ({
      id: `branch_${i}`,
      type: 'source' as const,
      label: `分支 ${i}`,
    }));
  }, [branchCount]);

  return (
    <BaseNode
      data={data}
      selected={selected}
      type={type}
      icon={<BranchesOutlined />}
      extraOutputs={extraOutputs}
    />
  );
});
```

**同时**：在 NODE_META 中把 fork 的 outputs 改为空数组（因为由 ForkNode 动态生成），或者保留默认的 2 个但让 ForkNode 的 extraOutputs 完全覆盖。

**注意**：如果 NODE_META 的 outputs 和 extraOutputs 都有，BaseNode 会合并。所以 NODE_META.fork.outputs 应该设为空数组 `[]`，让 ForkNode 完全控制。

### 2. Agent 配置面板补充新字段

在 `NodeConfigPanel.tsx` 的 AgentForm 高级设置中添加 6 个字段：

**位置**：在 `maxRetries` 和 `onError` 之间或之后添加新的折叠面板区域。

```
### 2.1 outputAlias（输出别名）
- 类型：Input
- 标签：输出别名
- 说明：设置后下游节点可通过 {{别名}} 引用此节点输出
- 默认值：空（使用 node_id）

### 2.2 outputFormat（输出格式）
- 类型：Select
- 选项：text / json / markdown
- 默认值：text

### 2.3 workDir（工作目录）
- 类型：Input
- 标签：工作目录
- 说明：Agent 执行的工作目录，留空使用项目根目录

### 2.4 envVars（环境变量）
- 类型：Input.TextArea
- 标签：环境变量
- 说明：JSON 格式，如 {"NODE_ENV": "production"}
- rows: 2

### 2.5 gitEnabled（启用 Git 集成）
- 类型：Switch
- 标签：启用 Git
- 说明：自动创建 Git 分支并提交变更
- 默认值：false

### 2.6 agentSelectMode（Agent 选择模式）
- 这个字段实际上已经通过"选择 Agent / 手动配置"两个按钮实现了
- 但需要确保数据同步：选择模式 = 'select'，手动模式 = 'manual'
- 在切换按钮时也更新 agentSelectMode 字段
```

**同时**：更新 `AgentNodeData` 类型定义（`types/workflow.ts`），添加这些字段。

### 3. Fork 配置面板完善

当前 Fork 配置只有「分发模式」和「分支数量」。需要：
- 当 `branchCount` 改变时，同步更新 `branchData` 数组长度（如果当前比新值短，push 空对象；如果比新值长，slice 截断）
- 在 `distribute` 模式下显示分支数据编辑（已有 branchData 但没有编辑 UI）

### 4. 节点描述增强

让节点组件在编辑器中显示有用的描述信息（类似 AgentNode 显示 model 和错误策略 badge）：

- **ForkNode**：显示模式（broadcast/distribute）+ 分支数
- **JoinNode**：显示模式（all/any/n_of_m）
- **InputNode**：显示数据来源（project/task/manual）
- **ContextOutputNode**：显示输出目标数量
- **ResultOutputNode**：显示输出格式

## 文件清单

### 需修改的文件
- `frontend/src/types/workflow.ts` — AgentNodeData 添加新字段，NODE_META.fork.outputs 改为空数组
- `frontend/src/components/workflow/nodes/ForkNode.tsx` — 动态 handles + 描述
- `frontend/src/components/workflow/nodes/JoinNode.tsx` — 描述
- `frontend/src/components/workflow/nodes/InputNode.tsx` — 描述
- `frontend/src/components/workflow/nodes/ContextOutputNode.tsx` — 描述
- `frontend/src/components/workflow/nodes/ResultOutputNode.tsx` — 描述
- `frontend/src/components/workflow/NodeConfigPanel.tsx` — AgentForm 添加新字段，ForkForm 完善

### 参考文件（只读）
- `frontend/src/components/workflow/nodes/AgentNode.tsx` — 描述 badge 的写法
- `frontend/src/components/workflow/nodes/BaseNode.tsx` — extraOutputs 和 description props
- `frontend/src/components/workflow/nodes/SwitchNode.tsx` — 动态 handles 的另一个例子（如果有）
- `frontend/src/components/workflow/node-styles.tsx` — 样式 tokens

## 验收标准
1. Fork 节点在编辑器中拖入后，默认显示 2 个输出端口
2. 修改 branchCount 为 3 后，立即出现第 3 个输出端口
3. Agent 配置面板的高级设置中有 outputAlias、outputFormat、workDir、envVars、gitEnabled 字段
4. 所有节点在编辑器中显示简要描述信息
5. 前端 build 无报错

## 构建和测试
完成代码修改后，在 `frontend/` 目录下运行 `npm run build` 确认编译通过。
如果编译失败，根据错误信息修复。

## 禁止事项
- 不要修改后端代码
- 不要修改数据库
- 不要添加新的 npm 依赖
- 不要改颜色/字体等视觉样式
