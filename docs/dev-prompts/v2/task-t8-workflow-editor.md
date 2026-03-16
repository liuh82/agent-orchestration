# Nexus 开发任务 T8：工作流编辑器重写（参照n8n）

## 必读文件（先读完再动手）
- CLAUDE.md
- **docs/workflow-schema.md**（⭐ 工作流定义 Schema — 与 T9 的共同契约，必须严格遵循）
- docs/architecture-v4.md（工作流引擎部分）
- frontend/src/types/workflow.ts（现有类型定义，需按 Schema 重写）
- frontend/src/stores/useWorkflowStore.ts（现有状态管理）
- frontend/src/pages/workflows/（现有工作流页面）
- frontend/src/components/workflow/（现有组件）
- frontend/src/api/workflows.ts（现有 API）

## 参考资源
- n8n 工作流编辑器：https://docs.n8n.io/workflows/
- React Flow 文档：https://reactflow.dev/

## 核心约束
- **严格遵守 docs/workflow-schema.md 定义的节点类型和配置结构**
- Schema 是 T8（编辑器）和 T9（引擎）的共同契约，不要自行发明字段
- React Flow ↔ Schema 的映射关系见 Schema 文档第 8 节
- 只改 `frontend/src/` 目录
- 不要 git commit

## 任务目标
完全重写工作流编辑器，参照 n8n 的交互和功能。

## 具体要求

### 8.1 节点面板（左侧拖拽区）

按 Schema 第 3.2 节的节点类型分类展示：

**触发器类**
- 手动触发（trigger_manual）
- 定时触发（trigger_cron）— 配置 cron 表达式 + 时区
- Webhook 触发（trigger_webhook）— 配置 method + path + auth

**核心节点**
- Agent（agent）— 选择 Agent、配置 prompt/model/temperature/max_tokens、标记 overridable_fields
- 条件分支（condition）— 配置 ConditionGroup（logic + rules）
- 多路分支（switch）— 配置多个 SwitchCase
- 循环（loop）— fixed/iterate 两种模式，break 条件
- 等待（wait）— duration/webhook 两种模式

**工作流**
- 子工作流（sub_workflow）— 选择工作流 + input_mapping

**数据节点**
- HTTP 请求（http_request）— URL/method/headers/body
- 代码执行（code）— python/javascript + 代码编辑器
- 数据转换（transform）— TransformRule 列表

**输出**
- 通知（notification）— 选择通道 + 消息模板
- 人工审批（human）— 审批说明 + 审批人
- 输出（output）— 输出名称 + 数据源

### 8.2 画布功能
- 拖拽连线（支持多端口：default/true/false/error/approved/rejected）
- 自动布局（dagre，按 Schema 的端口名渲染 Handle）
- 缩放和平移
- Mini map
- 撤销/重做（Ctrl+Z / Ctrl+Shift+Z）— useWorkflowStore 已实现
- 节点复制/粘贴
- 多选和批量删除
- 网格背景
- 节点执行状态着色（pending/running/completed/failed）

### 8.3 节点配置面板（右侧）
- 点击节点打开配置面板
- 根据 `WorkflowNode.type` 动态渲染对应配置表单
- 每种节点类型的 config 字段严格遵循 Schema 第 3.3 节
- 条件分支的 ConditionGroup 用可视化规则构建器（field + operator + value）
- 代码执行节点嵌入代码编辑器（monaco-editor 或简单 textarea）
- 支持变量引用提示（输入 `{{` 时弹出变量补全）
- 配置验证（必填项、格式校验）
- 保存配置后即时更新节点

### 8.4 多端口连线
- condition 节点：两个源 Handle（true / false）
- switch 节点：default Handle + 每个 case 的动态 Handle
- agent/http_request/code 节点：default Handle + error Handle
- human 节点：approved Handle + rejected Handle
- 其他节点：default Handle
- 连线标签显示端口名

### 8.5 工作流管理
- 保存工作流（名称 + 描述 + 版本）— 保存时转换为 Schema 格式存入 `definition` 字段
- 工作流列表页
- 工作流版本管理
- 导入/导出（JSON 格式，按 Schema 第 7.3 节）

### 8.6 类型定义
- 重写 `frontend/src/types/workflow.ts`
- 严格按照 Schema 定义所有 TypeScript 类型
- 节点类型从 7 种扩展到 Schema 定义的 15 种
- 每种节点的 config 类型严格对应 Schema 第 3.3 节

## 完成标准
- [ ] 所有 15 种节点类型可拖拽到画布
- [ ] 每种节点可配置（右侧面板按 Schema 渲染）
- [ ] 多端口连线正常工作（true/false/error 等）
- [ ] 工作流可保存为 Schema 格式（后端可直接消费）
- [ ] 工作流可从 Schema 格式加载（后端存储的 definition 能正确渲染）
- [ ] 撤销/重做正常
- [ ] 前端 console 无 error
- [ ] 无 TypeScript 类型错误（npx tsc --noEmit 零错误）

## 不要做的事
- 不要引入非必要的依赖（React Flow 已有，dagre 已有）
- 不要修改后端代码（T9 负责）
- 不要自行发明不在 Schema 中的节点类型或 config 字段
- 不要 git commit
