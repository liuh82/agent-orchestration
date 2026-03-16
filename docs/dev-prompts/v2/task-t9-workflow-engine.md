# Nexus 开发任务 T9：工作流执行引擎升级

## 必读文件（先读完再动手）
- CLAUDE.md
- **docs/dev-prompts/v2/workflow-schema-v1.md**（⚠️ 与 T8 共用 Schema，严格遵循）
- docs/architecture-v4.md（工作流引擎部分）
- backend/app/services/workflow_engine/ 目录（现有引擎代码）
- backend/app/services/workflow_engine/engine.py（核心调度）
- backend/app/services/workflow_engine/nodes/ 目录（现有节点执行器）
- backend/app/services/workflow_engine/state_machine.py
- backend/app/services/workflow_engine/event_publisher.py
- backend/app/models/workflow_execution.py（执行记录模型）

## 核心约束
- **工作流定义格式必须严格遵循 workflow-schema-v1.md**
- T8（前端编辑器）按同一 Schema 开发，两边独立开发后需无缝集成
- 不要修改前端代码（T8 负责）
- 不要修改数据库模型（T2 数据库重建时统一处理）
- 不要 git commit

---

## 任务目标
升级工作流执行引擎，支持完整的节点类型、分支逻辑、循环、子工作流调用和变量系统。

## 实现步骤

### 第一步：变量解析器

新建 `backend/app/services/workflow_engine/variable_resolver.py`：

- 解析 `{{ }}` 模板语法
- 支持点号路径访问嵌套字段：`{{ node_1.output.result.score }}`
- 解析优先级：循环变量 > 节点输出 > 工作流变量 > 环境变量 > 上下文变量
- 引用不存在的变量返回 `None`（不报错）
- 支持特殊变量：`loop.current_index`, `loop.current_item`, `context.user_id`, `context.task_id`
- 实现为纯函数，方便单元测试

### 第二步：节点注册表扩展

更新 `backend/app/services/workflow_engine/registry.py`（或 `NodeRegistry`）：

注册以下节点执行器：
- `manual_trigger` → ManualTriggerNode
- `cron_trigger` → CronTriggerNode
- `webhook_trigger` → WebhookTriggerNode
- `agent` → AgentNode（升级现有）
- `if` → IfNode
- `switch` → SwitchNode
- `loop` → LoopNode
- `wait` → WaitNode
- `sub_workflow` → SubWorkflowNode
- `http_request` → HttpRequestNode
- `code` → CodeNode
- `transform` → TransformNode
- `output` → OutputNode

每种节点实现 `NodeExecutor` 接口（参考现有 `base.py`）。

### 第三步：各节点执行器实现

#### 3.1 触发器节点

- `manual_trigger`：直接返回 success（手动触发由 API 调用）
- `cron_trigger`：验证 cron 表达式，返回 success（实际调度由外部 scheduler）
- `webhook_trigger`：返回 success，输出包含请求的 method/path/headers/body

#### 3.2 Agent 节点（升级现有）

- 从 `data.agentId` 加载 Agent 配置，或使用 `data` 中的内联配置
- 用变量解析器替换 prompt 中的 `{{ }}`
- 配置 model/temperature/maxTokens/timeout
- 调用 LLM 并返回结果
- 输出格式：`{ content: string, usage: { prompt_tokens, completion_tokens }, model: string }`

#### 3.3 IF 条件分支节点

- 解析 `data.conditions`（field/operator/value）
- 逐个评估条件，根据 `data.logic`（and/or）组合
- 输出：`{ result: true/false, matched_conditions: [...] }`
- 引擎根据 result 决定走 `true` 还是 `false` sourceHandle 的 edge

