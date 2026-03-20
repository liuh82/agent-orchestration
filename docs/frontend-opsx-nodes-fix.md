# Nexus 前端 OPSX 节点补全方案

## 问题描述

后端迭代六新增了 4 个 OPSX 约束驱动节点（`spec`、`plan`、`review`、`verify`），但前端未同步更新，导致：
1. 打开包含这些节点的工作流时，`NODE_META[type]` 返回 `undefined`
2. `meta.handles.inputs.length` 抛出 `TypeError: Cannot read properties of undefined (reading 'length')`
3. 工作流编辑器页面完全崩溃

同时发现前端也缺少 `notification` 和 `human` 节点的渲染组件（只有 NODE_META 定义，没有对应组件注册）。

## 修改范围

共 6 个节点：`spec`、`plan`、`review`、`verify`（新增）+ `notification`、`human`（补组件）

## 涉及文件

| 文件 | 修改内容 |
|------|---------|
| `frontend/src/types/workflow.ts` | WorkflowNodeType 联合类型、NodeCategory、NODE_META、NODE_CATEGORIES |
| `frontend/src/pages/workflows/WorkflowEditorPage.tsx` | nodeTypes 注册表 |
| `frontend/src/components/workflow/NodeConfigPanel.tsx` | NODE_ICON_MAP + renderTypeSpecificForm() |
| `frontend/src/components/workflow/NodePanel.tsx` | ICON_MAP |
| `frontend/src/components/workflow/nodes/index.ts` | 导出新组件 |
| `frontend/src/components/workflow/nodes/SpecNode.tsx` | 新建 |
| `frontend/src/components/workflow/nodes/PlanNode.tsx` | 新建 |
| `frontend/src/components/workflow/nodes/ReviewNode.tsx` | 新建 |
| `frontend/src/components/workflow/nodes/VerifyNode.tsx` | 新建 |
| `frontend/src/components/workflow/nodes/NotificationNode.tsx` | 新建 |
| `frontend/src/components/workflow/nodes/HumanNode.tsx` | 新建 |
| `frontend/src/components/workflow/nodes/BaseNode.tsx` | 防御性检查（meta?.handles?.inputs?.length） |

## 详细修改

### 1. BaseNode.tsx — 防御性检查（防止未来同类崩溃）

```tsx
// 之前（崩溃）
const hasInput = (meta?.handles.inputs.length ?? 0) > 0;
const staticOutputs = meta?.handles.outputs ?? [];

// 之后（安全）
const inputs = meta?.handles?.inputs ?? [];
const staticOutputs = meta?.handles?.outputs ?? [];
const hasInput = inputs.length > 0;
```

同时更新 Handle 的 id 引用：
```tsx
// 之前
id={meta!.handles.inputs[0].id}
// 之后
id={inputs[0]?.id ?? 'source'}
```

### 2. types/workflow.ts — 类型定义

#### 2a. NodeCategory 增加 'quality'
```ts
export type NodeCategory = 'trigger' | 'agent' | 'logic' | 'workflow' | 'data' | 'output' | 'quality';
```

#### 2b. WorkflowNodeType 增加 4 种
```ts
export type WorkflowNodeType =
  | 'manual_trigger'
  | 'cron_trigger'
  | 'webhook_trigger'
  | 'input'
  | 'agent'
  | 'if'
  | 'switch'
  | 'loop'
  | 'wait'
  | 'fork'
  | 'join'
  | 'sub_workflow'
  | 'http_request'
  | 'code'
  | 'transform'
  | 'output'
  | 'context_output'
  | 'result_output'
  | 'notification'
  | 'human'
  | 'spec'    // 新增：约束分析
  | 'plan'    // 新增：零决策计划
  | 'review'  // 新增：交叉验证
  | 'verify'; // 新增：约束验证
```

#### 2c. NODE_META 增加 4 种（参考后端 CONFIG_SCHEMA）

