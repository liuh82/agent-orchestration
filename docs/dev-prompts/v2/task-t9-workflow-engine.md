# Nexus 开发任务 T9：工作流执行引擎升级

## 必读文件（先读完再动手）
- CLAUDE.md
- **docs/workflow-schema.md**（⭐ 工作流定义 Schema — 与 T8 的共同契约，必须严格遵循）
- docs/architecture-v4.md（工作流引擎部分）
- backend/app/services/workflow_engine/engine.py（现有引擎，需在此基础上升级）
- backend/app/services/workflow_engine/nodes/（现有节点执行器）
- backend/app/services/workflow_engine/registry.py（节点注册表）
- backend/app/services/workflow_engine/state_machine.py（状态机）
- backend/app/models/workflow_execution.py（执行记录模型）

## 核心约束
- **严格遵守 docs/workflow-schema.md 定义的节点类型、config 结构、端口约定和变量引用系统**
- Schema 是 T8（编辑器）和 T9（引擎）的共同契约，不要自行发明字段
- 只改 `backend/` 目录
- 数据库变更用 Alembic 迁移
- 不要 git commit

## 任务目标
升级工作流执行引擎，支持 Schema 定义的所有 15 种节点类型，包括分支逻辑、循环、子工作流调用和变量系统。

## 具体要求

### 9.1 引擎入口改造
现有 `WorkflowEngine.start()` 接收 `definition: dict`，需确保：
- 解析 Schema 格式的 `definition`（version、variables、nodes、edges、config）
- 从 nodes 中找到类型为 `trigger_*` 的节点作为入口（而非仅靠无入边判断）
- 全局变量注册到变量上下文
- 全局 config 中的 timeout、max_concurrent_nodes 等配置生效

### 9.2 变量引用系统（Schema 第 6 节）
- 实现 `VariableResolver` 类
- 支持 `{{ node_id.output.field }}` 引用上游节点输出
- 支持 `{{ variables.xxx }}` 引用工作流全局变量
- 支持 `{{ env.xxx }}` 引用环境变量
- 支持 `{{ context.user_id }}` 等上下文变量
- 引用在节点执行前统一解析替换
- 引用不存在的变量时抛出明确错误

### 9.3 节点执行器开发
为 Schema 中每种节点类型实现执行器，注册到 `NodeRegistry`：

**触发器节点（3种）**
- `trigger_manual`：直接通过，输出空数据
- `trigger_cron`：输出触发时间 `{ triggered_at: "..." }`
- `trigger_webhook`：输出请求数据 `{ method, path, headers, body, query_params }`

**Agent 节点**
- `agent`：现有 agent 执行器的增强版，支持 config 中的 model/prompt/temperature/max_tokens 覆盖

**逻辑控制节点（4种）**
- `condition`：评估 ConditionGroup（logic: and/or + rules），输出 `{ result: true/false }`，根据结果选择 true/false 端口
- `switch`：按顺序评估 cases，输出 `{ matched_case: "case_name" }`，路由到对应端口
- `loop`：支持 fixed/iterate 模式，设置 current_item/current_index 变量，支持 break_condition
- `wait`：支持 duration（asyncio.sleep）模式，webhook 模式预留

**工作流节点**
- `sub_workflow`：加载目标工作流定义，传递 input_mapping，等待完成，合并输出。嵌套深度限制默认 5

**数据节点（3种）**
- `http_request`：用 aiohttp 发送请求，支持 {{ }} 变量替换
- `code`：Python 用 exec/eval，JavaScript 预留。沙箱隔离，超时保护
- `transform`：按 TransformRule 列表执行数据转换

**输出节点（3种）**
- `notification`：调用通知服务发送通知
- `human`：创建 HumanIntervention 记录，状态转为 WAITING，等待回调恢复
- `output`：将数据写入执行上下文的 outputs

### 9.4 多端口路由（Schema 第 4 节）
- `_get_next_nodes()` 方法需支持 source_handle 过滤
- condition 节点根据输出结果选择 true/false 端口
- switch 节点根据匹配结果选择对应 case 端口
- agent/http_request/code/sub_workflow 失败时路由到 error 端口
- human 节点根据审批结果路由到 approved/rejected 端口
- 无匹配端口时走 default 端口

### 9.5 错误处理（Schema 第 3.4 + 5 节）
- 节点级重试：按 RetryConfig 执行重试，支持 fixed/exponential backoff
- 节点级错误策略：
  - `stop`：停止整个工作流
  - `skip`：跳过当前节点，继续后续
  - `error_output`：走 error 端口，无 error 端口则停止
- 工作流级错误策略：
  - `stop_all`：停止所有节点
  - `continue`：继续执行未受影响的分支
  - `notify`：发送通知后停止

### 9.6 循环执行
- fixed 模式：执行 N 次，设置 `current_index` 变量
- iterate 模式：遍历列表，设置 `current_item` 和 `current_index` 变量
- 每次 iteration 后检查 break_condition，满足则跳出
- 超过 max_iterations 强制终止（默认 100）

### 9.7 节点输出格式（Schema 第 6.3 节）
每个节点执行后产出统一格式：
```python
{
    "status": "success" | "failed" | "skipped",
    "data": { ... },       # 业务数据
    "error": "...",        # 仅 failed 时
    "metadata": {
        "duration_ms": 1234,
        "retries": 0
    }
}
```

## 完成标准
- [ ] 所有 15 种节点类型注册到 NodeRegistry
- [ ] VariableResolver 支持所有 4 种变量引用
- [ ] condition 节点正确评估 ConditionGroup 并按 true/false 端口路由
- [ ] switch 节点支持多 case 分支
- [ ] loop 节点支持 fixed 和 iterate 模式 + break
- [ ] sub_workflow 可调用并返回结果 + 深度限制
- [ ] 多端口路由正常工作（true/false/error/approved/rejected）
- [ ] 重试机制正常工作
- [ ] 节点输出格式统一为 Schema 第 6.3 节格式
- [ ] 能消费前端编辑器产出的 Schema 格式 definition
- [ ] Python 语法检查通过

## 不要做的事
- 不要修改前端代码
- 不要修改数据库模型（如果需要新字段用 Alembic 迁移）
- 不要自行发明不在 Schema 中的节点类型或 config 字段
- 不要 git commit
