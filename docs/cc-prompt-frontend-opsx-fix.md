## Task: Fix Frontend OPSX Node Registration Crash

The backend has 6 node types that the frontend does not support, causing a crash when opening workflows containing these nodes:

**New OPSX nodes (completely missing):** `spec`, `plan`, `review`, `verify`
**Existing nodes missing component registration:** `notification`, `human`

The crash happens because `NODE_META[type]` returns `undefined` for these types, and then `meta.handles.inputs.length` throws `TypeError: Cannot read properties of undefined (reading 'length')`.

### Files to Modify

All paths relative to project root: `/Users/lh8/projects/agent-orchestration`

1. **`frontend/src/components/workflow/nodes/BaseNode.tsx`** — Add defensive null checks
2. **`frontend/src/types/workflow.ts`** — Add types, NODE_META, NODE_CATEGORIES
3. **`frontend/src/pages/workflows/WorkflowEditorPage.tsx`** — Register 6 node components
4. **`frontend/src/components/workflow/NodeConfigPanel.tsx`** — ICON_MAP + form rendering for 6 types
5. **`frontend/src/components/workflow/NodePanel.tsx`** — ICON_MAP entries
6. **`frontend/src/components/workflow/nodes/index.ts`** — Export new components
7. **`frontend/src/components/workflow/nodes/SpecNode.tsx`** — New
8. **`frontend/src/components/workflow/nodes/PlanNode.tsx`** — New
9. **`frontend/src/components/workflow/nodes/ReviewNode.tsx`** — New
10. **`frontend/src/components/workflow/nodes/VerifyNode.tsx`** — New
11. **`frontend/src/components/workflow/nodes/NotificationNode.tsx`** — New
12. **`frontend/src/components/workflow/nodes/HumanNode.tsx`** — New

### Detailed Instructions

#### Step 1: Fix BaseNode.tsx (defensive check)

In `BaseNode.tsx`, the current code crashes when `meta.handles` is undefined:

```tsx
// CURRENT (crashes):
const hasInput = (meta?.handles.inputs.length ?? 0) > 0;
const staticOutputs = meta?.handles.outputs ?? [];
// ... later:
id={meta!.handles.inputs[0].id}

// FIX:
const inputs = meta?.handles?.inputs ?? [];
const staticOutputs = meta?.handles?.outputs ?? [];
const hasInput = inputs.length > 0;
// ... later:
id={inputs[0]?.id ?? 'source'}
```

#### Step 2: Update types/workflow.ts

**2a.** Add `'quality'` to `NodeCategory` type:
```ts
export type NodeCategory = 'trigger' | 'agent' | 'logic' | 'workflow' | 'data' | 'output' | 'quality';
```

**2b.** Add 4 types to `WorkflowNodeType` union:
```ts
  | 'spec'    // OPSX: requirement → constraint set
  | 'plan'    // OPSX: constraints → zero-decision execution plan
  | 'review'  // OPSX: dual-model cross-review
  | 'verify'  // OPSX: automated constraint verification
```

**2c.** Add NodeData interfaces (find where other NodeData interfaces are defined, add near them):

```ts
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
```

**NOTE:** Before adding, check if `NotificationNodeData` and `HumanNodeData` already exist. If they do, don't duplicate. If they don't, add:
```ts
export interface NotificationNodeData extends BaseNodeData {
  label: string;
  channels: string[];
  template: string;
}

export interface HumanNodeData extends BaseNodeData {
  label: string;
  timeout: number;
  assignee: string;
}
```

**2d.** Add to `NODE_META` (after the existing entries, before the closing `};`):

```ts
  spec: {
    type: 'spec',
    label: '约束分析',
    category: 'quality',
    color: '#8b5cf6',
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

**2e.** Add to `NODE_CATEGORIES` array (before the closing `];`):

```ts
  {
    key: 'quality',
    label: '质量保证',
    color: '#8b5cf6',
    nodeTypes: ['spec', 'plan', 'review', 'verify'],
  },
```

#### Step 3: Create 6 node components

Create these files in `frontend/src/components/workflow/nodes/`:

**SpecNode.tsx:**
```tsx
import { memo } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const SpecNode = memo(function SpecNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="spec"
      icon={<SearchOutlined />}
      description="需求 → 约束集"
    />
  );
});
```

**PlanNode.tsx:**
```tsx
import { memo } from 'react';
import { FileTextOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const PlanNode = memo(function PlanNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="plan"
      icon={<FileTextOutlined />}
      description="约束 → 执行计划"
    />
  );
});
```

**ReviewNode.tsx:**
```tsx
import { memo } from 'react';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const ReviewNode = memo(function ReviewNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="review"
      icon={<SafetyCertificateOutlined />}
      description="双模型交叉审查"
    />
  );
});
```

**VerifyNode.tsx:**
```tsx
import { memo } from 'react';
import { CheckCircleOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const VerifyNode = memo(function VerifyNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="verify"
      icon={<CheckCircleOutlined />}
      description="自动化约束验证"
    />
  );
});
```

**NotificationNode.tsx:**
```tsx
import { memo } from 'react';
import { BellOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const NotificationNode = memo(function NotificationNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="notification"
      icon={<BellOutlined />}
      description="多渠道通知"
    />
  );
});
```

**HumanNode.tsx:**
```tsx
import { memo } from 'react';
import { UserOutlined } from '@ant-design/icons';
import { BaseNode } from './BaseNode';

