# Security Audit Report - agent-orchestration

**审计日期**: 2026-03-14  
**审计范围**: commit 346080a..291c1ab (P0/P1 代码审查问题修复)  
**审计员**: Security Agent (小狸)  
**项目版本**: 0.1.0

---

## 整体安全评级

| 维度 | 评级 | 说明 |
|------|------|------|
| 注入攻击 | 🟡 中等风险 | 存在命令注入和路径遍历风险 |
| 认证授权 | 🟠 中等风险 | API Key 管理存在生产环境隐患 |
| 数据安全 | 🟡 中等风险 | 敏感数据可能泄露到日志 |
| 输入验证 | 🟢 良好 | 消息结构验证较完善 |
| 依赖安全 | 🔴 高风险 | 存在多个高危依赖漏洞 |
| 拒绝服务 | 🟡 中等风险 | 缺少 Rate Limiting |
| 竞态条件 | 🟢 良好 | 使用了锁机制和原子操作 |

**综合评级**: 🟡 **中等风险** - 建议修复 Critical 和 High 级别问题后上线

---

## 1. 注入攻击审计

### 1.1 命令注入 🔴 Critical

**文件**: `remote-agent-bridge/src/adapters/cli-adapter.ts`  
**位置**: L94-L103

```typescript
const mapping = AGENT_MAPPINGS[request.agentType];

if (mapping) {
  command = mapping.command;
  args = mapping.args(request.prompt);
} else {
  command = request.agentType;  // ⚠️ 危险：直接使用用户输入
  args = request.prompt.split(' ');  // ⚠️ 危险：未转义
}
```

**风险**: 
- `request.agentType` 可被攻击者控制，直接作为命令执行
- `request.prompt` 通过 `split(' ')` 直接作为参数传递，可注入恶意命令

**修复建议**:
```typescript
// 1. 严格校验 agentType
const ALLOWED_AGENTS = ['codex', 'pi', 'acp', 'npm', 'npx'];
if (!ALLOWED_AGENTS.includes(request.agentType)) {
  throw new Error(`Invalid agent type: ${request.agentType}`);
}

// 2. 对 prompt 进行参数转义
import { escapeShellArg } from 'shell-escape';
args = request.prompt.split(' ').map(escapeShellArg);
```

---

### 1.2 路径遍历 🟡 High

**文件**: `remote-agent-bridge/src/adapters/cli-adapter.ts`  
**位置**: L85-L86

```typescript
const options = {
  cwd: request.cwd,  // ⚠️ 未校验路径
```

**风险**: 
- `request.cwd` 可能为 `../../../../etc` 等恶意路径
- 可能导致任意目录命令执行

**修复建议**:
```typescript
import { resolve, normalize } from 'path';

const ALLOWED_BASE_PATHS = ['/home', '/workspace', '/projects'];

function validateCwd(cwd: string): string {
  const resolved = resolve(normalize(cwd));
  if (!ALLOWED_BASE_PATHS.some(p => resolved.startsWith(p))) {
    throw new Error(`Path not allowed: ${cwd}`);
  }
  return resolved;
}
```

---

### 1.3 SQL 注入 🟢 良好

**文件**: `remote-agent-bridge/src/database.ts`, `backend/app/services/gateway/db_gateway.py`

**结论**: 使用参数化查询，SQL 注入风险低。

```typescript
// database.ts - 使用命名参数
const stmt = this.prepare('SELECT * FROM tasks WHERE id = @id');
stmt.get({ id });
```

```python
# db_gateway.py - 使用 SQLAlchemy ORM
select(TaskRecord).where(TaskRecord.bridge_id == bridge_id)
```

---

### 1.4 XSS 🟢 不适用

**结论**: 本项目为后端 API 服务，不涉及前端 HTML 渲染。

---

## 2. 认证授权审计

### 2.1 API Key 默认值 🔴 Critical

**文件**: `backend/app/auth.py`  
**位置**: L12-L19

```python
if not API_KEYS:
    DEV_API_KEY = os.getenv("DEV_API_KEY", "dev-api-key-please-change-in-production")
    API_KEYS.add(DEV_API_KEY)
    logger.warning("Using default dev API key...")
```

