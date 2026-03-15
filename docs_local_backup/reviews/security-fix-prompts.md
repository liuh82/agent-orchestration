# 安全审计修复提示词（用于本地 Claude Code）

按优先级排列，直接复制粘贴到本地 Claude Code 执行。

---

## 🔴 P0-1: 命令注入 — cli-adapter.ts

**提示词：**

```
请修复 remote-agent-bridge/src/adapters/cli-adapter.ts 中的命令注入漏洞。

问题：
1. 第 94-103 行，当 agentType 不在 AGENT_MAPPINGS 中时，request.agentType 直接作为命令执行
2. request.prompt 通过 split(' ') 直接作为参数传递，可注入恶意命令如 "; rm -rf /"

修复方案：

1. 添加严格的 agentType 白名单校验：
```typescript
const ALLOWED_AGENT_TYPES = Object.keys(AGENT_MAPPINGS);

// 在执行前校验
if (request.agentType && !ALLOWED_AGENT_TYPES.includes(request.agentType)) {
  throw new Error(`Forbidden agent type: ${request.agentType}. Allowed: ${ALLOWED_AGENT_TYPES.join(', ')}`);
}
```

2. 对 prompt 参数进行 shell 转义：
```typescript
// 安装 shell-escape: npm install shell-escape && npm install -D @types/shell-escape
import shellEscape from 'shell-escape';

// 使用转义后的参数
const escapedArgs = shellEscape([request.prompt]);
```

3. 同时在 sandbox.ts 的 validateCommand 中添加检查，确保执行的命令不在黑名单中。

4. 为 cli-adapter.ts 添加对应的单元测试，覆盖：
   - 正常 agentType 执行
   - 非法 agentType 被拒绝
   - 包含 shell 元字符的 prompt 被正确转义
   - 空白 agentType 和 prompt 的边界情况
```

---

## 🔴 P0-2: API Key 硬编码默认值 — auth.py

**提示词：**

```
请修复 backend/app/auth.py 中的 API Key 默认值安全问题。

问题：第 12-19 行，当环境变量未设置 API_KEYS 时，使用硬编码默认 Key "dev-api-key-please-change-in-production"，攻击者可直接用此 Key 访问生产 API。

修复方案：

```python
import os
import sys

def _load_api_keys() -> set[str]:
    """Load API keys from environment variables."""
    keys = set()
    raw = os.getenv("API_KEYS", "")
    if raw:
        for key in raw.split(","):
            key = key.strip()
            if key:
                keys.add(key)
    
    if not keys:
        env = os.getenv("ENVIRONMENT", "development").lower()
        if env in ("production", "prod", "staging"):
            raise RuntimeError(
                "FATAL: API_KEYS environment variable must be set in production/staging environment. "
                "Example: export API_KEYS='key1,key2,key3'"
            )
        # Development only
        keys.add("dev-api-key-local-only")
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            "⚠️  Running with INSECURE default API key. "
            "This is acceptable ONLY in local development. "
            "Set API_KEYS env var for any shared environment."
        )
    
    return keys

API_KEYS = _load_api_keys()
```

关键点：
- 生产环境（ENVIRONMENT=production/staging）必须设置 API_KEYS，否则启动报错退出
- 开发环境允许默认值，但打印明显警告
- 支持逗号分隔的多个 Key
```

---

## 🔴 P0-3: 依赖漏洞 — minimatch ReDoS + esbuild + vite

**提示词：**

```
请修复项目的依赖安全漏洞。

问题（npm audit 报告）：
1. remote-agent-bridge: minimatch 9.0.0-9.0.6 存在 ReDoS 高危漏洞
2. remote-agent-bridge: @typescript-eslint/* 受 minimatch 影响
3. remote-agent-bridge: @inquirer/prompts <=6.0.1 临时文件风险
4. frontend: @types/xlsx 安全风险
5. frontend: esbuild <=0.24.2 开发服务器风险
6. frontend: vite 依赖 esbuild 受影响

修复步骤：

```bash
# 1. 修复 remote-agent-bridge
cd remote-agent-bridge
npm update minimatch@latest
npm update @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest
npm update @inquirer/prompts@latest
npm audit  # 确认无高危漏洞

# 2. 修复 frontend
cd ../frontend
npm uninstall @types/xlsx  # 如果项目不使用 xlsx 类型定义
npm update vite@latest
npm audit  # 确认无高危漏洞

