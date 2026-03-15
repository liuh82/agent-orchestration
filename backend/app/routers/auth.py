"""Auth router — registration, login, refresh, profile, password change."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UpdateUserRequest,
    UserOut,
)
from app.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter()


def success_response(data, message="success"):
    return {"code": 0, "data": data, "message": message}


def error_response(code, message):
    return {"code": code, "data": None, "message": message}


def _build_user_out(user: User) -> UserOut:
    """Convert User ORM to UserOut, parsing JSON settings."""
    settings_data = None
    if user.settings:
        try:
            settings_data = json.loads(user.settings)
        except (json.JSONDecodeError, TypeError):
            settings_data = None

    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        avatar=user.avatar,
        settings=settings_data,
        max_agents=user.max_agents,
        max_projects=user.max_projects,
        max_tasks=user.max_tasks,
        is_active=user.is_active,
        created_at=user.created_at or "",
    )


# ── POST /register ──────────────────────────────────────────────


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate email
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        return error_response(409, "Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return success_response(
        LoginResponse(
            user=_build_user_out(user),
            access_token=access_token,
            refresh_token=refresh_token,
        ).model_dump(),
        "Registered successfully",
    )


# ── POST /login ─────────────────────────────────────────────────


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    # Update last login
    user.last_login_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return success_response(
        LoginResponse(
            user=_build_user_out(user),
            access_token=access_token,
            refresh_token=refresh_token,
        ).model_dump(),
    )


# ── POST /refresh ───────────────────────────────────────────────


@router.post("/refresh")
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or disabled")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return success_response(
        TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        ).model_dump(),
    )


# ── GET /me ──────────────────────────────────────────────────────


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return success_response(_build_user_out(user).model_dump())


# ── PUT /me ──────────────────────────────────────────────────────


@router.put("/me")
def update_me(
    body: UpdateUserRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.name is not None:
        user.name = body.name
    if body.avatar is not None:
        user.avatar = body.avatar
    if body.settings is not None:
        user.settings = json.dumps(body.settings)

    db.commit()
    db.refresh(user)

    return success_response(_build_user_out(user).model_dump(), "Profile updated")


# ── PUT /password ────────────────────────────────────────────────


@router.put("/password")
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is incorrect")

    user.password_hash = hash_password(body.new_password)
    db.commit()

    return success_response(None, "Password changed")
