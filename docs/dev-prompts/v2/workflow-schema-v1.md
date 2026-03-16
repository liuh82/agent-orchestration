# Nexus 工作流 Schema v1（T8/T9 共用）

> 本文档定义工作流的完整数据格式，前端编辑器（T8）和后端引擎（T9）**必须严格遵循此 Schema**，确保两边独立开发后能无缝集成。

---

## 1. 工作流定义（顶层结构）

保存到数据库 `workflows.definition` 字段（JSON 字符串）。

```typescript
interface WorkflowDefinition {
  version: "1.0";                    // Schema 版本，固定 "1.0"
  name: string;                       // 工作流名称
  description: string;                // 工作流描述
  nodes: WorkflowNode[];              // 节点数组
  edges: WorkflowEdge[];              // 连线数组
  variables?: Record<string, any>;    // 全局变量（工作流级）
  config: WorkflowConfig;             // 工作流配置
}
```

```python
# Python Pydantic 等价
class WorkflowDefinition(BaseModel):
    version: Literal["1.0"] = "1.0"
    name: str
    description: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    variables: Optional[Dict[str, Any]] = {}
    config: Dict[str, Any] = {}
```

### WorkflowConfig

```typescript
interface WorkflowConfig {
  timeout?: number;           // 整体超时（秒），默认 3600
  retryPolicy?: {
    maxRetries?: number;      // 默认 0
    interval?: number;        // 重试间隔（秒），默认 5
  };
  errorStrategy?: "stop_all" | "continue" | "notify";  // 默认 "stop_all"
  maxParallel?: number;       // 最大并行节点数，默认 10
}
```

---

## 2. 节点（WorkflowNode）

### 通用节点结构

每个节点必须包含以下基础字段：

```typescript
interface WorkflowNode {
  id: string;                 // 唯一标识，如 "node_1a2b3c4d"
  type: WorkflowNodeType;     // 节点类型（见下表）
  position: {                 // 画布坐标（仅前端使用）
    x: number;
    y: number;
  };
  data: NodeData;             // 节点配置数据（按类型不同）
  disabled?: boolean;         // 是否禁用，默认 false
}
```

### 节点类型枚举

| type 值 | 中文名 | 分类 | Handle（端口） |
|---------|--------|------|----------------|
| `manual_trigger` | 手动触发 | 触发器 | 1 output |
| `cron_trigger` | 定时触发 | 触发器 | 1 output |
| `webhook_trigger` | Webhook 触发 | 触发器 | 1 output |
| `agent` | Agent 执行 | Agent | 1 input, 1 output |
| `if` | 条件分支 | 逻辑控制 | 1 input, 2 outputs (true/false) |
| `switch` | 多路分支 | 逻辑控制 | 1 input, N outputs (case_0, case_1, ..., default) |
| `loop` | 循环 | 逻辑控制 | 1 input, 2 outputs (body/done) |
| `wait` | 等待 | 逻辑控制 | 1 input, 1 output |
| `sub_workflow` | 子工作流 | 工作流 | 1 input, 1 output |
| `http_request` | HTTP 请求 | 数据 | 1 input, 1 output |
| `code` | 代码执行 | 数据 | 1 input, 1 output |
| `transform` | 数据转换 | 数据 | 1 input, 1 output |
| `output` | 输出结果 | 输出 | 1 input |

---

## 3. 各节点类型的 data 字段详细定义

### 3.1 manual_trigger

```typescript
{
  label: string;              // 显示名称，默认 "手动触发"
}
```

### 3.2 cron_trigger

```typescript
{
  label: string;              // 默认 "定时触发"
  cronExpression: string;     // cron 表达式，如 "0 */5 * * *"
  timezone?: string;          // 时区，默认 "UTC"
}
```

### 3.3 webhook_trigger

```typescript
{
  label: string;              // 默认 "Webhook 触发"
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;               // 如 "/webhook/my-workflow"
  headers?: Record<string, string>;
}
```

### 3.4 agent

```typescript
{
  label: string;              // 默认 "Agent"
  agentId?: string;           // 选择已有 Agent（可选，与下方配置二选一）
  // Agent 配置（未选已有 Agent 时使用）
  agentType?: string;         // 如 "claude", "gpt4", "custom"
  prompt: string;             // Agent prompt 模板，支持 {{ variable }} 语法
  model?: string;             // 模型标识
  temperature?: number;       // 0-1，默认 0.7
  maxTokens?: number;         // 最大 token，默认 4096
  timeout?: number;           // 超时（秒），默认 300
  // 可覆盖标记（T10 实例化时使用）
  overridableFields?: string[];  // 如 ["prompt", "model", "temperature"]
}
```

### 3.5 if（条件分支）

