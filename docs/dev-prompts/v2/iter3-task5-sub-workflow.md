# Nexus 工作流改造 — 阶段5: Sub Workflow 配置改造

> 请在 agent-orchestration 项目根目录执行。
> 前置条件：阶段3（context/result_output）已完成

## 必读文件
1. CLAUDE.md — 项目规范
2. `docs/dev-prompts/v2/workflow-node-redesign.md` — §3.7 sub_workflow 配置增强
3. `frontend/src/types/workflow.ts` — 找到 SubWorkflowNodeData
4. `frontend/src/components/workflow/NodeConfigPanel.tsx` — 找到 sub_workflow 配置部分
5. `frontend/src/components/workflow/nodes/SubWorkflowNode.tsx` — sub_workflow 节点组件

## 任务目标
增强 sub_workflow 节点的配置面板，支持子工作流选择和参数映射。

### 改造内容

#### 1. 配置面板改造
将 sub_workflow 配置从简单的文本输入改为结构化表单：

- **子工作流**：Select 组件，从 API 拉取可用工作流列表（`GET /api/workflows`）
- **参数映射**：动态列表（可增删行）
  - 每行：`上游字段名` → `子工作流输入参数名`
  - 上游字段从 upstream 节点的 output 自动推断（显示下拉）
  - 子工作流输入参数在选定子工作流后从其 input 节点配置中获取
- **输出映射**：动态列表（可增删行）
  - 每行：`子工作流输出字段名` → `当前工作流变量名`
- **执行模式**: Radio
  - `sync` — 同步等待完成
  - `async` — 异步触发后继续
- **失败策略**: Select（同阶段4 agent 的 onError）

#### 2. 类型定义
```typescript
export interface SubWorkflowNodeData extends BaseNodeData {
    workflowId?: string;         // 选中的子工作流ID
    paramMappings: Array<{
        sourceField: string;     // 上游字段
        targetParam: string;     // 子工作流参数
    }>;
    outputMappings: Array<{
        sourceField: string;     // 子工作流输出
        targetVar: string;       // 当前工作流变量
    }>;
    executionMode: 'sync' | 'async';
    onError: 'stop' | 'skip' | 'retry';
}
```

#### 3. API 调用
在配置面板加载时调用 `GET /api/workflows` 获取工作流列表。
如果 API 不可用（如离线开发），显示一个手动输入 workflow ID 的 fallback。

## 完成标准
- [ ] SubWorkflowNodeData 类型更新
- [ ] 配置面板结构化表单实现
- [ ] 工作流列表下拉可正常加载
- [ ] 参数映射动态列表可增删
- [ ] 保存后重新打开配置正确回显
- [ ] 前端 TypeScript 无类型错误
- [ ] 不要 git commit

## 不要做的事
- 不要修改 backend/ 下任何文件
- 不要修改现有 sub_workflow 的后端执行逻辑
- 不要 git commit
