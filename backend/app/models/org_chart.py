from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class OrganizationChartNode(BaseModel):
    """组织架构节点"""
    id: str
    name: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=100)
    department: str = Field(..., min_length=1, max_length=50)
    level: int = Field(..., ge=1)  # 层级，1为最高层
    parent_id: Optional[str] = None
    children_ids: List[str] = Field(default_factory=list)
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationChartCreate(BaseModel):
    """创建组织架构节点"""
    name: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=100)
    department: str = Field(..., min_length=1, max_length=50)
    parent_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None


class OrganizationChartUpdate(BaseModel):
    """更新组织架构节点"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    department: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    is_active: Optional[bool] = None


class OrganizationChart(OrganizationChartCreate):
    """组织架构节点完整信息"""
    id: str
    level: int
    children_ids: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrgChartResponse(BaseModel):
    """组织架构响应"""
    success: bool
    data: List[OrganizationChart]
    message: str = ""


class OrgChartDataResponse(BaseModel):
    """组织架构图数据响应"""
    success: bool
    data: dict
    message: str = ""