**风险**:
- 生产环境若未设置环境变量，将使用硬编码的默认 Key
- 攻击者可直接使用默认 Key 访问 API

**修复建议**:
```python
if not API_KEYS:
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise RuntimeError("API_KEYS must be set in production!")
    DEV_API_KEY = "dev-api-key-only-for-dev"
    API_KEYS.add(DEV_API_KEY)
    logger.warning("DEV MODE: Using insecure default API key")
```

---

### 2.2 WebSocket 认证 🟡 Medium

**文件**: `backend/app/routers/gateway.py`  
**位置**: L191-L195

```python
@router.websocket("/ws")
async def gateway_ws(
    websocket: WebSocket,
    token: str = Query(..., description="API Key for authentication"),
):
    if not verify_gateway_token(token):
        await websocket.close(code=4001, reason="Unauthorized")
```

**问题**:
- Token 通过 URL Query 参数传递，可能被日志记录
- 无 Token 过期机制

**修复建议**:
```python
# 1. Token 应通过 WebSocket 首条消息传递而非 URL
# 2. 实现 JWT Token 带过期时间
# 3. 日志中过滤敏感参数
```

---

### 2.3 越权风险 🟡 Medium

**文件**: `backend/app/routers/gateway.py`  
**位置**: L175-L179

```python
@router.post("/bridges/{bridge_id}/disconnect")
async def force_disconnect_bridge(
    bridge_id: str,
    _api_key: str = Depends(verify_api_key),
):
```

**问题**:
- 任何有效的 API Key 都可以断开任意 Bridge
- 缺少角色/权限细分

**修复建议**:
```python
# 实现角色检查
async def verify_admin(api_key: str = Depends(verify_api_key)):
    if not is_admin(api_key):
        raise HTTPException(403, "Admin only")
    return api_key

@router.post("/bridges/{bridge_id}/disconnect", dependencies=[Depends(verify_admin)])
```

---

## 3. 数据安全审计

### 3.1 敏感信息泄露到日志 🟡 Medium

**文件**: `remote-agent-bridge/src/ws-client.ts`  
**位置**: L111-L118

```typescript
const authData = {
  token: this.config.token,  // ⚠️ Token 可能被日志记录
  bridgeId: this.config.bridgeId,
  // ...
};
logger.debug('Auth request sent');  // 好的：没有直接记录 token
```

**潜在问题**: 在错误堆栈中可能暴露 token

**修复建议**:
```typescript
// 在 logger 配置中添加敏感字段过滤
const SENSITIVE_FIELDS = ['token', 'password', 'apiKey'];
function sanitizeLogData(data: any) {
  // 递归替换敏感字段
}
```

---

### 3.2 输出过滤 🟢 良好

**文件**: `remote-agent-bridge/src/security/sandbox.ts`  
**位置**: L97-L115

```typescript
sanitizeOutput(output: string): string {
  const tokenRegex = /(token|api[_-]?key|password|secret)[:=]\s*[^\s"']+/gi;
  sanitized = sanitized.replace(tokenRegex, (match) => {
    // 替换敏感信息为 ***
  });
}
```

**结论**: 已实现输出敏感信息过滤，良好实践。

---

### 3.3 数据库安全 🟢 良好

**文件**: `remote-agent-bridge/src/database.ts`  
**位置**: L36-L38

```typescript
this.db.pragma('journal_mode = WAL');
this.db.pragma('busy_timeout = 5000');
this.db.pragma('foreign_keys = ON');
```

**结论**: SQLite 配置合理，启用了外键约束和 WAL 模式。

---

## 4. 输入验证审计

### 4.1 消息结构验证 🟢 良好

**文件**: `remote-agent-bridge/src/ws-client.ts`  
**位置**: L20-L99

```typescript
function validateTaskSubmit(data: unknown): ValidatedTaskSubmit | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  const taskId = obj['taskId'];
  if (typeof taskId !== 'string' || !taskId) return null;
  // ... 完整的类型检查
}
```

**结论**: 实现了完整的运行时消息验证，良好实践。

---

### 4.2 沙箱安全检查 🟢 良好

**文件**: `remote-agent-bridge/src/security/sandbox.ts`  
**位置**: L15-L45, L73-L95