# 3. 如果 update 无法解决，尝试：
npm install minimatch@">=9.0.7"
npm install vite@">=6.1.7"
```

修复后运行：
```bash
cd remote-agent-bridge && npx tsc --noEmit  # 确保编译通过
cd ../frontend && npx tsc --noEmit           # 确保编译通过
```
```

---

## 🟡 P1-1: 路径遍历 — cli-adapter.ts

**提示词：**

```
请修复 remote-agent-bridge/src/adapters/cli-adapter.ts 中的路径遍历漏洞。

问题：第 85 行 request.cwd 未校验，攻击者可传入 "../../../../etc" 等恶意路径，在任意目录执行命令。

修复方案：

1. 添加路径校验函数：
```typescript
import { resolve, normalize, isAbsolute } from 'path';

interface CliAdapterConfig {
  // 新增允许的工作目录列表
  allowedBasePaths?: string[];
  // ... 其他配置
}

const DEFAULT_ALLOWED_PATHS = ['/home', '/workspace', '/projects', '/tmp'];

function validateCwd(cwd: string, allowedPaths: string[] = DEFAULT_ALLOWED_PATHS): string {
  if (!cwd || typeof cwd !== 'string') {
    throw new Error('Working directory is required');
  }
  
  const resolved = resolve(normalize(cwd));
  
  // 必须是绝对路径
  if (!isAbsolute(resolved)) {
    throw new Error(`Path must be absolute: ${cwd}`);
  }
  
  // 必须在允许的基础路径下
  if (!allowedPaths.some(base => resolved.startsWith(resolve(base)))) {
    throw new Error(`Path not allowed: ${cwd}. Allowed bases: ${allowedPaths.join(', ')}`);
  }
  
  return resolved;
}
```

2. 在执行命令前调用校验：
```typescript
const safeCwd = validateCwd(request.cwd, this.config.allowedBasePaths);
```

3. 在配置文件中添加 allowedBasePaths 选项，允许管理员自定义。

4. 添加单元测试覆盖路径遍历场景。
```

---

## 🟡 P1-2: 越权断开 Bridge — gateway.py

**提示词：**

```
请修复 backend/app/routers/gateway.py 中的越权操作风险。

问题：第 175-179 行，POST /bridges/{bridge_id}/disconnect 接口，任何有效的 API Key 都可以断开任意 Bridge，缺少权限细分。

修复方案：

1. 在 auth.py 中添加角色概念：
```python
import os

# Admin API keys (逗号分隔)
ADMIN_API_KEYS = set()
raw_admin = os.getenv("ADMIN_API_KEYS", "")
if raw_admin:
    ADMIN_API_KEYS = {k.strip() for k in raw_admin.split(",") if k.strip()}

def verify_admin_key(api_key: str = Depends(verify_api_key)) -> str:
    """验证管理员权限。"""
    if ADMIN_API_KEYS and api_key not in ADMIN_API_KEYS:
        raise HTTPException(
            status_code=403,
            detail="Admin access required for this operation"
        )
    return api_key
```

2. 对敏感操作添加 admin 校验：
```python
from backend.app.auth import verify_admin_key

@router.post("/bridges/{bridge_id}/disconnect")
async def force_disconnect_bridge(
    bridge_id: str,
    _api_key: str = Depends(verify_admin_key),  # 改用 admin 校验
):
    # ...
```

3. 将以下接口都改为 admin only：
   - POST /bridges/{bridge_id}/disconnect（断开连接）
   - DELETE /bridges/{bridge_id}（删除 Bridge）
   - 任何涉及全局配置修改的接口

4. 在 README 或配置文档中说明 ADMIN_API_KEYS 的使用方式。
```

---

## 🟡 P1-3: 缺少 Rate Limiting

**提示词：**

```
请为 backend 添加 Rate Limiting，防止 API 滥用和拒绝服务攻击。

问题：gateway.py 中所有 API 端点均无请求频率限制。

修复方案：

1. 安装依赖：
```bash
cd backend
pip install slowapi
```

2. 在 main.py 中注册 limiter：
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

3. 在 gateway.py 中为各端点添加限制：
```python
from backend.main import limiter  # 或从依赖注入获取

