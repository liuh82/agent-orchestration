# 迭代三 T1：oc-bridge 阶段3 — 健壮性

## 任务
在阶段1+2基础上，实现断线重连、状态持久化、任务超时管理。

## 已完成
- 阶段1：骨架 + WebSocket 连通（认证、注册、心跳）
- 阶段2：任务执行（task.ack、Claude Code spawn、进度上报、task.complete）
- 后端 bug 已修复（async callback）

## 需要实现的功能

### 1. 断线重连（WebSocketConnection）
当 WebSocket 断开时，自动尝试重连：

```
断开 → 等待 1s → 重连 → 失败 → 等待 2s → 重连 → 失败 → 等待 4s → ... → 上限 60s
```

要求：
- 指数退避 + 随机抖动（jitter）：`delay = min(base * 2^attempt + random(0, 1000), 60000)`
- 重连期间不要丢失正在执行的任务
- 重连成功后重新走 auth → register 流程
- register 响应中的 `resumedTasks` 需要恢复执行
- 达到最大重试次数（比如 20 次）或手动 Ctrl+C 后不再重连
- 重连时打印清晰日志：`Reconnecting in Xs (attempt N/20)...`

### 2. 任务状态持久化（Storage）
将运行中的任务状态保存到磁盘，防止 bridge 崩溃时丢失：

**存储位置**：`~/.oc-bridge/state.json`

**格式**：
```json
{
  "version": 1,
  "tasks": [
    {
      "taskId": "task_xxx",
      "prompt": "...",
      "projectPath": "/path",
      "agentType": "cli",
      "timeout": 300,
      "status": "running",
      "startedAt": 1773827000000
    }
  ],
  "lastSaved": "2026-03-18T10:00:00.000Z"
}
```

要求：
- 任务开始时写入 state.json
- 任务完成/失败时从 state.json 移除
- 每次 state 变化时写入（不要频繁写入，合并到一次）
- bridge 启动时如果 state.json 存在，上报给用户（日志打印 `WARNING: Found X unfinished task(s) from previous session`）
- 注意：bridge 重启后不自动恢复执行旧任务（因为 claude 进程已丢失），只在日志中提醒

### 3. 任务超时管理
当前已有基础超时逻辑（AbortController + setTimeout），需要增强：

- 超时后发送 task.complete（success=false, error="Task timed out after Xs"）
- 超时后清理 state.json 中的记录
- 超时后递减活跃任务计数（让 bridge 能继续接新任务）
- 日志：`Task xxx timed out after 300s`

### 4. 优雅关闭
Ctrl+C 时：
1. 停止接受新任务
2. 等待当前运行中的任务完成（最多等 10 秒）
3. 10 秒后强制杀掉剩余任务
4. 保存 state.json
5. 关闭 WebSocket 连接
6. 打印 `Shutdown complete`

### 5. CLI 增强
- `oc-bridge status`：显示当前配置和 bridge 状态（如果 bridge 在运行）
- `oc-bridge stop`：发送 SIGTERM 停止正在运行的 bridge

## 修改的文件

### 已有文件修改
- `src/websocket/connection.ts`：添加断线重连逻辑
- `src/task/task-manager.ts`：添加状态持久化、超时增强
- `src/cli/start.ts`：添加优雅关闭处理
- `src/cli/setup.ts`：（无修改）
- `src/storage/config.ts`：复用目录，新增 state.json 读写

### 新增文件
- `src/storage/state.ts`：状态持久化管理
- `src/utils/retry.ts`：指数退避重连策略
- `src/cli/status.ts`：status 命令
- `src/cli/stop.ts`：stop 命令

## 验收标准

1. **断线重连测试**：
   - 启动 bridge，确认连接成功
   - 重启后端（`pkill -f uvicorn && 重启`）
   - 观察日志：bridge 应自动重连并恢复在线状态
   - 重连后提交任务仍能正常执行

2. **状态持久化测试**：
   - 启动 bridge，提交一个任务
   - 任务执行中直接 `kill -9` bridge 进程
   - 重启 bridge，日志应显示 `WARNING: Found X unfinished task(s)`
   - `cat ~/.oc-bridge/state.json` 应有记录

3. **超时测试**：
   ```bash
   curl -s -X POST http://localhost:8082/api/gateway/tasks \
     -H "Content-Type: application/json" \
     -H "X-API-Key: dev-api-key-local-only" \
     -d '{"prompt": "sleep for 100 seconds", "project_path": "/tmp/oc-bridge-test", "timeout": 10}'
   ```
   - 10 秒后 bridge 应上报 task.complete（success=false, error 含 "timed out"）

4. **优雅关闭测试**：
   - 启动 bridge，提交一个长任务
   - Ctrl+C，观察日志：等待任务 → 超时强杀 → 保存 state → 退出

5. **status 命令**：
   - `npx tsx src/index.ts status` 显示配置信息

## 禁止事项
- 不要修改后端代码（Python）
- 不要引入新依赖
- 不要破坏阶段1+2已验证的功能