```typescript
{
  label: string;              // 默认 "IF 条件"
  conditions: {
    field: string;            // 取值路径，如 "{{ node_1.output.status }}"
    operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "regex" | "empty" | "not_empty";
    value: string;            // 比较值（operator 为 empty/not_empty 时忽略）
  }[];
  logic: "and" | "or";       // 多条件逻辑，默认 "and"
}
```

**Edge sourceHandle 对应**：`"true"` / `"false"`

### 3.6 switch（多路分支）

```typescript
{
  label: string;              // 默认 "Switch"
  field: string;              // 取值路径
  cases: {
    label: string;            // 分支标签
    operator: string;         // 同 IF 的 operator
    value: string;            // 匹配值
  }[];
}
```

**Edge sourceHandle 对应**：`"case_0"`, `"case_1"`, ..., `"default"`

### 3.7 loop（循环节点）

```typescript
{
  label: string;              // 默认 "循环"
  loopType: "count" | "iterate";  // 固定次数 / 列表遍历
  count?: number;             // loopType=count 时，循环次数，默认 10
  listPath?: string;          // loopType=iterate 时，列表取值路径，如 "{{ node_1.output.items }}"
  breakCondition?: string;    // 终止条件表达式
  maxIterations?: number;     // 最大迭代次数，默认 100（防无限循环）
}
```

**Edge sourceHandle 对应**：`"body"`（循环体）/ `"done"`（循环结束）

### 3.8 wait（等待节点）

```typescript
{
  label: string;              // 默认 "等待"
  waitType: "duration" | "webhook";  // 等待时间 / 等待 webhook
  duration?: number;          // waitType=duration 时，等待秒数
  // waitType=webhook 时，无需额外配置，引擎自动生成 webhook endpoint
}
```

### 3.9 sub_workflow（子工作流）

```typescript
{
  label: string;              // 默认 "子工作流"
  workflowId: string;         // 目标工作流 ID
  workflowName?: string;      // 显示用
  parameterMapping?: {        // 参数映射：父→子
    sourcePath: string;       // 如 "{{ node_1.output.result }}"
    targetVar: string;        // 子工作流中的变量名
  }[];
  maxDepth?: number;          // 嵌套深度限制，默认 5
}
```

### 3.10 http_request

```typescript
{
  label: string;              // 默认 "HTTP 请求"
  url: string;                // 支持 {{ variable }} 模板
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;              // 请求体（JSON 字符串或文本）
  timeout?: number;           // 默认 30 秒
  retryPolicy?: {
    maxRetries: number;
    interval: number;
  };
}
```

### 3.11 code

```typescript
{
  label: string;              // 默认 "代码执行"
  language: "python" | "javascript";
  code: string;               // 代码内容
  timeout?: number;           // 默认 60 秒
}
```

### 3.12 transform（数据转换）

```typescript
{
  label: string;              // 默认 "数据转换"
  mappings: {                 // 变量赋值映射
    targetVar: string;        // 目标变量名
    sourceExpression: string; // 源表达式，如 "{{ node_1.output.result }}"
  }[];
}
```

### 3.13 output（输出节点）

```typescript
{
  label: string;              // 默认 "输出"
  format: "json" | "text" | "markdown";
  outputPath?: string;        // 输出目标路径（可选）
}
```

---

## 4. 连线（WorkflowEdge）

```typescript
interface WorkflowEdge {
  id: string;                 // 唯一标识
  source: string;             // 源节点 ID
  target: string;             // 目标节点 ID
  sourceHandle?: string;      // 源端口标识（IF 节点的 "true"/"false"，Switch 的 "case_N"/"default" 等）
  targetHandle?: string;      // 目标端口标识（一般不需要）
  label?: string;             // 连线标签（可选，显示在连线上）
}
```

### React Flow handleId 命名约定

| 节点类型 | 输入 handle | 输出 handle |
|---------|------------|------------|
| 触发器 | 无 | `target`（默认） |
| 普通节点 | `source`（默认） | `target`（默认） |
| if | `source` | `true`, `false` |
| switch | `source` | `case_0`, `case_1`, ..., `default` |
| loop | `source` | `body`, `done` |

---

## 5. 变量系统

### 模板语法

```
{{ node_id.output.field_name }}    — 节点输出引用
{{ node_id.output }}               — 节点完整输出
{{ workflow.variables.xxx }}        — 工作流全局变量
{{ env.xxx }}                       — 环境变量
{{ context.user_id }}               — 执行上下文
{{ context.task_id }}               — 任务 ID
{{ loop.current_index }}            — 循环当前索引
{{ loop.current_item }}             — 循环当前项
```

### 变量解析优先级

1. 循环变量（loop.current_index / loop.current_item）
2. 节点输出（node_id.output）
3. 工作流变量（workflow.variables）
4. 环境变量（env.*）
5. 上下文变量（context.*）