@router.post("/tasks")
@limiter.limit("10/minute")  # 每分钟 10 次
async def submit_task(request: Request, ...):
    ...

@router.get("/bridges")
@limiter.limit("30/minute")
async def list_bridges(request: Request, ...):
    ...

@router.websocket("/ws")  # WebSocket 不支持 limiter，用连接数限制
async def gateway_ws(websocket: WebSocket, ...):
    # 在 ws_server.py 中限制最大连接数
```

4. 在 ws_server.py 中添加 WebSocket 连接数限制：
```python
MAX_WS_CONNECTIONS = 100

class WebSocketServer:
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}
    
    async def connect(self, bridge_id: str, websocket: WebSocket) -> bool:
        if len(self.connections) >= MAX_WS_CONNECTIONS:
            await websocket.close(code=4003, reason="Max connections reached")
            return False
        await websocket.accept()
        self.connections[bridge_id] = websocket
        return True
```

5. 在 requirements.txt 中添加 slowapi。
```

---

## 🟠 P2-1: Token URL 传递风险（建议优化）

**提示词：**

```
请优化 backend/app/routers/gateway.py 中 WebSocket 的 Token 传递方式。

问题：当前 Token 通过 URL Query 参数传递（?token=xxx），可能被服务器访问日志、代理日志记录。

修复方案（二选一）：

方案 A — 首条消息认证：
```python
@router.websocket("/ws")
async def gateway_ws(websocket: WebSocket):
    await websocket.accept()
    
    # 等待首条消息作为认证
    try:
        auth_msg = await asyncio.wait_for(websocket.receive_json(), timeout=5.0)
        if auth_msg.get("type") != "auth" or not verify_gateway_token(auth_msg.get("token", "")):
            await websocket.send_json({"type": "error", "message": "Authentication failed"})
            await websocket.close(code=4001)
            return
    except (asyncio.TimeoutError, Exception):
        await websocket.close(code=4001)
        return
    
    # 认证成功，开始正常通信
    bridge_id = auth_msg.get("bridgeId")
    # ...
```

方案 B — 保持 URL 传递但在 Nginx/代理层过滤日志：
```nginx
# Nginx 配置
location /api/v1/gateway/ws {
    proxy_pass http://backend;
    proxy_set_header X-Real-IP $remote_addr;
    # 关闭查询参数日志
    access_log /var/log/nginx/gateway.log combined if=$loggable;
    set $loggable 0;  # 不记录 WS 连接日志
}
```

推荐方案 A，更安全。
```

---

## 🟠 P2-2: DB Session 长连接优化（建议优化）

**提示词：**

```
请优化 backend/app/routers/gateway.py 中 WebSocket 处理函数的数据库 Session 管理。

问题：第 246-289 行，WebSocket 长连接中持续持有单个 DB Session，可能导致连接池耗尽。

修复方案：

改为按需创建短生命周期 Session，而非长连接持有：

```python
@router.websocket("/ws")
async def gateway_ws(websocket: WebSocket, ...):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            
            # 按需创建 Session，用完即关
            db = next(get_db())
            try:
                result = await handle_message(db, data)
                await websocket.send_json(result)
            finally:
                db.close()
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {bridge_id}")
    finally:
        # 清理连接
        if bridge_id and ws_server:
            await ws_server.disconnect(bridge_id)
```

如果需要跨消息保持事务，可以使用 session maker 的 scoped_session 模式，但WebSocket 场景建议尽量短连接。
```

---

## 使用说明

1. **执行顺序**：先 P0（3个）→ P1（3个）→ P2 按需
2. **每条提示词单独执行**，确认修复后再处理下一个
3. **P0 修复后**运行构建验证：
   ```bash
   cd backend && python -m py_compile app/main.py && python -m py_compile app/auth.py
   cd remote-agent-bridge && npx tsc --noEmit && npm audit
   ```
4. **全部修复后**提交代码：
   ```bash
   git add -A && git commit -m "fix: 修复安全审计P0/P1问题
   
   - 修复 cli-adapter 命令注入和路径遍历
   - 修复 auth.py API Key 默认值风险
   - 更新依赖修复 minimatch ReDoS 和 vite 漏洞
   - 添加越权操作权限控制
   - 添加 Rate Limiting 和 WebSocket 连接数限制
   - 优化 Token 传递和 DB Session 生命周期" && git push origin main
   ```