支持的 operator：`eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `contains`, `regex`, `empty`, `not_empty`

#### 3.4 Switch 多路分支节点

- 解析 `data.field`，取值
- 逐个匹配 `data.cases`（按顺序）
- 第一个匹配的 case 对应 sourceHandle `case_N`
- 无匹配走 `default`
- 输出：`{ matched_case: number | "default", value: any }`

#### 3.5 Loop 循环节点

- `loopType=count`：执行 body 分支 N 次，每次注入 `loop.current_index`
- `loopType=iterate`：遍历列表，每次注入 `loop.current_item` 和 `loop.current_index`
- 检查 `breakCondition`，满足则跳到 `done`
- 强制 `maxIterations` 限制（默认 100）
- body 边对应的下游节点执行完后回到 loop 节点评估下一次
- 全部完成后走 `done` 边

#### 3.6 Wait 等待节点

- `waitType=duration`：asyncio.sleep 指定秒数
- `waitType=webhook`：设置状态为 waiting，等 webhook 回调后继续

#### 3.7 Sub Workflow 子工作流节点

- 从 `data.workflowId` 加载目标工作流定义
- 解析 `data.parameterMapping`，将父工作流变量传递给子工作流
- 递归调用 `WorkflowEngine.start()`
- 等待子工作流完成
- 将子工作流输出合并到当前变量上下文
- 防止无限递归：跟踪嵌套深度，超过 `maxDepth`（默认 5）则报错

#### 3.8 HTTP Request 节点

- 解析 URL/method/headers/body（支持 `{{ }}` 变量）
- 使用 `aiohttp` 发送请求
- 输出：`{ status_code, headers, body }`
- 支持 retryPolicy

#### 3.9 Code 节点

- `language=python`：使用 `exec()` 或 `subprocess` 执行（注意安全隔离）
- `language=javascript`：使用 `subprocess` 调 node 执行
- 输入：上游节点输出作为变量注入
- 输出：stdout 作为节点输出
- 强制 timeout（默认 60 秒）

#### 3.10 Transform 数据转换节点

- 解析 `data.mappings`，逐个执行赋值
- 将结果写入当前变量上下文
- 输出：转换后的变量集合

#### 3.11 Output 输出节点

- 收集上游节点输出
- 按 `data.format` 格式化（json/text/markdown）
- 记录到执行日志

### 第四步：引擎调度升级

更新 `backend/app/services/workflow_engine/engine.py`：

- 解析 Schema v1 格式的 definition
- sourceHandle 路由：IF/Switch/Loop 节点根据 sourceHandle 决定下游
- 变量上下文传递：维护 `context` 字典，每执行完一个节点更新
- 循环处理：loop 节点的 body 边下游执行完后自动回到 loop
- 错误处理：
  - 节点级 retry（配置 retryPolicy）
  - 节点级 errorStrategy（stop/skip/continue）
  - 工作流级 errorStrategy（stop_all/continue/notify）
- 执行超时：config.timeout

### 第五步：事件推送升级

更新 `backend/app/services/workflow_engine/event_publisher.py`：

- 推送执行进度：`{ current_node, completed_nodes, total_nodes }`
- 推送节点输出：`{ node_id, output }`
- 保持现有 WebSocket 通道不变

## 完成标准
- [ ] 变量解析器正确处理所有 `{{ }}` 语法
- [ ] IF 节点正确评估条件并路由到 true/false 分支
- [ ] Switch 节点支持多条件分支
- [ ] Loop 节点支持 count 和 iterate 两种模式
- [ ] Sub Workflow 可调用并返回结果
- [ ] HTTP Request 节点可发送请求
- [ ] Code 节点可执行 Python/JavaScript
- [ ] Transform 节点正确映射变量
- [ ] 错误处理和重试机制正常
- [ ] Python 语法检查全部通过
- [ ] 现有工作流不回归（仍能正常执行）

## 不要做的事
- 不要修改 `frontend/` 目录下任何文件
- 不要修改数据库模型
- 不要 git commit
- 不要实现调度器（cron/webhook 的定时触发，那是独立模块）
