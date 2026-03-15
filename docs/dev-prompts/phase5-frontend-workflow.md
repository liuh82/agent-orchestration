# Phase 5 - 前端：React Flow 编辑器 + 执行监控

## 任务目标

完整重做工作流编辑器（可视化拖拽），实现"生成流程"和"保存为模板"功能，以及执行监控视图。

## 修改/新建文件清单

```
frontend/src/pages/workflows/WorkflowListPage.tsx      # 重构：流程实例+模板库
frontend/src/pages/workflows/WorkflowEditorPage.tsx     # 新建：React Flow 编辑器
frontend/src/pages/workflows/WorkflowMonitorPage.tsx    # 新建：执行监控
frontend/src/components/workflow/EditorToolbar.tsx       # 顶部工具栏
frontend/src/components/workflow/NodePanel.tsx           # 左侧节点面板
frontend/src/components/workflow/NodeConfigPanel.tsx     # 右侧节点配置面板
frontend/src/components/workflow/nodes/                  # 自定义节点组件
frontend/src/components/workflow/nodes/AgentNode.tsx
frontend/src/components/workflow/nodes/ConditionNode.tsx
frontend/src/components/workflow/nodes/HumanNode.tsx
frontend/src/components/workflow/nodes/ParallelNode.tsx
frontend/src/components/workflow/nodes/TransformNode.tsx
frontend/src/components/workflow/nodes/NotificationNode.tsx
frontend/src/components/workflow/nodes/TimerNode.tsx
frontend/src/components/workflow/WorkflowMonitor.tsx
frontend/src/components/workflow/TemplateLibrary.tsx
frontend/src/stores/useWorkflowStore.ts
frontend/src/api/workflows.ts
frontend/src/utils/websocket.ts
```

## 依赖

```bash
npm install @xyflow/react @xyflow/react-controls
# 如需 dagre 布局：
npm install dagre @types/dagre
```

## WorkflowListPage（流程列表页）

两个 Tab：
1. **我的流程** — 已生成的流程实例列表（状态badge + 名称 + 创建时间 + 操作）
2. **模板库** — 模板列表（名称 + 描述 + 类别 + 操作）

顶部按钮：
- 「新建流程」→ 跳转 `/workflows/new`
- 「从模板创建」→ 选择模板 → 加载到编辑器

## WorkflowEditorPage（可视化编辑器）

### 布局

```
┌─────────────────────────────────────────────────────────────┐
│ ← 返回  |  工作流名称: [编辑]  |  [生成流程] [保存为模板]    │  ← EditorToolbar
├──────────┬──────────────────────────────────┬───────────────┤
│ 节点面板  │                                  │  节点配置面板   │
│          │        React Flow 画布            │  (选中时显示)  │
│ ○ Agent  │                                  │               │
│ ○ 条件   │     [节点] ──→ [节点]            │  名称: ...     │
│ ○ 人工   │                    ↓             │  类型: ...     │
│ ○ 并行   │                [节点]             │  配置: ...     │
│ ○ 转换   │                                  │               │
│ ○ 通知   │                                  │  [取消] [保存]  │
│ ○ 定时   │                                  │               │
├──────────┴──────────────────────────────────┴───────────────┤
│  画布缩放控制 | 小地图                                       │
└─────────────────────────────────────────────────────────────┘
```

### NodePanel（左侧节点面板）

从 API `GET /api/v1/workflow/node-types` 获取节点类型列表，展示：
- 节点图标 + 名称
- 拖拽到画布创建新节点

### 节点组件（自定义 React Flow 节点）

每种节点类型一个组件，继承 `Handle` + 自定义样式：

**Agent 节点：** 显示 Agent 名称 + 模型 + 状态指示灯
**Condition 节点：** 菱形或带分支标记的矩形，显示条件表达式
**Human 节点：** 橙色边框，显示"人工审批"标记
**Parallel 节点：** 显示分支数量
**Transform 节点：** 显示转换描述
**Notification 节点：** 显示通知通道图标
**Timer 节点：** 显示 cron 表达式

