from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class RoleBase(BaseModel):
    """角色基础信息"""
    name: str = Field(..., min_length=1, max_length=50)
    code: str = Field(..., min_length=1, max_length=50, pattern=r"^[A-Z_]+$")
    description: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    is_active: bool = Field(default=True)


class RoleCreate(RoleBase):
    """创建角色"""
    pass


class RoleUpdate(RoleBase):
    """更新角色"""
    pass


class Role(RoleBase):
    """角色完整信息"""
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoleResponse(BaseModel):
    """角色响应"""
    success: bool
    data: Optional[Role] = None
    message: str = ""


class RoleListResponse(BaseModel):
    """角色列表响应"""
    success: bool
    data: List[Role]
    message: str = ""