```typescript
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+[\/~]/i,
  /\bsudo\b/i,
  // ... 危险命令模式
];

validateCommand(command: string): { allowed: boolean; reason?: string } {
  // 路径注入检测
  const normalized = path.normalize(rawCmd);
  const baseName = path.basename(normalized);
  const isPathAttempt = normalized !== baseName;
  // ...
}
```

**结论**: 实现了多层安全检查，包括：
- 危险命令模式匹配
- 路径注入检测
- Prompt 危险关键词检测

**改进建议**: 添加更多危险模式，如 `eval`, `exec`, `curl | bash` 等

---

## 5. 依赖安全审计

### 5.1 Remote Agent Bridge 依赖漏洞 🔴 Critical

```
┌─────────────────────────────────┬──────────┬─────────────────────────────────┐
│ 依赖包                           │ 严重度   │ 漏洞说明                         │
├─────────────────────────────────┼──────────┼─────────────────────────────────┤
│ minimatch 9.0.0 - 9.0.6         │ 🔴 High  │ ReDoS 正则表达式拒绝服务         │
│ @typescript-eslint/* 6.16-7.5   │ 🔴 High  │ 依赖 minimatch 受影响            │
│ @inquirer/prompts <=6.0.1       │ 🔵 Low   │ 依赖 tmp 存在临时文件风险        │
└─────────────────────────────────┴──────────┴─────────────────────────────────┘
```

**修复命令**:
```bash
cd remote-agent-bridge
npm update minimatch@latest
npm update @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest
npm update @inquirer/prompts@latest
```

---

### 5.2 Frontend 依赖漏洞 🔴 High

```
┌─────────────────────────────────┬──────────┬─────────────────────────────────┐
│ 依赖包                           │ 严重度   │ 漏洞说明                         │
├─────────────────────────────────┼──────────┼─────────────────────────────────┤
│ @types/xlsx >=0.0.36            │ 🔴 High  │ 依赖 xlsx 存在安全风险           │
│ esbuild <=0.24.2                │ 🟠 Med   │ 开发服务器任意请求风险           │
│ vite 0.11.0 - 6.1.6             │ 🟠 Med   │ 依赖 esbuild 受影响              │
└─────────────────────────────────┴──────────┴─────────────────────────────────┘
```

**修复命令**:
```bash
cd frontend
npm uninstall @types/xlsx  # 如不需要
npm update vite@latest
```

---

### 5.3 Backend Python 依赖 🟢 良好

```
fastapi==0.104.1       # 较新版本，无已知高危漏洞
sqlalchemy==2.0.23     # 较新版本
pydantic>=2.10.0       # 较新版本
```

**建议**: 定期运行 `pip-audit` 检查 Python 依赖

---

## 6. 拒绝服务审计

### 6.1 缺少 Rate Limiting 🟡 Medium

**文件**: `backend/app/routers/gateway.py`  
**位置**: 全局

**问题**: 所有 API 端点均未实现 Rate Limiting

**风险**:
- API 可被暴力调用
- WebSocket 连接可被无限建立

**修复建议**:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/tasks")
@limiter.limit("10/minute")
async def submit_task(...):
```

---

### 6.2 请求体大小限制 🟢 良好

**文件**: `remote-agent-bridge/src/http-server.ts`  
**位置**: L37

```typescript
this.app.use(express.json({ limit: '1mb' }));
this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```

**结论**: 已设置请求体大小限制。

---

### 6.3 并发连接限制 🟡 Medium

**文件**: `backend/app/services/gateway/bridge_manager.py`

**问题**: WebSocket 连接数无上限

**修复建议**:
```python
MAX_CONNECTIONS = 100

async def register(self, bridge_id: str, websocket: WebSocket) -> None:
    if len(self.active_connections) >= MAX_CONNECTIONS:
        await websocket.close(code=4003, reason="Max connections reached")
        return
    # ...
```

---

### 6.4 任务队列限制 🟢 良好

**文件**: `remote-agent-bridge/src/task-runner.ts`  
**位置**: L13

```typescript
private maxConcurrent: number;