export const HumanNode = memo(function HumanNode(props: any) {
  return (
    <BaseNode
      {...props}
      type="human"
      icon={<UserOutlined />}
      description="人工审核"
    />
  );
});
```

#### Step 4: Update nodes/index.ts

Add exports for the 6 new components at the end of the file.

#### Step 5: Update WorkflowEditorPage.tsx

Add to the `nodeTypes` record:
```ts
  notification: NotificationNode,
  human: HumanNode,
  spec: SpecNode,
  plan: PlanNode,
  review: ReviewNode,
  verify: VerifyNode,
```

Add corresponding imports at the top of the file.

#### Step 6: Update NodeConfigPanel.tsx

**6a.** Add to `NODE_ICON_MAP`:
```ts
spec: <SearchOutlined />,
plan: <FileTextOutlined />,
review: <SafetyCertificateOutlined />,
verify: <CheckCircleOutlined />,
notification: <BellOutlined />,
human: <UserOutlined />,
```

**IMPORTANT:** Check which icons are already imported. Add new imports for `SearchOutlined` and `SafetyCertificateOutlined` if not present.

**6b.** Add 6 cases to `renderTypeSpecificForm()`. For the 4 OPSX nodes:

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

case 'plan':
  return (
    <Form layout="vertical" size="small">
      <Form.Item label="分析深度">
        <Select
          value={(nodeData as any).analysis_depth ?? 'normal'}
          onChange={(val) => updateNodeData(selectedNode.id, { analysis_depth: val } as any)}
          options={[
            { value: 'quick', label: '快速' },
            { value: 'normal', label: '标准' },
            { value: 'deep', label: '深入' },
          ]}
        />
      </Form.Item>
      <Form.Item label="包含测试步骤">
        <Switch
          checked={(nodeData as any).include_tests ?? true}
          onChange={(val) => updateNodeData(selectedNode.id, { include_tests: val } as any)}
        />
      </Form.Item>
      <Form.Item label="目标技术栈">
        <Input
          value={(nodeData as any).target_framework ?? ''}
          onChange={(e) => updateNodeData(selectedNode.id, { target_framework: e.target.value } as any)}
          placeholder="如 fastapi / react / django"
        />
      </Form.Item>
    </Form>
  );

case 'review':
  return (
    <Form layout="vertical" size="small">
      <Form.Item label="严重问题时失败">
        <Switch
          checked={(nodeData as any).fail_on_critical ?? true}
          onChange={(val) => updateNodeData(selectedNode.id, { fail_on_critical: val } as any)}
        />
      </Form.Item>
      <Form.Item label="审查者 A 模型">
        <Input
          value={(nodeData as any).reviewer_a_model ?? ''}
          onChange={(e) => updateNodeData(selectedNode.id, { reviewer_a_model: e.target.value } as any)}
          placeholder="留空使用默认模型"
        />
      </Form.Item>
      <Form.Item label="审查者 B 模型">
        <Input
          value={(nodeData as any).reviewer_b_model ?? ''}
          onChange={(e) => updateNodeData(selectedNode.id, { reviewer_b_model: e.target.value } as any)}
          placeholder="留空使用默认模型（同 A）"
        />
      </Form.Item>
    </Form>
  );

case 'verify':
  return (
    <Form layout="vertical" size="small">
      <Form.Item label="自动修复">
        <Switch
          checked={(nodeData as any).auto_fix ?? false}
          onChange={(val) => updateNodeData(selectedNode.id, { auto_fix: val } as any)}
        />
      </Form.Item>
      <Form.Item label="生成属性测试 (PBT)">
        <Switch
          checked={(nodeData as any).generate_pbt ?? false}
          onChange={(val) => updateNodeData(selectedNode.id, { generate_pbt: val } as any)}
        />
      </Form.Item>
    </Form>
  );
```

For `notification` and `human`, check if `NotificationForm` / `HumanForm` components already exist in the file (search for them). If they do, just wire them:
```tsx
case 'notification':
  return (
    <NotificationForm
      data={getTypedData<NotificationNodeData>(nodeData)}
      onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
    />
  );
case 'human':
  return (
    <HumanForm
      data={getTypedData<HumanNodeData>(nodeData)}
      onUpdate={(partial) => updateNodeData(selectedNode.id, partial)}
    />
  );
```

If these Form components do NOT exist, create inline forms similar to the OPSX ones:
- notification: channels (Select, multiple), template (TextArea)
- human: timeout (InputNumber), assignee (Input)

#### Step 7: Update NodePanel.tsx ICON_MAP

Add missing icon entries:
```ts
SearchOutlined: <SearchOutlined />,
SafetyCertificateOutlined: <SafetyCertificateOutlined />,
```

Add imports if needed.

### Build & Verify

After all changes:
1. Run `npm run build` in `frontend/` — must pass with no TypeScript errors
2. Verify the build output includes the new node chunks

### Commit Message

```
fix: 补全 OPSX 4 节点 + notification/human 前端组件注册

- 新增 spec/plan/review/verify 四种质量保证节点的前端定义
- 新增 notification/human 节点渲染组件
- BaseNode.tsx 添加防御性 null 检查防止未知节点类型崩溃
- NodeConfigPanel 添加 6 种节点的配置表单
- NodeCategory 新增 'quality' 分类
- NODE_CATEGORIES 新增「质量保证」面板分组
```

### Important Constraints

- Do NOT modify any backend code
- Do NOT modify existing node behavior (only add new ones + defensive checks)
- All form labels must be in Chinese
- Follow the existing code patterns exactly (check how other nodes are implemented)
- `Switch` component comes from `antd`, check existing imports