```ts
spec: {
  type: 'spec',
  label: '约束分析',
  category: 'quality',
  color: '#8b5cf6',   // 紫色系，与 workflow 同色系但有区分
  icon: 'SearchOutlined',
  defaultData: (): SpecNodeData => ({
    label: '约束分析',
    requirement: '',
    scope: 'full',
    parallel_models: false,
    max_constraints: 20,
    model: '',
  }),
  handles: {
    inputs: [{ id: 'source', type: 'target' }],
    outputs: [{ id: 'target', type: 'source' }],
  },
},

plan: {
  type: 'plan',
  label: '零决策计划',
  category: 'quality',
  color: '#8b5cf6',
  icon: 'FileTextOutlined',
  defaultData: (): PlanNodeData => ({
    label: '零决策计划',
    analysis_depth: 'normal',
    include_tests: true,
    target_framework: '',
    model: '',
  }),
  handles: {
    inputs: [{ id: 'source', type: 'target' }],
    outputs: [{ id: 'target', type: 'source' }],
  },
},

review: {
  type: 'review',
  label: '交叉验证',
  category: 'quality',
  color: '#8b5cf6',
  icon: 'SafetyCertificateOutlined',
  defaultData: (): ReviewNodeData => ({
    label: '交叉验证',
    review_dimensions: ['spec_compliance', 'logic_correctness', 'security', 'maintainability'],
    fail_on_critical: true,
    reviewer_a_model: '',
    reviewer_b_model: '',
  }),
  handles: {
    inputs: [{ id: 'source', type: 'target' }],
    outputs: [{ id: 'target', type: 'source' }],
  },
},

verify: {
  type: 'verify',
  label: '约束验证',
  category: 'quality',
  color: '#8b5cf6',
  icon: 'CheckCircleOutlined',
  defaultData: (): VerifyNodeData => ({
    label: '约束验证',
    auto_fix: false,
    generate_pbt: false,
    verification_methods: { code_review: true, test_execution: true, static_analysis: false },
    model: '',
  }),
  handles: {
    inputs: [{ id: 'source', type: 'target' }],
    outputs: [{ id: 'target', type: 'source' }],
  },
},
```

#### 2d. NODE_CATEGORIES 增加 quality 分类

```ts
{
  key: 'quality',
  label: '质量保证',
  color: '#8b5cf6',
  nodeTypes: ['spec', 'plan', 'review', 'verify'],
},
```

### 3. NodeData 类型定义

在 types/workflow.ts 中添加（在现有 NodeData union 之后）：

```ts
/* OPSX Node Data Types */
export interface SpecNodeData extends BaseNodeData {
  label: string;
  requirement: string;
  scope: 'full' | 'backend' | 'frontend' | 'infrastructure';
  parallel_models: boolean;
  max_constraints: number;
  model: string;
}

export interface PlanNodeData extends BaseNodeData {
  label: string;
  analysis_depth: 'quick' | 'normal' | 'deep';
  include_tests: boolean;
  target_framework: string;
  model: string;
}

export interface ReviewNodeData extends BaseNodeData {
  label: string;
  review_dimensions: string[];
  fail_on_critical: boolean;
  reviewer_a_model: string;
  reviewer_b_model: string;
}

export interface VerifyNodeData extends BaseNodeData {
  label: string;
  auto_fix: boolean;
  generate_pbt: boolean;
  verification_methods: { code_review: boolean; test_execution: boolean; static_analysis: boolean };
  model: string;
}

export interface NotificationNodeData extends BaseNodeData {
  label: string;
  channels: string[];
  template: string;
}
```

注意：HumanNodeData 可能已定义（检查 HumanForm 是否引用），如果没有需要补充。NotificationNodeData 同理。

### 4. WorkflowEditorPage.tsx — 注册 6 个节点组件

```ts
const nodeTypes: Record<string, any> = {
  // ... 现有节点 ...
  notification: NotificationNode,  // 新增
  human: HumanNode,                // 新增
  spec: SpecNode,                  // 新增
  plan: PlanNode,                  // 新增
  review: ReviewNode,              // 新增
  verify: VerifyNode,              // 新增
};
```

### 5. NodeConfigPanel.tsx

