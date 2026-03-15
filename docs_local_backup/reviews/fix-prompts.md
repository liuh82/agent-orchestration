# 代码审查修复提示词（用于本地 Claude Code）

以下提示词按优先级分组，可直接复制粘贴到本地 Claude Code 中执行。
每条提示词包含：问题描述、具体位置、修复建议。

---

## 🔴 P0-1: bridge_manager 全局单例竞态条件

**提示词：**

```
请修复 /root/.openclaw/workspace/agent-orchestration/backend/app/routers/gateway.py 中的 bridge_manager 全局单例竞态条件问题。

问题：当前代码中 bridge_manager 是模块级全局变量，在 WebSocket 连接处理时通过 `if bridge_manager is None` 进行懒初始化。多个并发请求可能同时通过这个检查，导致创建多个 BridgeManager 实例。

修复方案：
1. 添加线程锁（threading.Lock）
2. 使用双重检查锁定模式（Double-Checked Locking）

示例：
```python
import threading
_bridge_manager_lock = threading.Lock()
_bridge_manager = None

def get_bridge_manager(db, gw_db):
    global _bridge_manager
    if _bridge_manager is None:
        with _bridge_manager_lock:
            if _bridge_manager is None:
                _bridge_manager = BridgeManager(db, gw_db)
    return _bridge_manager
```

请将所有直接引用 bridge_manager 全局变量的地方改为调用这个 getter 函数。
```

---

## 🔴 P0-2: create_bridge() 事务错误处理

**提示词：**

```
请修复 /root/.openclaw/workspace/agent-orchestration/backend/app/services/gateway/db_gateway.py 中 create_bridge() 方法的事务错误处理问题。

问题：commit() 后调用 refresh() 可能因数据库连接已关闭而失败，但当前没有捕获这个异常。

修复方案：
1. 在 commit() 和 refresh() 之间添加 try-catch
2. 如果 refresh 失败，记录警告日志但不要回滚（数据已提交）
3. 添加重试逻辑（最多重试 1 次）

示例：
```python
try:
    db.commit()
    try:
        db.refresh(bridge)
    except Exception as e:
        logger.warning(f"Failed to refresh bridge after commit: {e}")
except Exception as e:
    db.rollback()
    logger.error(f"Failed to create bridge: {e}")
    raise
```
```

---

## 🔴 P0-3: WebSocket 消息类型转换不安全

**提示词：**

```
请修复 /root/.openclaw/workspace/agent-orchestration/remote-agent-bridge/src/ws-client.ts 中 onMessage 回调里的不安全类型转换问题。

问题：消息处理中使用 `as unknown as Type` 进行类型断言，如果服务端返回的数据格式不符合预期，不会在编译期或运行时报错，可能导致后续逻辑异常。

修复方案：
1. 添加运行时类型校验函数
2. 对关键消息类型（auth response、task dispatch、heartbeat）进行结构校验
3. 校验失败时记录错误并丢弃消息（不中断连接）

示例：
```typescript
function validateAuthResponse(data: unknown): { success: boolean; bridgeId?: string; error?: string } | null {
    if (typeof data !== 'object' || data === null) return null;
    const obj = data as Record<string, unknown>;
    if (typeof obj.success !== 'boolean') return null;
    return {
        success: obj.success,
        bridgeId: typeof obj.bridgeId === 'string' ? obj.bridgeId : undefined,
        error: typeof obj.error === 'string' ? obj.error : undefined,
    };
}
```

请为以下消息类型都添加校验：
- 认证响应 (auth_response)
- 任务分发 (task_dispatch)
- 心跳响应 (heartbeat_ack)
- 错误消息 (error)
```

---

## 🔴 P0-4: HTTP POST /api/v1/tasks 任务未入队（功能 Bug）

**提示词：**

```
请修复 /root/.openclaw/workspace/agent-orchestration/remote-agent-bridge/src/http-server.ts 中 POST /api/v1/tasks 接口的任务入队问题。

问题：当前代码在创建 task 对象后直接返回 202 响应，但没有将任务实际提交到 bridge 的任务队列中。导致通过 HTTP API 提交的任务永远不会被执行。

修复方案：
在创建 task 对象后、返回响应前，调用 bridge.submitTask() 将任务入队。

示例：
```typescript
this.app.post('/api/v1/tasks', (req: Request, res: Response) => {
    // ... 验证和创建 task ...
    
    try {
        if (this.bridge) {
            this.bridge.submitTask(task);
        } else {
            logger.error('Bridge not initialized, cannot submit task');
            return res.status(503).json({ success: false, error: 'Bridge not initialized' });
        }
    } catch (error) {
        logger.error('Failed to submit task to bridge', { error, taskId });
        return res.status(500).json({ success: false, error: 'Failed to submit task' });
    }
    
    res.status(202).json({ success: true, data: { taskId, status: 'queued' } });
});
```

请确认 bridge.submitTask() 方法的签名是否与 task 对象兼容，如不兼容请适当转换。
```

---

## 🟡 P1-1: SessionLocal 会话池泄漏

**提示词：**

