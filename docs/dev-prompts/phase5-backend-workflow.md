# Phase 5 - 后端：Nexus 工作流引擎

## 任务目标

实现 Nexus 自研工作流引擎核心：节点注册机制、执行调度器、状态机、WebSocket 实时推送。

## 修改/新建文件清单

```
backend/app/services/workflow_engine/__init__.py
backend/app/services/workflow_engine/engine.py         # 核心调度器
backend/app/services/workflow_engine/registry.py       # 节点注册表
backend/app/services/workflow_engine/state_machine.py  # 执行状态机
backend/app/services/workflow_engine/event_publisher.py # WebSocket事件发布
backend/app/services/workflow_engine/nodes/__init__.py
backend/app/services/workflow_engine/nodes/base.py     # 节点执行器基类
backend/app/services/workflow_engine/nodes/agent.py    # Agent执行节点
backend/app/services/workflow_engine/nodes/condition.py # 条件分支节点
backend/app/services/workflow_engine/nodes/human.py    # 人工干预节点
backend/app/services/workflow_engine/nodes/parallel.py  # 并行执行节点
backend/app/services/workflow_engine/nodes/transform.py # 数据转换节点
backend/app/services/workflow_engine/nodes/notification.py # 通知节点
backend/app/services/workflow_engine/nodes/timer.py    # 定时触发节点
backend/app/routers/workflows.py                       # 扩展
backend/app/services/ws_manager.py                     # WebSocket连接管理
```

## 工作流定义格式

```json
{
  "nodes": [
    { "id": "start", "type": "timer", "config": { "cron": "0 9 * * 1" }, "position": { "x": 0, "y": 0 } },
    { "id": "agent1", "type": "agent", "config": { "agent_id": "...", "prompt": "..." }, "position": { "x": 200, "y": 0 } },
    { "id": "check", "type": "condition", "config": { "expression": "{{agent1.output.exit_code}} == 0" }, "position": { "x": 400, "y": 0 } }
  ],
  "edges": [
    { "id": "e1", "from": "start", "to": "agent1" },
    { "id": "e2", "from": "agent1", "to": "check" },
    { "id": "e3", "from": "check", "to": "agent1", "condition": "false", "label": "重试" },
    { "id": "e4", "from": "check", "to": "end", "condition": "true" }
  ]
}
```

## 节点注册表

```python
# registry.py

class NodeRegistry:
    _nodes: Dict[str, NodeTypeDefinition] = {}

    @classmethod
    def register(cls, node_type: str, schema_version: str = "1.0"):
        """装饰器注册节点类型"""
        def decorator(node_cls):
            cls._nodes[node_type] = NodeTypeDefinition(
                type=node_type,
                schema_version=schema_version,
                executor_class=node_cls,
                config_schema=node_cls.CONFIG_SCHEMA,
            )
            return node_cls
        return decorator

    @classmethod
    def get_all_types(cls) -> List[dict]:
        """返回所有节点类型（供前端节点面板使用）"""

    @classmethod
    def get_executor(cls, node_type: str):
        """获取节点执行器实例"""
```

## 节点执行器基类

```python
# nodes/base.py

class BaseNodeExecutor(ABC):
    CONFIG_SCHEMA: dict = {}  # JSON Schema，前端用此渲染配置面板

    @abstractmethod
    async def execute(self, context: NodeContext) -> NodeResult:
        """
        context 包含：input_data, workflow_execution_id, config
        返回 NodeResult(output_data, status, error_message)
        """
```

## 各节点实现要点

### Agent 节点
- 从 config 获取 agent_id、prompt、timeout
- 通过 Gateway 服务提交任务到对应 Bridge
- 等待任务完成（或超时）
- 返回 Agent 的输出

### Condition 节点
- 解析 config.expression（Jinja2 模板）
- 评估为 true/false
- 引擎根据结果选择后续 edge

### Human 节点
- 创建 human_intervention 记录
- 暂停工作流执行
- 等待用户通过 API 响应
- 返回用户的决策结果

