# Nexus 工作流定义 Schema v1.0

> 本文档是 T8（工作流编辑器）和 T9（执行引擎）的**共同契约**。
> 前端编辑器产出的 JSON 必须符合此 Schema，后端引擎按此 Schema 解析执行。

---

## 1. 工作流定义 (WorkflowDefinition)

存储在 `workflows.definition` 字段（JSON 字符串）。

```typescript
interface WorkflowDefinition {
  version: string;          // 固定 "1.0"
  name: string;             // 工作流名称
  description: string;      // 描述
  variables: WorkflowVariable[];  // 全局变量定义
  nodes: WorkflowNode[];    // 节点列表
  edges: WorkflowEdge[];    // 连线列表
  config: WorkflowConfig;   // 工作流配置
}
```

---

## 2. 全局变量 (WorkflowVariable)

```typescript
interface WorkflowVariable {
  name: string;          // 变量名，如 "target_url"
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  default_value: unknown;  // 默认值
  description?: string;  // 变量说明
}
```

引用方式：`{{ variables.target_url }}`

---

## 3. 节点 (WorkflowNode)

### 3.1 基础结构

```typescript
interface WorkflowNode {
  id: string;                    // 唯一ID，如 "node_1"
  type: NodeType;                // 节点类型（见 3.2）
  label: string;                 // 显示名称
  position: { x: number; y: number };  // 画布位置（仅编辑器使用，引擎忽略）
  config: Record<string, unknown>;     // 节点配置（按类型不同而异）
  retry?: RetryConfig;           // 可选：重试配置
  error_strategy?: 'stop' | 'skip' | 'error_output';  // 可选：错误策略，默认 stop
  timeout?: number;              // 可选：超时秒数，默认 3600
}
```

### 3.2 节点类型 (NodeType)

| 类型 | type 值 | 说明 | 输出端口 |
|------|---------|------|----------|
| 触发器-手动 | `trigger_manual` | 手动触发启动 | default |
| 触发器-定时 | `trigger_cron` | Cron 定时触发 | default |
| 触发器-Webhook | `trigger_webhook` | HTTP Webhook 触发 | default |
| Agent | `agent` | 执行 AI Agent 任务 | default, error |
| 条件分支 | `condition` | IF/Else 分支 | true, false, default |
| 多路分支 | `switch` | Switch 多条件分支 | default + 动态 |
| 循环 | `loop` | 固定次数/列表遍历 | default |
| 等待 | `wait` | 等待时间/事件 | default |
| 子工作流 | `sub_workflow` | 调用另一个工作流 | default, error |
| HTTP 请求 | `http_request` | 发送 HTTP 请求 | default, error |
| 代码执行 | `code` | 执行 Python/JS 代码 | default, error |
| 数据转换 | `transform` | 数据映射/转换 | default |
| 通知 | `notification` | 发送通知 | default |
| 人工审批 | `human` | 等待人工审批 | approved, rejected |
| 输出 | `output` | 工作流输出 | default |

### 3.3 各类型 config 结构

#### trigger_manual
```typescript
{ /* 无额外配置 */ }
```

#### trigger_cron
```typescript
{
  cron_expression: string;  // "0 */5 * * *"
  timezone?: string;        // "Asia/Shanghai"，默认 UTC
}
```

#### trigger_webhook
```typescript
{
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;             // "/api/webhook/my-flow"
  auth_type?: 'none' | 'bearer' | 'basic';
  auth_token?: string;
}
```

#### agent
```typescript
{
  agent_id: string;           // Agent ID
  agent_name?: string;        // 显示名
  model?: string;             // 模型覆盖
  prompt?: string;            // Prompt 模板
  temperature?: number;       // 0-1
  max_tokens?: number;
  // 覆盖标记（T10 实例化时使用）
  overridable_fields?: string[];  // ["model", "prompt", "temperature"]
}
```

