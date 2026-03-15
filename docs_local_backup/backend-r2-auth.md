# Nexus 后端 — 第 2 轮：用户认证

> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/backend/`
> **前置条件**: 第 1 轮已完成（config, database, Alembic, base models, deps）
> **完整文档参考**: `../docs/backend-dev-prompt.md`

---

## 任务清单

### 1. User 模型 — `app/models/user.py`

```python
from sqlalchemy import String, Integer, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import generate_uuid, TimestampMixin
from datetime import datetime

class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        Index('idx_users_email', 'email', unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default='user')  # admin / user
    avatar: Mapped[str | None] = mapped_column(String(500))
    settings: Mapped[str | None] = mapped_column(Text)  # JSON
    
    # 配额
    max_agents: Mapped[int] = mapped_column(Integer, default=10)
    max_projects: Mapped[int] = mapped_column(Integer, default=20)
    max_tasks: Mapped[int] = mapped_column(Integer, default=100)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[str | None] = mapped_column(String)
```

### 2. Pydantic Schemas — `app/schemas/auth.py`

```python
from pydantic import BaseModel, EmailStr
from typing import Optional

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str  # min 8 chars
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    avatar: Optional[str] = None
    settings: Optional[dict] = None
    max_agents: int = 10
    max_projects: int = 20
    max_tasks: int = 100
    is_active: bool = True
    created_at: str
    
    class Config:
        from_attributes = True

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    settings: Optional[dict] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str  # min 8 chars

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
```

### 3. 认证服务 — `app/services/auth.py`

```python
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings
from fastapi import HTTPException

ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_ACCESS_EXPIRE_HOURS)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    """解码并验证 token，返回 payload"""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### 4. 完善 `app/deps.py` — 实现 JWT 依赖注入

```python
from app.models.user import User
from app.services.auth import decode_token

async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return user

async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

### 5. Auth Router — `app/routers/auth.py`

6 个端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 `{email, password, name}` |
| POST | `/api/v1/auth/login` | 登录 `{email, password}` |
| POST | `/api/v1/auth/refresh` | 刷新 token `{refresh_token}` |
| GET | `/api/v1/auth/me` | 当前用户 |
| PUT | `/api/v1/auth/me` | 更新信息 |
| PUT | `/api/v1/auth/password` | 改密码 |

**统一响应格式**：
```python
def success_response(data, message="success"):
    return {"code": 0, "data": data, "message": message}

def error_response(code, message):
    return {"code": code, "data": None, "message": message}
```

**注册逻辑**：
1. 检查邮箱是否已注册 → 409 Conflict
2. 密码最少 8 位 → 400 Bad Request
3. 创建 User，hash 密码
4. 生成 access_token + refresh_token
5. 返回 `{user, access_token, refresh_token}`

**登录逻辑**：
1. 查询邮箱 → 404
2. 验证密码 → 401
3. 检查 is_active → 403
4. 更新 last_login_at
5. 返回 token

**刷新逻辑**：
1. 解码 refresh_token（检查 type == "refresh"）
2. 查询用户
3. 生成新的 access_token + refresh_token

### 6. 注册到 main.py

```python
from app.routers import auth
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
```

### 7. Alembic Migration

生成并运行迁移：
```bash
alembic revision --autogenerate -m "add_users_table"
alembic upgrade head
```

---

## 输出要求

1. `POST /api/v1/auth/register` 能成功注册用户并返回 token
2. `POST /api/v1/auth/login` 能登录并返回 token
3. `GET /api/v1/auth/me` 带 Bearer token 能获取用户信息
4. 不带 token 访问返回 401
5. `alembic upgrade head` 正常运行
6. 现有功能不受影响

**测试命令**：
```bash
# 启动服务
uvicorn main:app --host 0.0.0.0 --port 8081 --reload

# 注册
curl -X POST http://localhost:8081/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"12345678","name":"Test User"}'

# 登录
curl -X POST http://localhost:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"12345678"}'

# 获取当前用户（用上一步返回的 access_token）
curl http://localhost:8081/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"
```

---

## ⚠️ 注意

- 密码用 bcrypt 哈希，绝不存明文
- JWT 用 HS256，secret 从 settings 读
- 不动 Gateway 和现有 router
- 下一轮：Agent 类型 + 实例模型和 API
