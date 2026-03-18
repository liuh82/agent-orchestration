# 迭代三 T2.2：前端配置面板补充

## 背景
后端 P0 修复已完成，agent CONFIG_SCHEMA 新增了 6 个字段。前端需要同步更新类型定义和配置面板。

## 需要修改的文件

### 1. `frontend/src/types/workflow.ts` — AgentNodeData 接口

在 `AgentNodeData` 接口中添加 6 个字段：

```typescript
// --- 新增字段（放在 cacheTTL 之后）---
agentSelectMode?: 'select' | 'manual';  // Agent 选择模式
workDir?: string;                        // 工作目录
envVars?: string;                        // 环境变量 JSON 字符串
outputFormat?: 'text' | 'json' | 'markdown';  // 输出格式
outputAlias?: string;                    // 输出别名（用于下游节点引用）
gitEnabled?: boolean;                    // 启用 Git 集成
```

### 2. `frontend/src/components/workflow/NodeConfigPanel.tsx` — AgentForm

在 AgentForm 的**高级设置** Collapse 中，在"输出过滤"之前，添加以下 4 个配置项：

```tsx
{/* 输出别名 */}
<Form.Item
  label="输出别名"
  style={{ marginBottom: spacing[2] as string }}
  extra="下游节点可用 {{别名}} 引用此节点输出，默认为节点 ID"
>
  <Input
    value={data.outputAlias}
    onChange={(e) => onUpdate({ outputAlias: e.target.value })}
    placeholder="myOutput"
    size="small"
    style={LIGHT_SELECT_STYLE}
  />
</Form.Item>

{/* 输出格式 */}
<Form.Item label="输出格式" style={{ marginBottom: spacing[2] as string }}>
  <Select
    value={data.outputFormat ?? 'text'}
    onChange={(val) => onUpdate({ outputFormat: val as AgentNodeData['outputFormat'] })}
    size="small"
    style={LIGHT_SELECT_STYLE}
    options={[
      { value: 'text', label: '纯文本' },
      { value: 'json', label: 'JSON' },
      { value: 'markdown', label: 'Markdown' },
    ]}
  />
</Form.Item>

{/* 工作目录 */}
<Form.Item
  label="工作目录"
  style={{ marginBottom: spacing[2] as string }}
  extra="Agent 执行时的工作目录，留空则使用项目目录"
>
  <Input
    value={data.workDir}
    onChange={(e) => onUpdate({ workDir: e.target.value })}
    placeholder="/path/to/project"
    size="small"
    style={LIGHT_SELECT_STYLE}
  />
</Form.Item>

{/* 环境变量 */}
<Form.Item
  label="环境变量 (JSON)"
  style={{ marginBottom: spacing[2] as string }}
  extra='额外环境变量，如 {"NODE_ENV": "production"}'
>
  <Input.TextArea
    value={data.envVars ?? ''}
    onChange={(e) => onUpdate({ envVars: e.target.value })}
    rows={2}
    placeholder='{"NODE_ENV": "production"}'
    style={{
      ...LIGHT_SELECT_STYLE,
      fontFamily: typography.fontFamily.mono,
      fontSize: typography.fontSize.sm,
    }}
  />
</Form.Item>

{/* Git 集成 */}
<Form.Item
  label="启用 Git 集成"
  style={{ marginBottom: spacing[2] as string }}
  extra="创建分支并提交 Agent 产生的代码变更"
>
  <Switch
    checked={data.gitEnabled ?? false}
    onChange={(checked) => onUpdate({ gitEnabled: checked })}
    size="small"
  />
</Form.Item>
```

### 3. AgentForm 手动/选择模式的 agentSelectMode 同步

AgentForm 已有 `manualMode` state（通过 `!data.agentId` 控制），需要同步更新 `agentSelectMode`：

在 `handleAgentSelect` 中添加：
```typescript
onUpdate({ agentId, agentSelectMode: 'select', label: data.label });
```

在手动模式 Button 的 onClick 中添加：
```typescript
onClick={() => { setManualMode(true); onUpdate({ agentSelectMode: 'manual' }); }}
```

在选择模式 Button 的 onClick 中添加：
```typescript
onClick={() => { setManualMode(false); onUpdate({ agentSelectMode: 'select' }); }}
```

## 不需要修改的文件

- `ForkNode.tsx`、`JoinNode.tsx`、`InputNode.tsx` 等节点组件 — BaseNode 已正确渲染 handles
- `BaseNode.tsx` — 无需改动
- `workflow.ts` 中的 NODE_META — fork/join 的 handles 定义已正确
- `NodeConfigPanel.tsx` 中的 InputForm、ContextOutputForm、ResultOutputForm — 已有完整实现

## 验收标准

1. `npm run build` 编译通过
2. 打开工作流编辑器 → 拖入 Agent 节点 → 点击配置面板 → 高级设置中能看到：输出别名、输出格式、工作目录、环境变量、Git 集成
3. 切换"选择 Agent"/"手动配置"时 `agentSelectMode` 正确更新

## 禁止事项
- 不要修改 BaseNode、ForkNode、JoinNode 等节点组件
- 不要修改 NODE_META 的 handles 定义
- 不要修改已有的 InputForm、ContextOutputForm、ResultOutputForm
- 不要修改后端代码