#### condition
```typescript
{
  conditions: ConditionGroup;
}
// 条件组示例：
{
  logic: 'and' | 'or';
  rules: ConditionRule[];
}
interface ConditionRule {
  field: string;       // 引用上游输出，如 "{{ node_1.output.status }}"
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains' | 'regex' | 'is_empty' | 'is_not_empty';
  value: unknown;      // 比较值
}
```

#### switch
```typescript
{
  cases: SwitchCase[];
  default_output?: string;  // 默认输出端口名
}
interface SwitchCase {
  output_name: string;       // 输出端口名
  condition: ConditionGroup; // 同 condition 的 conditions 结构
}
```

#### loop
```typescript
{
  loop_type: 'fixed' | 'iterate';
  // fixed 模式
  count?: number;            // 循环次数，默认 10
  // iterate 模式
  list_source?: string;      // 引用上游输出，如 "{{ node_1.output.items }}"
  item_var?: string;         // 当前项变量名，默认 "current_item"
  index_var?: string;        // 当前索引变量名，默认 "current_index"
  // 通用
  max_iterations?: number;   // 最大迭代次数，默认 100
  break_condition?: ConditionGroup;  // 可选：break 条件
}
```

#### wait
```typescript
{
  wait_type: 'duration' | 'webhook';
  // duration 模式
  seconds?: number;
  // webhook 模式（预留）
  webhook_path?: string;
}
```

#### sub_workflow
```typescript
{
  workflow_id: string;           // 子工作流 ID
  input_mapping: Record<string, string>;  // { "变量名": "{{ node_x.output.field }}" }
  timeout?: number;              // 子流程超时
  max_depth?: number;            // 嵌套深度限制，默认 5
}
```

#### http_request
```typescript
{
  url: string;                   // 支持 {{ variables.xxx }} 引用
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;                 // JSON 字符串，支持 {{ }} 引用
  timeout?: number;              // 默认 30
  response_type?: 'json' | 'text' | 'binary';
}
```

#### code
```typescript
{
  language: 'python' | 'javascript';
  code: string;                  // 代码内容
  input_mapping?: Record<string, string>;  // 输入变量映射
  timeout?: number;              // 默认 60
}
```

#### transform
```typescript
{
  transformations: TransformRule[];
}
interface TransformRule {
  source: string;     // "{{ node_1.output.field }}"
  target: string;     // 输出字段名
  type?: 'direct' | 'json_parse' | 'json_stringify' | 'template' | 'regex_extract';
  template?: string;  // type=template 时使用
  pattern?: string;   // type=regex_extract 时使用
}
```

#### notification
```typescript
{
  channel_id: string;
  channel_name?: string;
  message: string;                // 支持 {{ }} 引用
  title?: string;
}
```

#### human
```typescript
{
  description: string;            // 审批说明
  approvers?: string[];           // 审批人 ID 列表
  timeout?: number;               // 等待超时（秒），0=不限时
}
```

#### output
```typescript
{
  output_name: string;            // 输出名
  source: string;                 // "{{ node_x.output.data }}"
  format?: 'json' | 'text';
}
```

### 3.4 重试配置 (RetryConfig)

```typescript
interface RetryConfig {
  max_retries: number;    // 最大重试次数，默认 0
  interval: number;       // 重试间隔（秒），默认 5
  backoff?: 'fixed' | 'exponential';  // 默认 fixed
}
```

---

## 4. 连线 (WorkflowEdge)

```typescript
interface WorkflowEdge {
  id: string;              // 唯一ID，如 "edge_1_2"
  source: string;          // 源节点 ID
  source_handle: string;   // 源输出端口，如 "default", "true", "false", "error"
  target: string;          // 目标节点 ID
  target_handle?: string;  // 目标输入端口，通常为 "default"
  label?: string;          // 连线标签（可选）
}
```

### 4.1 端口约定

