# Nexus 后端 — 第 1 轮：基础设施

> **项目路径**: `/root/.openclaw/workspace/agent-orchestration/backend/`
> **本轮目标**: 搭建数据库抽象层、Alembic 迁移、配置管理、依赖注入
> **完整文档参考**: `../docs/backend-dev-prompt.md`

---

## 任务清单

### 1. 配置管理 — `app/config.py`

使用 `pydantic-settings` 从 `.env` 读取配置：

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 数据库
    DATABASE_URL: str = "sqlite:///./data/nexus.db"
    
    # JWT
    JWT_SECRET: str = "change-this-to-a-random-string"
    JWT_ACCESS_EXPIRE_HOURS: int = 24
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    
    # 首次启动管理员
    ADMIN_EMAIL: str = "admin@nexus.local"
    ADMIN_PASSWORD: str = "changeme"
    
    # Gateway
    GATEWAY_WS_PORT: int = 8765
    GATEWAY_HEARTBEAT_INTERVAL: int = 30
    
    # 日志
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

同时创建 `.env.example`。

### 2. 数据库引擎 — 改造 `database.py`

支持 SQLite / PostgreSQL 切换：

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**注意**：现有 `database.py` 有 `Base` 定义，需要兼容。现有 `orm_models.py` 导入了 `from app.database import Base`，改造后确保兼容。

### 3. Alembic 初始化

```bash
cd backend
alembic init alembic
```

配置 `alembic/env.py`：
- 导入 `Base` 和所有模型（确保 metadata 包含所有表）
- 目标 `database.py` 的 engine
- `render_as_batch=True`（SQLite 兼容）

### 4. 公共模型基类 — `app/models/base.py`

```python
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from datetime import datetime
from uuid import uuid4

class TimestampMixin:
    """所有模型的公共时间字段"""
    created_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at: Mapped[str] = mapped_column(String, default=lambda: datetime.utcnow().isoformat())

def generate_uuid() -> str:
    return str(uuid4())
```

### 5. 依赖注入 — `app/deps.py`

```python
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    """从 JWT token 解析当前用户 — 第 2 轮实现具体逻辑"""
    # 第 1 轮先写框架，具体 JWT 解析第 2 轮补
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # placeholder - 第 2 轮实现
    raise HTTPException(status_code=501, detail="Auth not implemented yet")

async def require_admin(user=Depends(get_current_user)):
    """要求 admin 权限"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

### 6. 目录结构准备

创建以下空目录和 `__init__.py`：

```
app/models/legacy/          # 搁置模型
app/schemas/                # Pydantic schemas
app/middleware/             # 中间件
app/services/               # 业务逻辑
tests/                      # 测试
```

### 7. 现有代码兼容

- **不修改** `app/models/orm_models.py` 和 `app/models/gateway.py`
- **不修改** `app/routers/gateway.py`
- 确保现有 `from app.database import Base` 仍然有效
- 现有路由暂时保留在 `main.py` 中

---

## 输出要求

完成后确保：
1. `python -c "from app.config import settings; print(settings.DATABASE_URL)"` 正常输出
2. `python -c "from app.database import engine, Base, get_db; print('OK')"` 正常
3. `alembic --help` 可执行
4. 现有 `main.py` 仍能启动（`uvicorn main:app --host 0.0.0.0 --port 8081`）
5. `.env.example` 已创建

---

## ⚠️ 注意

- 本轮**不写业务逻辑**，只搭框架
- 不动 Gateway 相关代码
- 下一轮：用户认证（User model + JWT + auth router）