```
请修复 /root/.openclaw/workspace/agent-orchestration/backend/app/services/gateway/task_router.py 中 _schedule_ack_timeout 方法的数据库会话管理问题。

问题：_schedule_ack_timeout 中使用 SessionLocal() 创建独立会话，但如果大量任务同时超时，可能会耗尽数据库连接池。且当前没有使用 context manager 保证会话关闭。

修复方案：
1. 使用 `with SessionLocal() as db:` 确保会话自动关闭
2. 添加连接池配置（如果 SQLAlchemy 还没配置）
3. 添加会话获取失败的错误处理

示例：
```python
def _schedule_ack_timeout(self, task_id: str, timeout_seconds: int = 30):
    async def timeout_callback():
        await asyncio.sleep(timeout_seconds)
        try:
            with SessionLocal() as db:
                task = db.query(Task).filter(Task.id == task_id).first()
                if task and task.status == 'pending':
                    task.status = 'timeout'
                    db.commit()
        except Exception as e:
            logger.error(f"ACK timeout check failed for task {task_id}: {e}")
    
    asyncio.create_task(timeout_callback())
```
```

---

## 🟡 P1-3: 沙箱命令检查可绕过

**提示词：**

```
请修复 /root/.openclaw/workspace/agent-orchestration/remote-agent-bridge/src/security/sandbox.ts 中的命令白名单绕过问题。

问题：当前仅匹配命令基名（parts[0]），攻击者可通过以下方式绕过：
- `./sudo` — 使用相对路径
- `/usr/bin/rm` — 使用绝对路径
- `sudo\ rm` — 使用转义字符

修复方案：
1. 对命令进行路径规范化后再检查
2. 使用 path.basename() 提取命令名
3. 检查是否包含路径分隔符，如有则拒绝

示例：
```typescript
import * as path from 'path';

function validateCommand(cmd: string): boolean {
    const normalized = path.normalize(cmd);
    const baseName = path.basename(normalized);
    
    // 如果命令包含路径分隔符，只取基名检查
    // 但同时拒绝明显的路径注入
    if (normalized !== baseName && !isAllowedPath(normalized)) {
        return false;
    }
    
    return ALLOWED_COMMANDS.has(baseName);
}
```

请同时检查是否有其他类似的命令注入点。
```

---

## 🟡 P1-5: WebSocket 连接数据库会话泄漏

**提示词：**

```
请修复 /root/.openclaw/workspace/agent-orchestration/backend/app/routers/gateway.py 中 WebSocket 连接处理函数的数据库会话泄漏问题。

问题：WebSocket handler 中使用 `db = next(get_db())` 获取会话，然后在 handler 结束时手动 `db.close()`。但如果中间抛出异常，db.close() 可能不会被执行，导致连接泄漏。

修复方案：
使用 try-finally 确保会话关闭：

```python
@router.websocket("/ws/{bridge_id}")
async def websocket_endpoint(websocket: WebSocket, bridge_id: str):
    await websocket.accept()
    db = next(get_db())
    try:
        # ... WebSocket 处理逻辑 ...
    finally:
        db.close()
```

或者使用 contextlib.closing / asynccontextmanager 模式。
```

---

## 🟡 P1-2: BridgeManager 构造函数陈旧 DB 引用

**提示词：**

```
请修复 /root/.openclaw/workspace/agent-orchestration/backend/app/services/gateway/bridge_manager.py 中的 DB 连接陈旧引用问题。

问题：BridgeManager 在构造时接收 db 参数并存储为实例属性。如果作为全局单例使用，数据库连接可能已经失效，但 BridgeManager 仍然持有旧引用。

修复方案：
1. 不在构造函数中持有 db 引用，改为每次操作时通过 SessionLocal() 创建新会话
2. 或者添加连接有效性检查方法
3. 如果必须持有引用，添加 reconnect 逻辑

推荐方案：
```python
class BridgeManager:
    def __init__(self):
        # 不再持有 db 引用
        pass
    
    def get_bridges(self):
        """每次操作创建新会话"""
        with SessionLocal() as db:
            return db.query(GatewayBridge).filter(GatewayBridge.status == 'active').all()
```
```

---

## 🟡 P1-4: database.ts 参数命名不一致

**提示词：**

```
请修复 /root/.openclaw/workspace/agent-orchestration/remote-agent-bridge/src/database.ts 中 listTasks() 方法的参数命名不一致问题。

问题：方法内部使用 options['status'] 字典式访问，而其他方法使用 params.status 对象属性式访问。命名风格不一致影响可维护性。

修复方案：
统一使用对象属性式访问：
```typescript
interface ListTasksOptions {
    status?: string;
    agentType?: string;
    limit?: number;
    offset?: number;
}

listTasks(options: ListTasksOptions = {}) {
    const { status, agentType, limit = 50, offset = 0 } = options;
    // ...
}
```
```

---

## 使用说明

1. **优先级顺序**：先处理 P0（4个），再处理 P1（5个）
2. **建议分批执行**：每个提示词单独执行，确认修复后再处理下一个
3. **验证**：每修复一个问题后，建议运行项目的类型检查和构建
   - Python: `cd backend && python -m py_compile app/routers/gateway.py`
   - TypeScript: `cd remote-agent-bridge && npx tsc --noEmit`
4. **测试**：P0 修复完成后，建议编写对应的单元测试