### NodeConfigPanel（右侧配置面板）

- 点击节点时显示，配置内容根据节点类型的 config_schema 动态渲染
- 使用 Ant Design Form（不用 @rjsf，保持简单）
- 保存后更新节点 config 数据
- Agent 类型节点：下拉选择 Agent + 输入 Prompt + 设置超时

### EditorToolbar（顶部工具栏）

```
[生成流程] — POST /api/v1/workflows/{id}/execute
  - 弹出 Modal：输入执行实例名称
  - 提交后跳转到执行监控页

[保存为模板] — POST /api/v1/workflows/save-as-template
  - 弹出 Modal：输入模板名称 + 描述 + 类别
  - 提交后成功提示
```

### 画布交互

- 拖拽节点面板的节点到画布创建新节点
- 节点间拖拽连线（从 Handle 到 Handle）
- 点击节点打开右侧配置面板
- 画布支持缩放（Ctrl+滚轮）、平移（拖拽空白区域）
- 撤销/重做（Ctrl+Z / Ctrl+Shift+Z），使用 zustand 保存历史栈

### 数据持久化

编辑过程中实时保存到 zustand store，离开页面前提示保存：
- 保存工作流定义：`PUT /api/v1/workflows/{id}`

## WorkflowMonitorPage（执行监控）

### 布局

```
┌──────────────────────────────────────────────────┐
│ ← 返回  |  流程: xxx  [运行中]  | [暂停] [取消]  │
├──────────────────────────────────────────────────┤
│                                                  │
│        React Flow 画布（只读 + 状态着色）          │
│                                                  │
│     [✅完成] ──→ [🟢运行中] ──→ [⏳等待]          │
│                                                  │
│     节点状态颜色：                                  │
│     等待=灰色, 运行=蓝色, 完成=绿色,              │
│     失败=红色, 暂停=橙色, 跳过=虚线               │
│                                                  │
├──────────────────────────────────────────────────┤
│  实时日志面板（底部可折叠）                         │
│  > [10:00:01] Agent节点开始执行...                │
│  > [10:00:05] 条件分支: exit_code == 0 → true    │
│  > [10:00:06] 人工干预节点等待审批...              │
└──────────────────────────────────────────────────┘
```

### WebSocket 连接

```typescript
// src/utils/websocket.ts
class WorkflowWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;

  connect(executionId: string, onMessage: (data: any) => void) {
    this.ws = new WebSocket(`ws://${location.host}/api/v1/ws/workflow/${executionId}`);
    this.ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    this.ws.onclose = () => this.reconnect(executionId, onMessage);
  }

  private reconnect(id: string, handler: (data: any) => void) {
    // 指数退避重连，最多5次
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
```

### 事件处理

```typescript
// 收到 WebSocket 事件后更新节点状态
switch (event.type) {
  case 'node.status_changed':
    // 更新对应节点的状态颜色
    break;
  case 'node.output':
    // 更新节点详情面板中的输出数据
    break;
  case 'node.log':
    // 追加到底部日志面板
    break;
  case 'human_intervention.required':
    // 高亮人工干预节点，弹出审批面板
    break;
  case 'execution.status_changed':
    // 更新顶部状态badge
    break;
}
```

## 约束

- 升级 react-flow-renderer → @xyflow/react
- 浅色主题，画布背景 #fafafa
- 节点最小尺寸 180x80
- 连线支持带箭头和标签（条件分支的 true/false 标签）
- 编辑器中画布数据实时保存到 store，不自动保存到后端

## 验收标准

- [ ] 从节点面板拖拽节点到画布成功
- [ ] 节点间可连线，连线带箭头
- [ ] 点击节点打开配置面板，配置保存后更新节点显示
- [ ] 7 种节点类型正确展示不同样式
- [ ] "生成流程"创建执行实例并跳转监控页
- [ ] "保存为模板"保存成功
- [ ] 监控页面节点状态实时更新（WebSocket）
- [ ] 日志面板实时显示
- [ ] 暂停/恢复/取消执行正常
- [ ] 模板库可加载模板到编辑器
