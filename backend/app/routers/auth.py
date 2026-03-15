"""Auth router — registration, login, refresh, logout, profile, password change."""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UpdateUserRequest,
    UserOut,
)
from app.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    is_token_revoked,
    revoke_refresh_token,
    store_refresh_token,
    verify_password,
)

router = APIRouter()

ACCESS_EXPIRE_SECONDS = settings.JWT_ACCESS_EXPIRE_MINUTES * 60
REFRESH_COOKIE_MAX_AGE = settings.JWT_REFRESH_EXPIRE_DAYS * 86400


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


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Set refresh_token as httpOnly cookie."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=False,  # TODO: True in production (HTTPS)
        samesite="lax",
        path="/api",
        max_age=REFRESH_COOKIE_MAX_AGE,
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear the refresh_token cookie."""
    response.delete_cookie(
        key="refresh_token",
        path="/api",
    )


# ── POST /register ──────────────────────────────────────────────


@router.post("/register")
def register(
    body: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
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

    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)
    store_refresh_token(db, user.id, refresh_token)
    _set_refresh_cookie(response, refresh_token)

    return success_response(
        LoginResponse(
            user=_build_user_out(user),
            access_token=access_token,
            expires_in=ACCESS_EXPIRE_SECONDS,
        ).model_dump(),
        "Registered successfully",
    )


# ── POST /login ─────────────────────────────────────────────────


@router.post("/login")
def login(
    body: LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    user.last_login_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)
    store_refresh_token(db, user.id, refresh_token, ip_address=request.client.host if request.client else None)
    _set_refresh_cookie(response, refresh_token)

    return success_response(
        LoginResponse(
            user=_build_user_out(user),
            access_token=access_token,
            expires_in=ACCESS_EXPIRE_SECONDS,
        ).model_dump(),
    )


# ── POST /refresh ───────────────────────────────────────────────


@router.post("/refresh")
def refresh(
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found")

    payload = decode_token(raw_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    if is_token_revoked(db, raw_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or disabled")

    # Rotate refresh token: revoke old, issue new
    revoke_refresh_token(db, raw_token)

    new_access_token = create_access_token(user.id, user.role)
    new_refresh_token = create_refresh_token(user.id)
    store_refresh_token(db, user.id, new_refresh_token, ip_address=request.client.host if request.client else None)
    _set_refresh_cookie(response, new_refresh_token)

    return success_response(
        TokenResponse(
            access_token=new_access_token,
            expires_in=ACCESS_EXPIRE_SECONDS,
        ).model_dump(),
    )


# ── POST /logout ────────────────────────────────────────────────


@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    raw_token = request.cookies.get("refresh_token")
    if raw_token:
        revoke_refresh_token(db, raw_token)

    _clear_refresh_cookie(response)
    return success_response(None, "Logged out")


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
