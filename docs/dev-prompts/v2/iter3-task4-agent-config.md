# Nexus 工作流改造 — 阶段4: Agent 节点配置改造

> 请在 agent-orchestration 项目根目录执行。
> 无前置依赖，可与阶段1-3并行执行。

## 必读文件
1. CLAUDE.md — 项目规范
2. `docs/dev-prompts/v2/workflow-node-redesign.md` — §3.4 agent 节点配置增强
3. `frontend/src/types/workflow.ts` — 找到现有的 AgentNodeData 类型
4. `frontend/src/components/workflow/NodeConfigPanel.tsx` — 找到 agent 配置部分
5. `frontend/src/components/workflow/nodes/AgentNode.tsx` — agent 节点组件
6. `backend/app/services/workflow_engine/nodes/agent.py` — 理解现有 agent 节点的 data 字段

## 任务目标
增强 agent 节点的配置面板，支持高级设置（不改动后端执行逻辑，只改前端配置UI）。

### 改造内容

#### 1. 配置面板增加"高级设置"折叠区
在 NodeConfigPanel.tsx 的 agent 配置部分，现有字段（model, prompt, maxTokens等）下方，添加一个 `Collapse` 折叠面板"高级设置"。

高级设置内容：
- **超时时间 (timeout)**: InputNumber，单位秒，默认180，范围30-3600
- **最大重试次数 (maxRetries)**: InputNumber，默认1，范围0-5
- **失败策略 (onError)**: Select
  - `stop` — 停止工作流（默认）
  - `skip` — 跳过此节点，继续下游
  - `retry` — 重试（使用 maxRetries 次数）
  - `fallback` — 使用回退值
- **回退值 (fallbackValue)**: TextArea（仅 onError=fallback 时显示）
- **输出过滤 (outputFilter)**: TextArea，JSON 格式，指定只输出哪些字段
  - 示例：`["result", "summary"]` 只输出这两个字段
- **启用缓存 (enableCache)**: Switch，默认 false
- **缓存 TTL**: InputNumber，单位秒，默认3600（仅 enableCache=true 时显示）

#### 2. AgentNode 组件视觉增强
在 AgentNode.tsx 的节点卡片上：
- 如果设置了 onError ≠ stop，在节点右下角显示一个小标签（如 "SKIP" / "RETRY"）
- 如果 enableCache=true，显示一个缓存图标

#### 3. 类型定义
更新 `AgentNodeData`（在 workflow.ts 中），添加高级设置字段：
```typescript
export interface AgentNodeData extends BaseNodeData {
    // ... 现有字段保持不变 ...
    // 新增高级设置
    timeout?: number;
    maxRetries?: number;
    onError?: 'stop' | 'skip' | 'retry' | 'fallback';
    fallbackValue?: string;
    outputFilter?: string[];
    enableCache?: boolean;
    cacheTTL?: number;
}
```

### 注意
这些高级设置目前**只做前端配置存储**，后端 agent.py 的 execute() 暂不读取这些字段（后续迭代实现）。配置会保存在工作流定义的 node data 中，下次打开编辑器时能正确回显。

## 完成标准
- [ ] AgentNodeData 类型更新完成
- [ ] 配置面板高级设置折叠区实现
- [ ] onError 联动控制（fallback → 显示回退值输入框）
- [ ] enableCache 联动控制（true → 显示 TTL 输入）
- [ ] AgentNode 组件显示策略标签
- [ ] 保存工作流后重新打开，高级设置正确回显
- [ ] 前端 TypeScript 无类型错误
- [ ] 不要 git commit

## 不要做的事
- 不要修改 backend/ 下任何文件
- 不要修改现有基础配置字段的行为
- 不要 git commit
