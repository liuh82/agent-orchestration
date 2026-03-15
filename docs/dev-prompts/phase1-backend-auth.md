# Phase 1 - 后端：JWT 双Token认证 + RBAC

## 任务目标

改造现有认证系统，实现 JWT 双Token（Access 30min + Refresh 7d）、httpOnly Cookie、RBAC 权限中间件。

## 修改文件清单

```
backend/app/services/auth.py          # 认证服务（重写）
backend/app/routers/auth.py           # 认证路由（重写）
backend/app/models/user_session_token.py  # Phase 0 已创建
backend/app/deps.py                   # 依赖注入（添加 get_current_user）
backend/app/config.py                 # 添加 JWT 配置
backend/requirements.txt              # 添加 PyJWT, passlib
```

## JWT 配置

```python
# backend/app/config.py 新增
JWT_SECRET_KEY = "your-secret-key-change-in-production"  # 后续从环境变量读取
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
```

## 认证服务接口

```python
# backend/app/services/auth.py

class AuthService:
    def create_tokens(self, user_id: str, role: str) -> dict:
        """生成 Access Token + Refresh Token"""
        # Access Token payload: { sub, role, type="access", exp, jti }
        # Refresh Token payload: { sub, type="refresh", exp, jti }
        # 返回 { "access_token": "...", "refresh_token": "...", "expires_in": 1800 }

    def verify_access_token(self, token: str) -> dict:
        """验证 Access Token，返回 payload 或抛出异常"""

    def verify_refresh_token(self, token: str) -> dict:
        """验证 Refresh Token"""

    def refresh_access_token(self, refresh_token: str) -> str:
        """用 Refresh Token 换取新 Access Token"""

    def revoke_token(self, token_hash: str):
        """撤销 Token（设置 revoked_at）"""

    def hash_password(self, password: str) -> str:
        """密码哈希（bcrypt）"""

    def verify_password(self, plain: str, hashed: str) -> bool:
        """密码验证"""
```

## 认证路由

```
POST /api/v1/auth/login
  Body: { "email": "...", "password": "..." }
  Response: { "code": 0, "data": { "access_token": "...", "expires_in": 1800, "user": { "id", "email", "name", "role" } } }
  Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age=604800

POST /api/v1/auth/refresh
  Cookie: refresh_token=...
  Response: { "code": 0, "data": { "access_token": "...", "expires_in": 1800 } }

POST /api/v1/auth/logout
  Header: Authorization: Bearer <access_token>
  Cookie: refresh_token=...
  Response: { "code": 0, "data": null }
  Set-Cookie: refresh_token=; HttpOnly; Max-Age=0  (清除cookie)

POST /api/v1/auth/register
  Body: { "email": "...", "password": "...", "name": "..." }
  Response: { "code": 0, "data": { "user": { "id", "email", "name", "role": "user" } } }

GET /api/v1/auth/me
  Header: Authorization: Bearer <access_token>
  Response: { "code": 0, "data": { "id", "email", "name", "role" } }

PUT /api/v1/auth/password
  Header: Authorization: Bearer <access_token>
  Body: { "old_password": "...", "new_password": "..." }
  Response: { "code": 0 }
```

## RBAC 中间件

```python
# backend/app/deps.py

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    """从 Authorization header 提取并验证 Access Token"""
    # 1. 提取 Bearer token
    # 2. 验证 JWT
    # 3. 查询用户是否存在、是否被禁用
    # 4. 返回 user 对象（包含 id, email, name, role）

def require_role(*roles: str):
    """角色检查依赖"""
    async def checker(current_user = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(403, "无权限")
        return current_user
    return checker
```

## 用户模型确认

现有 users 表字段（`backend/app/models/user.py`），确认包含：
- id (String, PK)
- email (String, unique)
- name (String)
- password_hash (String) — 如不存在则添加
- role (String, default "user") — 如不存在则添加
- status (String, default "active") — 如不存在则添加
- created_at, updated_at

**如缺少 password_hash / role / status 字段，在此 Phase 的 Alembic 迁移中添加。**

## 安全修复（安全审计遗留）

1. **Token 存储：** Access Token 不存储到数据库（无状态JWT），Refresh Token 存 user_session_tokens 表（hash后存储）
2. **密码存储：** 使用 passlib bcrypt 哈希，不存明文
3. **命令注入：** 在此 Phase 中审查现有路由中是否有用户输入直接拼接到命令/路径的情况（project_path 字段），添加路径白名单校验

## 约束

- Python 语法兼容 3.9：`Optional[str]`，不用 `str | None`
- JWT secret 后续要从环境变量读取，本次先硬编码但加注释
- 不修改现有 /api/auth 兼容层路由，只改 /api/v1/auth
- Refresh Token 通过 httpOnly Cookie 传递，不在响应体中返回

## 验收标准

- [ ] 登录返回 access_token + 设置 refresh_token cookie
- [ ] access_token 过期后用 refresh_token 可换取新 access_token
- [ ] 登出后 refresh_token cookie 被清除
- [ ] /api/v1/auth/me 正确返回当前用户信息和 role
- [ ] admin 角色可访问 admin 路由，user 角色返回 403
- [ ] 密码使用 bcrypt 哈希存储
- [ ] 现有 /api/auth 兼容路由不受影响
- [ ] 注册默认角色为 "user"
