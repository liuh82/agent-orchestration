# Nexus 开发任务 T8：工作流编辑器重写（参照n8n）

## 必读文件（先读完再动手）
- CLAUDE.md
- **docs/dev-prompts/v2/workflow-schema-v1.md**（⚠️ 与 T9 共用 Schema，严格遵循）
- docs/architecture-v4.md（工作流编辑器部分）
- frontend/src/pages/workflows/ 目录（现有工作流页面，**理解但重写**）
- frontend/src/components/workflow/ 目录（现有组件，**理解但重写**）
- frontend/src/types/workflow.ts（现有类型定义，**按 Schema v1 更新**）
- frontend/src/stores/useWorkflowStore.ts（现有 store，**理解但重写**）

## 参考资源
- n8n 工作流编辑器：https://docs.n8n.io/workflows/
- React Flow 文档：https://reactflow.dev/

## 核心约束
- **数据格式必须严格遵循 workflow-schema-v1.md**
- T9（后端引擎）按同一 Schema 开发，两边独立开发后需无缝集成
- 不要引入非必要的依赖（React Flow 已有）
- 不要修改后端代码（T9 负责）
- 不要 git commit

---

## 任务目标
完全重写工作流编辑器，参照 n8n 的交互体验。

## 实现步骤

### 第一步：类型定义（按 Schema v1）

更新 `frontend/src/types/workflow.ts`，严格对齐 `workflow-schema-v1.md` 中的类型：

- `WorkflowNodeType` 枚举：`manual_trigger | cron_trigger | webhook_trigger | agent | if | switch | loop | wait | sub_workflow | http_request | code | transform | output`
- `WorkflowNode` 接口：包含 `id`, `type`, `position`, `data`, `disabled`
- 每种节点的 `data` 类型（如 `AgentNodeData`, `IfNodeData`, `SwitchNodeData` 等）
- `WorkflowEdge` 接口：包含 `id`, `source`, `target`, `sourceHandle`, `targetHandle`, `label`
- `WorkflowConfig` 接口
- `WorkflowDefinition` 顶层接口（version/name/description/nodes/edges/variables/config）

### 第二步：Zustand Store 重写

更新 `frontend/src/stores/useWorkflowStore.ts`：

- 撤销/重做（Ctrl+Z / Ctrl+Shift+Z）— 保留现有实现，确认正常
- `saveDefinition()` 方法：将 store 中的 nodes + edges + config 打包成 Schema v1 格式的 JSON
- `loadDefinition(json)` 方法：解析 Schema v1 JSON 还原到 store
- 节点 CRUD：addNode / removeNode / updateNodeData / duplicateNode
- 连线 CRUD：addEdge / removeEdge
- 多选批量操作：selectMultiple / deleteSelected

### 第三步：节点面板（左侧拖拽区）

分类展示所有节点类型：

**触发器**
- 手动触发 `manual_trigger`
- 定时触发 `cron_trigger` — 配置 cron 表达式
- Webhook 触发 `webhook_trigger` — 配置 HTTP method 和 path

**Agent**
- Agent 执行 `agent` — 选择 Agent、配置 prompt/model/temperature/maxTokens/timeout

**逻辑控制**
- IF 条件 `if` — 配置条件（field/operator/value）和逻辑（and/or），2 个输出端口
- Switch 多路 `switch` — 配置 field 和多个 cases，N 个输出端口
- 循环 `loop` — count 或 iterate 模式，2 个输出端口（body/done）
- 等待 `wait` — duration 或 webhook 模式

**工作流**
- 子工作流 `sub_workflow` — 选择目标工作流、参数映射

**数据**
- HTTP 请求 `http_request` — URL/method/headers/body
- 代码执行 `code` — python/javascript + 代码
- 数据转换 `transform` — 变量映射

**输出**
- 输出 `output` — 格式选择

每种节点有**图标、颜色、中文标签**。支持拖拽到画布。

### 第四步：画布功能

基于 React Flow 实现：
- 拖拽连线（sourceHandle/targetHandle 命名遵循 Schema v1 §4）
- 网格背景（dots 类型）
- 缩放和平移
- Mini Map
- 节点复制（Ctrl+D）/ 粘贴 / 批量删除
- 自动布局（dagre，保留现有 `layoutGraph` 逻辑）
- 节点禁用态视觉区分（灰色 + 虚线边框）

### 第五步：节点组件

每种节点类型一个 React 组件（参考 `@xyflow/react` 自定义节点）：

- 通用样式：深色卡片 + 类型图标 + 节点名称 + 状态指示灯
- Agent 节点：显示 Agent 名称和模型
- IF 节点：2 个输出 handle，标注"是/否"
- Switch 节点：N 个输出 handle + 1 个 default handle
- Loop 节点：2 个输出 handle，标注"循环体/完成"
- 触发器节点：无边框，用醒目颜色区分

### 第六步：节点配置面板（右侧）

点击节点打开右侧配置面板：
- 根据 `node.type` 动态渲染不同的表单
- 使用 Ant Design Form 组件
- 支持变量插入（点击输入框旁的 `{{ }}` 按钮弹出变量选择器）
- 配置验证（必填项、格式校验）
- 保存后即时更新画布上的节点显示
- Agent 节点：下拉选择已有 Agent 或手动配置
- IF/Switch 节点：动态添加/删除条件行
- Loop 节点：循环类型切换时显示对应配置
- 高级模式：JSON/YAML 编辑（切换）

### 第七步：工作流管理

- 保存工作流：`POST /api/v1/workflows`（body 为 Schema v1 JSON）
- 加载工作流：`GET /api/v1/workflows/:id` → 解析 definition
- 工作流列表页：卡片式展示
- 导入/导出：JSON 文件下载和上传
- 工作流测试运行按钮（调 `POST /api/v1/workflows/:id/execute`）

## UI 规范
- 整体深色主题（参考现有系统配色：侧边栏 #334155, 背景 #0f172a）
- 节点卡片背景 #1e293b，边框 #334155
- 选中节点边框高亮 #3b82f6
- 节点运行中状态：蓝色脉冲动画
- 节点成功：绿色指示灯
- 节点失败：红色指示灯

## 完成标准
- [ ] 所有 13 种节点类型可拖拽到画布
- [ ] 节点配置面板按类型动态渲染
- [ ] IF 节点有 true/false 两个输出端口
- [ ] Switch 节点有 case_0/case_1/.../default 多个输出端口
- [ ] Loop 节点有 body/done 两个输出端口
- [ ] 连线数据格式符合 Schema v1 §4
- [ ] 保存时输出 Schema v1 完整 JSON
- [ ] 加载时正确解析 Schema v1 JSON
- [ ] 撤销/重做正常
- [ ] 前端 console 无 error
- [ ] 无 TypeScript 类型错误

## 不要做的事
- 不要修改 `backend/` 目录下任何文件
- 不要 git commit
- 不要引入 React Flow 之外的画布库
- 不要做实时执行状态显示（后续迭代）
