from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models.org_chart import (
    OrganizationChartCreate, OrganizationChartUpdate, OrganizationChartNode,
    OrgChartResponse, OrgChartDataResponse
)
# Alias for consistency with existing usage
OrganizationChartDataResponse = OrgChartDataResponse
from ..models.role import RoleCreate, RoleUpdate, Role, RoleResponse, RoleListResponse
from ..models.member import MemberCreate, MemberUpdate, Member, MemberResponse, MemberListResponse
from ..models.goal import (
    GoalCreate, GoalUpdate, Goal, GoalResponse, GoalListResponse,
    GoalAlignmentCreate, GoalAlignmentResponse
)
from ..models.approval import (
    ApprovalCreate, ApprovalUpdate, Approval, ApprovalResponse, ApprovalListResponse,
    ApprovalHistoryResponse
)
from ..models.audit_log import AuditLogCreate, AuditLogResponse

from ..services.org_chart import OrgChartService
from ..services.role import RoleService
from ..services.member import MemberService
from ..services.goal import GoalService
from ..services.approval import ApprovalService
from ..services.audit import AuditService
from ..database import get_db

router = APIRouter()

# ===== Organization Chart Endpoints =====

# Create service instances
def get_org_chart_service(db: Session = Depends(get_db)):
    return OrgChartService(db)

def get_role_service(db: Session = Depends(get_db)):
    return RoleService(db)

def get_member_service(db: Session = Depends(get_db)):
    return MemberService(db)

def get_goal_service(db: Session = Depends(get_db)):
    return GoalService(db)

def get_approval_service(db: Session = Depends(get_db)):
    return ApprovalService(db)

def get_audit_service(db: Session = Depends(get_db)):
    return AuditService(db)

@router.get("/chart", response_model=OrganizationChartDataResponse)
async def get_org_chart(org_chart_service: OrgChartService = Depends(get_org_chart_service)):
    """获取组织架构图数据"""
    return await org_chart_service.get_org_chart_data()


@router.get("/chart/nodes", response_model=OrgChartResponse)
async def get_org_chart_nodes(include_inactive: bool = False, org_chart_service: OrgChartService = Depends(get_org_chart_service)):
    """获取所有组织架构节点"""
    nodes = await org_chart_service.get_all_nodes(include_inactive=include_inactive)
    return OrgChartResponse(
        success=True,
        data=[],
        message="Organization chart nodes retrieved successfully"
    )


@router.get("/chart/nodes/{node_id}", response_model=OrgChartResponse)
async def get_org_chart_node(node_id: str, org_chart_service: OrgChartService = Depends(get_org_chart_service)):
    """获取单个组织架构节点"""
    node = await org_chart_service.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Organization node not found")

    return OrgChartResponse(
        success=True,
        data=[node],
        message="Organization node retrieved successfully"
    )


@router.post("/chart/nodes", response_model=OrgChartResponse)
async def create_org_chart_node(node: OrganizationChartCreate, org_chart_service: OrgChartService = Depends(get_org_chart_service)):
    """创建新的组织架构节点"""
    try:
        new_node = await org_chart_service.create_node(node)
        return OrgChartResponse(
            success=True,
            data=[new_node],
            message="Organization node created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/chart/nodes/{node_id}", response_model=OrgChartResponse)
async def update_org_chart_node(node_id: str, node: OrganizationChartUpdate, org_chart_service: OrgChartService = Depends(get_org_chart_service)):
    """更新组织架构节点"""
    try:
        updated_node = await org_chart_service.update_node(node_id, node)
        if not updated_node:
            raise HTTPException(status_code=404, detail="Organization node not found")

        return OrgChartResponse(
            success=True,
            data=[updated_node],
            message="Organization node updated successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/chart/nodes/{node_id}", response_model=OrgChartResponse)
async def delete_org_chart_node(node_id: str, org_chart_service: OrgChartService = Depends(get_org_chart_service)):
    """删除组织架构节点"""
    try:
        deleted = await org_chart_service.delete_node(node_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Organization node not found")

        return OrgChartResponse(
            success=True,
            data=[],
            message="Organization node deleted successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))