#### 5a. NODE_ICON_MAP 增加 6 个
```ts
spec: <SearchOutlined />,
plan: <FileTextOutlined />,
review: <SafetyCertificateOutlined />,
verify: <CheckCircleOutlined />,
notification: <BellOutlined />,
human: <UserOutlined />,
```

需要新增 import：`import { SearchOutlined, SafetyCertificateOutlined } from '@ant-design/icons';`

#### 5b. renderTypeSpecificForm() 增加 6 个 case

新增的 4 个 OPSX 节点需要配置表单。参考现有 IfNode/AgentNode 的表单模式：

```tsx
case 'spec':
  return (
    <Form layout="vertical" size="small">
      <Form.Item label="需求描述">
        <Input.TextArea
          rows={4}
          value={(nodeData as any).requirement ?? ''}
          onChange={(e) => updateNodeData(selectedNode.id, { requirement: e.target.value } as any)}
          placeholder="输入需要分析的需求描述，支持 {{ 变量 }} 语法"
        />
      </Form.Item>
      <Form.Item label="分析范围">
        <Select
          value={(nodeData as any).scope ?? 'full'}
          onChange={(val) => updateNodeData(selectedNode.id, { scope: val } as any)}
          options={[
            { value: 'full', label: '完整分析' },
            { value: 'backend', label: '仅后端' },
            { value: 'frontend', label: '仅前端' },
            { value: 'infrastructure', label: '仅基础设施' },
          ]}
        />
      </Form.Item>
      <Form.Item label="最大约束数">
        <InputNumber
          min={1} max={50}
          value={(nodeData as any).max_constraints ?? 20}
          onChange={(val) => updateNodeData(selectedNode.id, { max_constraints: val ?? 20 } as any)}
        />
      </Form.Item>
      <Form.Item label="多模型并行">
        <Switch
          checked={(nodeData as any).parallel_models ?? false}
          onChange={(val) => updateNodeData(selectedNode.id, { parallel_models: val } as any)}
        />
      </Form.Item>
    </Form>
  );
```

plan、review、verify 的表单类似，根据各自 CONFIG_SCHEMA 的字段生成。

notification 和 human 的表单参考 NodeConfigPanel 中已有的 NotificationForm / HumanForm 组件（它们已经存在，只是没有被 renderTypeSpecificForm 调用，因为缺少对应的 case）。但需要确认这些 Form 组件是否存在——如果不存在需要新建。

### 6. 节点组件

4 个 OPSX 节点组件结构简单（参考现有的节点组件），都用 BaseNode 封装：

```tsx
// SpecNode.tsx
import { memo } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const SpecNode = memo(function SpecNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="spec"
      icon={<SearchOutlined />}
      description="需求 → 精确约束集"
    />
  );
});
```

plan / review / verify 同理。

NotificationNode 和 HumanNode：
- 如果已有 NotificationForm / HumanForm，说明之前有规划但没完成
- 需要创建对应的节点组件 + 配置表单
- notification: channels（飞书/钉钉/企微/邮件等）、template（消息模板）
- human: timeout（等待超时）、assignee（指定处理人）、reviewer_prompt（审核提示）

### 7. NodePanel.tsx — ICON_MAP

```ts
SearchOutlined: <SearchOutlined />,
SafetyCertificateOutlined: <SafetyCertificateOutlined />,
```

### 8. nodes/index.ts — 导出新组件

```ts
export { SpecNode } from './SpecNode';
export { PlanNode } from './PlanNode';
export { ReviewNode } from './ReviewNode';
export { VerifyNode } from './VerifyNode';
export { NotificationNode } from './NotificationNode';
export { HumanNode } from './HumanNode';
```

## 验收标准

1. 打开工作流编辑器不崩溃（即使包含 OPSX 节点）
2. 左侧面板「质量保证」分类显示 4 个 OPSX 节点
3. 拖拽 OPSX 节点到画布正常渲染
4. 选中 OPSX 节点，右侧配置面板显示对应表单
5. notification 和 human 节点同样正常渲染和配置
6. 保存工作流 → 重新打开 → 节点数据完整保留
7. `npm run build` 无 TypeScript 错误
8. BaseNode.tsx 防御性检查确保未知节点类型不再导致崩溃