constructor(taskQueue: TaskQueue, maxConcurrent = 3) {
  this.maxConcurrent = maxConcurrent;
}
```

**结论**: 实现了并发任务数限制。

---

## 7. 竞态条件审计

### 7.1 BridgeManager 单例锁 🟢 良好

**文件**: `backend/app/routers/gateway.py`  
**位置**: L22-L37

```python
_bridge_manager_lock = threading.Lock()

def get_bridge_manager(db: Session, gw_db: GatewayDB) -> BridgeManager:
    global _bridge_manager
    if _bridge_manager is None:
        with _bridge_manager_lock:  # 双重检查锁
            if _bridge_manager is None:
                _bridge_manager = BridgeManager(db, gw_db)
    return _bridge_manager
```

**结论**: 使用双重检查锁保证单例线程安全。

---

### 7.2 DB Session 生命周期 🟡 Medium

**文件**: `backend/app/routers/gateway.py`  
**位置**: L246-L289

```python
ws_db: Optional[Session] = None
try:
    while True:
        # ...
        ws_db = next(get_db())  # WebSocket 生命周期内持有 session
```

**问题**: WebSocket 长连接持有 DB Session，可能导致连接池耗尽

**修复建议**:
```python
# 使用短生命周期 session，按需创建
def get_fresh_db():
    with SessionLocal() as db:
        yield db
```

---

### 7.3 心跳检查异步任务 🟢 良好

**文件**: `backend/app/routers/gateway.py`  
**位置**: L304-L314

```python
async def _heartbeat_checker(websocket: WebSocket, bridge_id: str, interval: int = 30):
    while True:
        await asyncio.sleep(interval)
        try:
            await websocket.send_json({"type": "ping"})
        except Exception:
            if ws_server:
                await ws_server.disconnect(bridge_id)
            break
```

**结论**: 心跳检查有异常处理和清理逻辑。

---

## 8. 修复优先级汇总

| 优先级 | 问题 | 文件 | 状态 |
|--------|------|------|------|
| 🔴 P0 | 命令注入风险 | cli-adapter.ts | 待修复 |
| 🔴 P0 | API Key 默认值 | auth.py | 待修复 |
| 🔴 P0 | minimatch ReDoS | package.json | 待修复 |
| 🟡 P1 | 路径遍历风险 | cli-adapter.ts | 待修复 |
| 🟡 P1 | 越权断开 Bridge | gateway.py | 待修复 |
| 🟡 P1 | 缺少 Rate Limiting | gateway.py | 待修复 |
| 🟠 P2 | Token URL 传递 | gateway.py | 建议优化 |
| 🟠 P2 | WebSocket 连接数限制 | ws_server.py | 建议优化 |
| 🟠 P2 | DB Session 生命周期 | gateway.py | 建议优化 |

---

## 9. 安全加固建议

### 9.1 立即修复 (P0)

```bash
# 1. 更新依赖
cd remote-agent-bridge && npm update minimatch@latest
cd frontend && npm update vite@latest

# 2. 强制生产环境配置 API Key
export API_KEYS="your-secure-key-here"
export ENVIRONMENT="production"
```

### 9.2 短期改进 (P1)

1. 实现命令白名单和严格校验
2. 添加路径遍历防护
3. 实现 Rate Limiting
4. 细化权限控制

### 9.3 长期建议 (P2)

1. 迁移到 JWT Token 认证
2. 实现审计日志持久化
3. 添加安全监控告警
4. 定期安全扫描自动化

---

## 10. 审计结论

agent-orchestration 项目整体安全架构设计合理，已实现了多层安全防护：

**优点**:
- ✅ 使用参数化查询防止 SQL 注入
- ✅ 实现了沙箱安全检查
- ✅ 运行时消息验证完整
- ✅ 输出敏感信息过滤
- ✅ 使用锁机制保证线程安全

**需改进**:
- ❌ CLI Adapter 存在命令注入风险
- ❌ 生产环境默认 API Key 风险
- ❌ 多个依赖存在高危漏洞
- ❌ 缺少 Rate Limiting

**建议**: 修复 P0 级别问题后可上线，P1/P2 问题建议在后续迭代中逐步解决。

---

*报告生成时间: 2026-03-14*  
*审计员: Security Agent (小狸) 🧸*