| 端口名 | 适用节点类型 | 说明 |
|--------|-------------|------|
| default | 所有节点 | 默认输出/输入 |
| true | condition | 条件为真 |
| false | condition | 条件为假 |
| error | agent, http_request, code, sub_workflow | 执行出错 |
| approved | human | 审批通过 |
| rejected | human | 审批拒绝 |
| {case.output_name} | switch | 各 case 的输出端口 |

---

## 5. 工作流配置 (WorkflowConfig)

```typescript
interface WorkflowConfig {
  timeout: number;                // 全局超时（秒），默认 3600
  error_strategy: 'stop_all' | 'continue' | 'notify';  // 全局错误策略，默认 stop_all
  max_concurrent_nodes: number;   // 最大并行节点数，默认 10
  retry_policy?: {
    default_max_retries: number;  // 默认 0
    default_interval: number;     // 默认 5
  };
}
```

---

## 6. 变量引用系统

### 6.1 引用语法

```
{{ node_id.output.field_name }}     // 引用节点输出
{{ variables.var_name }}            // 引用工作流变量
{{ env.ENV_KEY }}                   // 引用环境变量
{{ context.user_id }}               // 引用执行上下文
{{ context.task_id }}               // 当前任务 ID
{{ context.execution_id }}          // 当前执行 ID
```

### 6.2 引用解析优先级

1. 节点输出（`node_id.output.*`）— 上游节点执行结果
2. 工作流变量（`variables.*`）— 用户定义的变量
3. 环境变量（`env.*`）— 系统环境变量
4. 上下文变量（`context.*`）— 执行运行时注入

### 6.3 节点输出结构

每个节点执行后产出统一格式：

```typescript
interface NodeOutput {
  status: 'success' | 'failed' | 'skipped';
  data: Record<string, unknown>;   // 节点业务数据
  error?: string;                  // 错误信息（status=failed 时）
  metadata?: {
    duration_ms: number;
    retries: number;
  };
}
```

---

## 7. 存储格式

### 7.1 数据库

```sql
-- workflows 表
definition TEXT  -- JSON 字符串：WorkflowDefinition
config TEXT      -- JSON 字符串：WorkflowConfig

-- tasks 表（实例化后）
workflow_snapshot TEXT  -- JSON 字符串：创建时的 WorkflowDefinition 快照
workflow_id VARCHAR(36)  -- 关联的工作流 ID
```

### 7.2 API 请求/响应

```json
// POST /api/v1/workflows
{
  "name": "我的工作流",
  "description": "...",
  "engine": "nexus",
  "definition": { /* WorkflowDefinition 对象 */ }
}

// GET /api/v1/workflows/:id
{
  "id": "...",
  "name": "...",
  "definition": { /* WorkflowDefinition 对象 */ },
  "status": "draft"
}
```

### 7.3 导入/导出

导出为 `.json` 文件，结构：

```json
{
  "schema_version": "1.0",
  "exported_at": "2026-03-16T12:00:00Z",
  "workflow": { /* WorkflowDefinition 对象 */ }
}
```

---

## 8. 与 React Flow 的映射

编辑器基于 React Flow，数据映射关系：

| React Flow | Schema | 说明 |
|-----------|--------|------|
| `node.id` | `WorkflowNode.id` | 节点 ID |
| `node.type` | `WorkflowNode.type` | 节点类型（自定义组件名） |
| `node.data` | `WorkflowNode.config` + `label` 等 | 节点配置数据 |
| `node.position` | `WorkflowNode.position` | 画布坐标 |
| `edge.id` | `WorkflowEdge.id` | 连线 ID |
| `edge.source` | `WorkflowEdge.source` | 源节点 |
| `edge.sourceHandle` | `WorkflowEdge.source_handle` | 源端口 |
| `edge.target` | `WorkflowEdge.target` | 目标节点 |
| `edge.targetHandle` | `WorkflowEdge.target_handle` | 目标端口 |

前端保存时将 React Flow 的 `nodes` + `edges` 转换为 Schema 格式存储。
前端加载时将 Schema 的 `nodes` + `edges` 转换为 React Flow 格式渲染。