### Parallel 节点
- 获取所有出边
- 使用 `asyncio.gather` 并行执行所有下游节点
- 等待所有分支完成

### Transform 节点
- 简单的数据映射/过滤
- config 定义转换规则（后续迭代完善，本次先支持简单的 JSONPath 提取）

### Notification 节点
- 调用 Phase 4 的通知服务发送消息
- config 包含 channel_id 和消息模板

### Timer 节点
- 解析 cron 表达式
- 在工作流启动时设置定时触发
- 使用 APScheduler 或简单 sleep（本次迭代先实现手动触发，定时后续完善）

## 核心调度器

```python
# engine.py

class WorkflowEngine:
    async def start(self, workflow_id: str, input_params: dict, user_id: str) -> str:
        """启动工作流执行，返回 execution_id"""
        # 1. 创建 workflow_executions 记录（status=running）
        # 2. 解析工作流定义，构建执行图
        # 3. 找到起始节点（无入边）
        # 4. 调度执行

    async def _schedule_node(self, execution_id: str, node_id: str, input_data: dict):
        """调度单个节点执行"""
        # 1. 创建 workflow_node_executions 记录
        # 2. 通过 WebSocket 推送 node.status_changed → running
        # 3. 获取执行器，执行
        # 4. 更新节点状态和输出
        # 5. 推送结果
        # 6. 确定下一步节点并调度

    async def _evaluate_condition(self, node_config: dict, context: dict) -> bool:
        """评估条件表达式"""

    async def pause(self, execution_id: str):
    async def resume(self, execution_id: str):
    async def cancel(self, execution_id: str):
```

## WebSocket 事件发布

```python
# event_publisher.py

class WorkflowEventPublisher:
    async def publish(self, topic: str, event: dict):
        """发布事件到 WebSocket 订阅者"""
        # topic = "workflow:{execution_id}"
        # event = { "type": "node.status_changed", "data": { "node_id": "...", "status": "..." } }
```

## WebSocket 端点

```python
# main.py 新增
@app.websocket("/api/v1/ws/workflow/{execution_id}")
async def workflow_ws(websocket: WebSocket, execution_id: str):
    await websocket.accept()
    ws_manager.subscribe(f"workflow:{execution_id}", websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive
    finally:
        ws_manager.unsubscribe(f"workflow:{execution_id}", websocket)
```

## API 端点扩展

```
GET  /api/v1/workflow/node-types                    # 返回所有注册的节点类型
POST /api/v1/workflows/{id}/execute                  # 生成流程（创建执行实例）
GET  /api/v1/workflow-executions                     # 执行实例列表
GET  /api/v1/workflow-executions/{id}                # 执行详情 + 节点状态
POST /api/v1/workflow-executions/{id}/pause
POST /api/v1/workflow-executions/{id}/resume
POST /api/v1/workflow-executions/{id}/cancel
GET  /api/v1/workflow-executions/{id}/nodes          # 节点执行记录
POST /api/v1/workflows/save-as-template              # 保存为模板
```

## 约束

- Python 兼容 3.9
- 节点执行超时由 config.timeout 控制
- 条件表达式使用简单的字符串匹配或 Jinja2（避免 eval）
- WebSocket 连接数限制：单 execution 最多 10 个连接
- 执行引擎运行在 FastAPI 事件循环中（asyncio）

## 验收标准

- [ ] GET /api/v1/workflow/node-types 返回 7 种节点类型及 schema
- [ ] 创建工作流定义（nodes + edges）保存成功
- [ ] 执行工作流，节点按顺序运行
- [ ] 条件分支节点根据结果选择路径
- [ ] 并行节点同时执行多个分支
- [ ] 人工干预节点暂停工作流，用户审批后恢复
- [ ] WebSocket 实时推送节点状态变化
- [ ] 暂停/恢复/取消执行正常
- [ ] 保存为模板成功，可从模板加载
