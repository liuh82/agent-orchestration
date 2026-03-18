# 迭代三 T3：安全审计 3 项修复

## 背景
安全审计发现 3 个问题需要修复。本 prompt 处理全部 3 项。

## 修复 1：后端命令注入防护（code_node.py）

**问题**：`code_node.py` 执行用户提供的代码，虽然用了 `create_subprocess_exec`（不用 shell=True，相对安全），但缺少沙箱隔离。用户代码可以访问服务器文件系统和网络。

**修复方案**：在代码执行前添加安全限制：

1. 在 Python 代码执行前注入环境变量限制：
```python
import os
exec_env = {
    "HOME": "/tmp/code_exec",
    "PATH": "/usr/bin:/bin",
    "PYTHONPATH": "",
    "PYTHONSTARTUP": "",
}
# 移除可能导致提权的环境变量
for key in list(os.environ.keys()):
    if key.startswith(("AWS_", "GITHUB_", "GITLAB_", "DOCKER_", "KUBE_")):
        os.environ.pop(key, None)
```

2. 在 JavaScript 代码执行中添加 `--no-warnings` 和资源限制（如果 Node.js 支持）：
```python
proc = await asyncio.create_subprocess_exec(
    "node", "--no-warnings", tmp_path,
    stdout=asyncio.subprocess.PIPE,
    stderr=asyncio.subprocess.PIPE,
    env=exec_env,  # 限制环境变量
)
```

3. 代码执行前清理环境，执行后恢复：
```python
old_env = os.environ.copy()
# ... 注入受限环境 ...
proc = await asyncio.create_subprocess_exec(..., env=exec_env)
# ... 执行后恢复（不需要，因为 env 参数不影响 os.environ）
```

4. 添加执行超时保护（已有 timeout 参数，确认正常工作）
5. 添加文件大小限制（写入临时文件时代码不超过 100KB）

**需要修改的文件**：`backend/app/services/workflow_engine/nodes/code_node.py`

## 修复 2：Refresh Token 存储优化

**现状分析**：
- 当前 Token 已经用 SHA-256 hash 存储（`_hash_token` 函数）
- `UserSessionToken` 模型存储 `token_hash` 而非明文
- 这**已经是最佳实践**，不需要修改

**确认**：审计时可能是误报或看到的是旧版本代码。请确认 `app/services/auth.py` 中的实现：
- `store_refresh_token` 存储 `token_hash=_hash_token(raw_token)` ✅
- `revoke_refresh_token` 通过 hash 查找 ✅
- `is_token_revoked` 通过 hash 查找 ✅

**如果已确认安全，跳过此项，在修复说明中注明"已验证安全，无需修改"。**

## 修复 3：前端依赖漏洞更新

**问题**：vite 8.0.0 和 @vitejs/plugin-react 6.0.1 可能有已知漏洞。

**修复方案**：
```bash
cd frontend && npm update vite @vitejs/plugin-react
```

**注意**：
- 不要 `npm audit fix --force`（可能导致破坏性更新）
- 更新后 `npm run build` 确认编译通过
- 如果 patch 版本内无更新，运行 `npm audit` 确认无高危漏洞

**需要修改的文件**：`frontend/package.json`（版本号）+ `frontend/package-lock.json`

## 验收标准

1. **命令注入**：code_node.py 执行用户代码时使用受限环境变量，敏感环境变量不泄露
2. **Token 存储**：确认已用 hash 存储，或修复为 hash 存储
3. **依赖更新**：`npm audit` 无 high/critical 漏洞，`npm run build` 通过
4. Python 编译通过：`python3 -c "import py_compile; ..."`

## 禁止事项
- 不要删除 code_node.py 的代码执行功能
- 不要引入新的第三方安全库
- 不要修改后端 API 接口签名
- 不要修改数据库模型