### 解析规则

- 双花括号 `{{ }}` 内支持点号路径访问嵌套字段
- 引用不存在的变量返回 `null`（不报错）
- 变量在节点执行前解析

---

## 6. 执行状态

### 工作流执行状态

| 状态 | 值 | 说明 |
|-----|-----|------|
| 等待中 | `pending` | 已创建，未开始 |
| 运行中 | `running` | 正在执行 |
| 暂停 | `paused` | 用户手动暂停 |
| 等待人工 | `waiting` | 等待人工审批/输入 |
| 已完成 | `completed` | 所有节点成功 |
| 失败 | `failed` | 某个节点失败 |
| 已取消 | `cancelled` | 用户取消 |

### 节点执行状态

| 状态 | 值 | 说明 |
|-----|-----|------|
| 待执行 | `pending` | 等待上游完成 |
| 运行中 | `running` | 正在执行 |
| 已完成 | `completed` | 执行成功 |
| 失败 | `failed` | 执行失败 |
| 跳过 | `skipped` | 条件不满足或上游失败 |
| 等待 | `waiting` | 等待人工干预 |

---

## 7. 节点输出格式（引擎 → 编辑器）

每个节点执行完成后，输出统一格式：

```typescript
{
  status: "completed" | "failed" | "waiting" | "skipped";
  output?: any;               // 节点输出数据
  error?: string;             // 错误信息（失败时）
  duration_ms?: number;       // 执行耗时
  next_node_ids?: string[];   // 下一批节点 ID（覆盖 edge 路由）
}
```

---

## 8. WebSocket 事件（引擎 → 前端实时通信）

| 事件类型 | payload |
|---------|---------|
| `node.status_changed` | `{ node_id, status, output?, error?, duration_ms? }` |
| `node.log` | `{ node_id, message, timestamp, level }` |
| `execution.status_changed` | `{ status, error? }` |
| `human_intervention.required` | `{ node_id, context }` |
| `execution.progress` | `{ current_node, completed_nodes, total_nodes }` |

---

## 9. 完整示例

```json
{
  "version": "1.0",
  "name": "AI 审核工作流",
  "description": "Agent 审核 → 条件判断 → 通知",
  "nodes": [
    {
      "id": "node_trigger_1",
      "type": "manual_trigger",
      "position": { "x": 100, "y": 200 },
      "data": { "label": "开始" }
    },
    {
      "id": "node_agent_1",
      "type": "agent",
      "position": { "x": 350, "y": 200 },
      "data": {
        "label": "AI 审核",
        "agentId": "agent_claude_01",
        "prompt": "请审核以下内容并给出评分：\n\n{{ workflow.variables.content }}",
        "model": "claude-3-opus",
        "temperature": 0.3,
        "maxTokens": 2048,
        "timeout": 300
      }
    },
    {
      "id": "node_if_1",
      "type": "if",
      "position": { "x": 600, "y": 200 },
      "data": {
        "label": "评分判断",
        "conditions": [{
          "field": "{{ node_agent_1.output.score }}",
          "operator": "gte",
          "value": "80"
        }],
        "logic": "and"
      }
    },
    {
      "id": "node_output_1",
      "type": "output",
      "position": { "x": 900, "y": 100 },
      "data": { "label": "通过", "format": "markdown" }
    },
    {
      "id": "node_output_2",
      "type": "output",
      "position": { "x": 900, "y": 300 },
      "data": { "label": "拒绝", "format": "markdown" }
    }
  ],
  "edges": [
    { "id": "e_1", "source": "node_trigger_1", "target": "node_agent_1" },
    { "id": "e_2", "source": "node_agent_1", "target": "node_if_1" },
    { "id": "e_3", "source": "node_if_1", "target": "node_output_1", "sourceHandle": "true" },
    { "id": "e_4", "source": "node_if_1", "target": "node_output_2", "sourceHandle": "false" }
  ],
  "variables": {
    "content": ""
  },
  "config": {
    "timeout": 1800,
    "errorStrategy": "stop_all"
  }
}
```

---

## 10. 前后端接口对照

| 功能 | 前端（T8） | 后端（T9） |
|-----|-----------|-----------|
| 保存工作流 | POST `/api/v1/workflows` body 为上述 JSON | 存入 `workflows.definition` |
| 加载工作流 | GET `/api/v1/workflows/:id` → 解析 `definition.nodes/edges` | 返回完整 JSON |
| 执行工作流 | POST `/api/v1/workflows/:id/execute` | 解析 definition，按图执行 |
| 实时状态 | WebSocket `/api/v1/gateway/ws` 监听事件 | 推送 `node.status_changed` 等 |
| 变量替换 | 前端预览（可选） | 引擎执行时解析 `{{ }}` |
