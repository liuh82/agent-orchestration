# 迭代三 T1：oc-bridge 阶段2 — 任务执行

## 任务
在阶段1（骨架 + WebSocket 连通）基础上，实现任务接收、Claude Code 执行、进度上报、结果回传。

## 已完成
阶段1代码在 `bridges/oc-bridge/`，可直接 `npx tsx src/index.ts start` 连接后端并注册成功。

## 后端协议（必须严格对接）

### 收到任务（后端→Bridge）
```json
{ "type": "task.submit", "taskId": "xxx", "prompt": "...", "projectPath": "/path", "agentType": "cli", "timeout": 300, "priority": "normal", "preferredIde": null }
```
Bridge 收到后**必须先发 task.ack**：
```json
{ "type": "task.ack", "taskId": "xxx" }
```
后端收到 ack 后将任务状态改为 RUNNING。

### 进度上报（Bridge→后端）
```json
{ "type": "task.progress", "taskId": "xxx", "progress": 50 }
```
progress 范围 0-100，建议至少每 5 秒报一次。

### 任务完成（Bridge→后端）
**成功：**
```json
{ "type": "task.complete", "taskId": "xxx", "success": true, "output": "结果文本", "exitCode": 0, "changedFiles": ["file1.ts", "file2.ts"], "duration": 120 }
```

**失败：**
```json
{ "type": "task.complete", "taskId": "xxx", "success": false, "error": "错误信息", "exitCode": 1, "duration": 30 }
```

关键字段说明：
- `output`：Agent 的执行输出文本
- `exitCode`：进程退出码
- `changedFiles`：被修改的文件列表（可通过 git diff 获取）
- `duration`：执行耗时（秒）
- `error`：失败时的错误信息

### 任务超时
后端 `task.submit` 中的 `timeout` 是秒数。Bridge 应该在超时后主动杀掉子进程并发送失败消息。

## 需要新增的文件/模块

### 1. `src/task/task-manager.ts` — 任务管理器
- 管理任务生命周期：pending → running → completed/failed/timeout
- 维护任务队列，支持 maxConcurrent 限制
- 接收到 `task.submit` 消息后，通过 task-manager 调度执行

### 2. `src/task/types.ts` — 任务类型定义
```typescript
interface Task {
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: string;
  timeout: number;
  priority: string;
  preferredIde: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  startedAt?: number;
  completedAt?: number;
}
```

### 3. `src/agent/executor.ts` — AgentExecutor 抽象基类
```typescript
abstract class AgentExecutor {
  abstract execute(task: Task, onProgress: (progress: number) => void): Promise<ExecutionResult>;
}
interface ExecutionResult {
  success: boolean;
  output: string;
  exitCode: number;
  changedFiles?: string[];
  error?: string;
  duration: number;
}
```

### 4. `src/agent/claude-code.ts` — ClaudeCodeExecutor
- 使用 `child_process.spawn` 启动 Claude Code CLI
- 命令格式：`claude --print --output-format stream-json --prompt "xxx"`（在 projectPath 目录下执行）
- `--print` 模式：非交互，执行完输出结果后退出
- `--output-format stream-json`：JSON 流式输出，方便解析进度
- 从 stdout 实时读取输出，计算进度上报
- 支持 `timeout` 参数，超时后 `process.kill`
- 通过 `git diff --name-only` 获取 changedFiles

### 5. `src/agent/registry.ts` — AgentRegistry
- 根据 `agentType` 分发到对应 Executor
- 首期只注册 ClaudeCodeExecutor（对应 `cli` 类型）

## 修改已有文件

### `src/websocket/connection.ts`
- 在消息处理中增加 `task.submit` 分支
- 收到 task.submit 后，调用 TaskManager 的 submit 方法
- TaskManager 内部负责发 task.ack、执行、上报进度、发 task.complete

## 验收标准

1. **安装并配置**（如未做）：`npx tsx src/index.ts setup --url ws://localhost:8082/api/gateway/ws --token dev-api-key-local-only`
2. **启动 bridge**：`npx tsx src/index.ts start`
3. **提交测试任务**（用 curl）：
```bash
curl -X POST http://localhost:8082/api/gateway/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-local-only" \
  -d '{"prompt": "创建一个 hello.txt 文件，内容为 Hello World", "projectPath": "/tmp/oc-bridge-test"}'
```
4. **验证**：
   - Bridge 收到任务并打印日志
   - 发送 task.ack（后端任务状态变为 running）
   - Claude Code 执行，bridge 上报进度
   - 执行完成后发送 task.complete（后端任务状态变为 completed）
   - `/tmp/oc-bridge-test/hello.txt` 文件存在且内容正确
5. **超时测试**：提交一个 timeout=5 的长任务，验证 bridge 会在 5 秒后杀进程并报失败
6. **并发测试**：快速提交 2 个任务（maxConcurrent=3），验证都能正确执行

## Claude Code CLI 调用注意

- Claude Code 已安装在服务器：`/root/.nvm/versions/node/v22.22.0/bin/claude`（v2.1.76）
- 使用 `claude --print` 模式（非交互，单次执行）
- `--output-format stream-json` 输出 JSON 事件流
- 在 `projectPath` 目录下 spawn 子进程（`cwd: task.projectPath`）
- 需要先 `mkdir -p` 确保 projectPath 存在

## 禁止事项
- 不要修改后端代码（Python）
- 不要引入新依赖（阶段1的 ws/commander/uuid 足够）
- 不要修改阶段1已验证通过的代码逻辑（连接、认证、注册、心跳）
