# 迭代三 T1：oc-bridge 客户端开发

## 任务
根据架构设计文档，开发 Nexus 系统的 Bridge 客户端 `oc-bridge`。

## 架构设计文档
`bridges/oc-bridge/` 目录下（需要新建），设计文档在 `workspace-architect/docs/oc-bridge-architecture.md`

## 后端协议参考（必须严格对接）
- `backend/app/routers/gateway.py` — WebSocket 端点、认证、注册流程
- `backend/app/services/gateway/ws_server.py` — 消息处理、心跳
- `backend/app/services/gateway/task_router.py` — 任务分发（注意：消息类型是 `task.submit` 不是 `task.dispatch`）
- `backend/app/models/gateway_schemas.py` — AgentType 枚举（cli/codex/pi/acp/vscode）

## 关键协议细节（踩坑点）

### 1. 认证方式
后端支持两种认证：
- **方式 A（推荐）**：WebSocket 连接后，立即发送 `auth.request` 消息，timeout 10 秒
- **方式 B（遗留）**：连接时带 `?token=xxx` 查询参数

### 2. 注册消息格式
```json
{
  "type": "bridge.register",
  "bridgeId": "<uuid>",
  "platform": "linux",
  "hostname": "server-01",
  "osVersion": "...",
  "nodeVersion": "...",
  "bridgeVersion": "1.0.0",
  "adapters": [{"type": "cli", "name": "claude-code", "version": "1.0.0", "executablePath": "/usr/local/bin/claude"}],
  "activeTasks": 0,
  "maxConcurrent": 3
}
```

### 3. 任务分发消息（后端→Bridge）
```json
{
  "type": "task.submit",
  "taskId": "xxx",
  "prompt": "...",
  "projectPath": "/path",
  "agentType": "cli",
  "timeout": 300,
  "priority": "normal",
  "preferredIde": null
}
```
Bridge 收到后必须回复 `task.ack`。

### 4. 心跳
**服务端每 30 秒发 `{"type": "ping"}`，Bridge 回 `{"type": "pong"}`**。
Bridge 不要主动发 ping。

### 5. 注册成功响应
服务端返回 `bridge.registered`，包含 `resumedTasks` 数组（之前未完成的任务）。

## 项目结构
```
agent-orchestration/bridges/oc-bridge/
├── package.json
├── tsconfig.json
├── bin/oc-bridge
├── src/cli/          # setup/start/status/stop
├── src/websocket/    # 连接、认证、注册、心跳、协议类型
├── src/task/         # 任务管理器、队列、恢复、类型
├── src/agent/        # AgentExecutor 基类 + ClaudeCodeExecutor + Registry
├── src/progress/     # 进度采集
├── src/storage/      # 配置、状态持久化（~/.oc-bridge/）
├── src/logger/       # 日志
└── src/utils/        # 重试、平台检测
```

## 开发要求

### 分阶段交付
**阶段 1：骨架 + WebSocket 连通**
- package.json、tsconfig.json、CLI 入口
- WSConnection：连接、认证、注册、心跳
- `oc-bridge setup --url ... --token ...` 能保存配置
- `oc-bridge start` 能连上后端并注册成功（Nexus 前端显示 online）
- 验收：在 Nexus 管理页面看到 bridge 状态为 online

**阶段 2：任务执行**
- TaskManager + TaskQueue
- ClaudeCodeExecutor：spawn claude 进程、采集输出、超时控制
- 进度上报（task.progress）
- 任务完成上报（task.complete / task.failed）
- 验收：在 Nexus 创建任务 → bridge 执行 → 状态更新 → 结果返回

**阶段 3：健壮性**
- 断线重连（指数退避 + 任务恢复）
- 状态持久化（state.json）
- 任务超时管理
- 错误处理和日志

### 技术约束
- TypeScript，Node.js >= 18
- 最小依赖：`ws` + `commander` + `uuid`（生产依赖不超过 5 个）
- 使用 `tsx` 做开发时运行，`tsc` 编译后分发
- 首期 Agent 只实现 ClaudeCodeExecutor
- Claude Code CLI 调用方式：`claude --prompt "xxx" --output-format stream-json`
- 如果服务器上没有 claude CLI，需要先安装：`npm install -g @anthropic-ai/claude-code`

### 验收标准
1. `npm install -g ./bridges/oc-bridge` 能安装成功
2. `oc-bridge setup --url ws://localhost:8082/api/v1/gateway/ws --token <key>` 配置成功
3. `oc-bridge start` 启动后，Nexus 前端 Bridge 管理页面显示 online
4. 通过 Nexus API 提交任务，bridge 能接收并执行
5. `Ctrl+C` 停止后重启，断线重连正常

## 禁止事项
- 不要修改后端代码（Python），只开发 bridges/oc-bridge/
- 不要发布到 npm
- 不要引入重型框架（Express、NestJS 等）
