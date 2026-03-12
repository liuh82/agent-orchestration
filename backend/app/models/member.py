from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class MemberBase(BaseModel):
    """成员基础信息"""
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    phone: Optional[str] = None
    avatar: Optional[str] = None
    department_id: str
    position: str = Field(..., min_length=1, max_length=100)
    role_ids: List[str] = Field(default_factory=list)
    is_active: bool = Field(default=True)


class MemberCreate(MemberBase):
    """创建成员"""
    pass


class MemberUpdate(MemberBase):
    """更新成员"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = Field(None, pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    phone: Optional[str] = None
    avatar: Optional[str] = None
    department_id: Optional[str] = None
    position: Optional[str] = Field(None, min_length=1, max_length=100)
    role_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class Member(MemberBase):
    """成员完整信息"""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MemberResponse(BaseModel):
    """成员响应"""
    success: bool
    data: Optional[Member] = None
    message: str = ""


class MemberListResponse(BaseModel):
    """成员列表响应"""
    success: bool
    data: List[Member]
    message: str = ""