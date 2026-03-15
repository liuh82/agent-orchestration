"""Auth-related Pydantic schemas."""
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


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

    model_config = {"from_attributes": True}


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    settings: Optional[dict] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
