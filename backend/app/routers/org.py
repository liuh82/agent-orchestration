from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from ..models.org_chart import (
    OrganizationChartCreate, OrganizationChartUpdate, OrganizationChartNode,
    OrgChartResponse, OrgChartDataResponse
)
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

router = APIRouter()

# Initialize services
org_chart_service = OrgChartService()
role_service = RoleService()
member_service = MemberService()
goal_service = GoalService()
approval_service = ApprovalService()
audit_service = AuditService()

# ===== Organization Chart Endpoints =====

@router.get("/chart", response_model=OrganizationChartDataResponse)
async def get_org_chart():
    """获取组织架构图数据"""
    return await org_chart_service.get_org_chart_data()


@router.get("/chart/nodes", response_model=OrgChartResponse)
async def get_org_chart_nodes(include_inactive: bool = False):
    """获取所有组织架构节点"""
    nodes = await org_chart_service.get_all_nodes(include_inactive=include_inactive)
    return OrgChartResponse(
        success=True,
        data=[],
        message="Organization chart nodes retrieved successfully"
    )


@router.get("/chart/nodes/{node_id}", response_model=OrgChartResponse)
async def get_org_chart_node(node_id: str):
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
async def create_org_chart_node(node: OrganizationChartCreate):
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
async def update_org_chart_node(node_id: str, node: OrganizationChartUpdate):
    """更新组织架构节点"""
    updated_node = await org_chart_service.update_node(node_id, node)
    if not updated_node:
        raise HTTPException(status_code=404, detail="Organization node not found")

    return OrgChartResponse(
        success=True,
        data=[updated_node],
        message="Organization node updated successfully"
    )


@router.delete("/chart/nodes/{node_id}")
async def delete_org_chart_node(node_id: str):
    """删除组织架构节点"""
    deleted = await org_chart_service.delete_node(node_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Organization node not found")

    return {"success": True, "message": "Organization node deleted successfully"}

# ===== Role Management Endpoints =====

@router.get("/roles", response_model=RoleListResponse)
async def get_roles(include_inactive: bool = False):
    """获取所有角色"""
    roles = await role_service.get_all_roles(include_inactive=include_inactive)
    return RoleListResponse(
        success=True,
        data=roles,
        message="Roles retrieved successfully"
    )


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(role_id: str):
    """获取单个角色"""
    role = await role_service.get_role(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    return RoleResponse(
        success=True,
        data=role,
        message="Role retrieved successfully"
    )


@router.post("/roles", response_model=RoleResponse)
async def create_role(role: RoleCreate):
    """创建新角色"""
    try:
        new_role = await role_service.create_role(role)
        return RoleResponse(
            success=True,
            data=new_role,
            message="Role created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(role_id: str, role: RoleUpdate):
    """更新角色"""
    updated_role = await role_service.update_role(role_id, role)
    if not updated_role:
        raise HTTPException(status_code=404, detail="Role not found")

    return RoleResponse(
        success=True,
        data=updated_role,
        message="Role updated successfully"
    )


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str):
    """删除角色"""
    deleted = await role_service.delete_role(role_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Role not found")

    return {"success": True, "message": "Role deleted successfully"}

# ===== Member Management Endpoints =====

@router.get("/members", response_model=MemberListResponse)
async def get_members(include_inactive: bool = False):
    """获取所有成员"""
    members = await member_service.get_all_members(include_inactive=include_inactive)
    return MemberListResponse(
        success=True,
        data=members,
        message="Members retrieved successfully"
    )


@router.get("/members/{member_id}", response_model=MemberResponse)
async def get_member(member_id: str):
    """获取单个成员"""
    member = await member_service.get_member(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    return MemberResponse(
        success=True,
        data=member,
        message="Member retrieved successfully"
    )


@router.post("/members", response_model=MemberResponse)
async def create_member(member: MemberCreate):
    """创建新成员"""
    try:
        new_member = await member_service.create_member(member)
        return MemberResponse(
            success=True,
            data=new_member,
            message="Member created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/members/{member_id}", response_model=MemberResponse)
async def update_member(member_id: str, member: MemberUpdate):
    """更新成员"""
    updated_member = await member_service.update_member(member_id, member)
    if not updated_member:
        raise HTTPException(status_code=404, detail="Member not found")

    return MemberResponse(
        success=True,
        data=updated_member,
        message="Member updated successfully"
    )


@router.delete("/members/{member_id}")
async def delete_member(member_id: str):
    """删除成员"""
    deleted = await member_service.delete_member(member_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Member not found")

    return {"success": True, "message": "Member deleted successfully"}

# ===== Goal Management Endpoints =====

@router.get("/goals", response_model=GoalListResponse)
async def get_goals():
    """获取所有目标"""
    goals = await goal_service.get_all_goals()
    return GoalListResponse(
        success=True,
        data=goals,
        message="Goals retrieved successfully"
    )


@router.get("/goals/{goal_id}", response_model=GoalResponse)
async def get_goal(goal_id: str):
    """获取单个目标"""
    goal = await goal_service.get_goal(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    return GoalResponse(
        success=True,
        data=goal,
        message="Goal retrieved successfully"
    )


@router.post("/goals", response_model=GoalResponse)
async def create_goal(goal: GoalCreate):
    """创建新目标"""
    try:
        new_goal = await goal_service.create_goal(goal)
        return GoalResponse(
            success=True,
            data=new_goal,
            message="Goal created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/goals/{goal_id}", response_model=GoalResponse)
async def update_goal(goal_id: str, goal: GoalUpdate):
    """更新目标"""
    updated_goal = await goal_service.update_goal(goal_id, goal)
    if not updated_goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    return GoalResponse(
        success=True,
        data=updated_goal,
        message="Goal updated successfully"
    )


@router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str):
    """删除目标"""
    deleted = await goal_service.delete_goal(goal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Goal not found")

    return {"success": True, "message": "Goal deleted successfully"}


@router.post("/goals/align", response_model=GoalAlignmentResponse)
async def create_goal_alignment(alignment: GoalAlignmentCreate):
    """创建目标对齐关系"""
    try:
        new_alignment = await goal_service.create_goal_alignment(alignment)
        return GoalAlignmentResponse(
            success=True,
            data=new_alignment,
            message="Goal alignment created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===== Approval Management Endpoints =====

@router.get("/approvals", response_model=ApprovalListResponse)
async def get_approvals(status: Optional[str] = None):
    """获取所有审批"""
    from ..models.approval import ApprovalStatus
    approval_status = ApprovalStatus(status) if status else None
    approvals = await approval_service.get_all_approvals(approval_status)
    return ApprovalListResponse(
        success=True,
        data=approvals,
        message="Approvals retrieved successfully"
    )


@router.get("/approvals/{approval_id}", response_model=ApprovalResponse)
async def get_approval(approval_id: str):
    """获取单个审批"""
    approval = await approval_service.get_approval(approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    return ApprovalResponse(
        success=True,
        data=approval,
        message="Approval retrieved successfully"
    )


@router.post("/approvals", response_model=ApprovalResponse)
async def create_approval(approval: ApprovalCreate):
    """创建新审批"""
    try:
        new_approval = await approval_service.create_approval(approval)
        return ApprovalResponse(
            success=True,
            data=new_approval,
            message="Approval created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/approvals/{approval_id}", response_model=ApprovalResponse)
async def update_approval(approval_id: str, approval: ApprovalUpdate):
    """更新审批"""
    updated_approval = await approval_service.update_approval(approval_id, approval)
    if not updated_approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    return ApprovalResponse(
        success=True,
        data=updated_approval,
        message="Approval updated successfully"
    )


@router.post("/approvals/{approval_id}/approve")
async def approve_approval(approval_id: str, comment: Optional[str] = None):
    """批准审批"""
    from ..models.approval import ApprovalStatus

    # Get approval first to get approver info
    approval = await approval_service.get_approval(approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    updated_approval = await approval_service.update_approval_status(
        approval_id, ApprovalStatus.APPROVED,
        approval.requester_id, "System", comment
    )

    if not updated_approval:
        raise HTTPException(status_code=400, detail="Failed to approve approval")

    return ApprovalResponse(
        success=True,
        data=updated_approval,
        message="Approval approved successfully"
    )


@router.post("/approvals/{approval_id}/reject")
async def reject_approval(approval_id: str, comment: Optional[str] = None):
    """拒绝审批"""
    from ..models.approval import ApprovalStatus

    # Get approval first to get approver info
    approval = await approval_service.get_approval(approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    updated_approval = await approval_service.update_approval_status(
        approval_id, ApprovalStatus.REJECTED,
        approval.requester_id, "System", comment
    )

    if not updated_approval:
        raise HTTPException(status_code=400, detail="Failed to reject approval")

    return ApprovalResponse(
        success=True,
        data=updated_approval,
        message="Approval rejected successfully"
    )


@router.get("/approvals/{approval_id}/history", response_model=ApprovalHistoryResponse)
async def get_approval_history(approval_id: str):
    """获取审批历史"""
    history = await approval_service.get_approval_history(approval_id)
    return ApprovalHistoryResponse(
        success=True,
        data=history,
        message="Approval history retrieved successfully"
    )

# ===== Audit Log Endpoints =====

@router.get("/audit/logs")
async def get_audit_logs(
    page: int = 1,
    page_size: int = 50,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    action: Optional[str] = None,
    status_code: Optional[int] = None
):
    """获取审计日志列表"""
    from ..models.audit_log import AuditLogAction

    # Convert string action to enum
    action_enum = None
    if action:
        try:
            action_enum = AuditLogAction(action)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid action value")

    response = await audit_service.get_audit_logs(
        page=page,
        page_size=page_size,
        start_time=start_time,
        end_time=end_time,
        user_id=user_id,
        resource_type=resource_type,
        action=action_enum,
        status_code=status_code
    )
    return response


@router.post("/audit/logs")
async def create_audit_log(audit_log: AuditLogCreate):
    """创建审计日志"""
    try:
        new_audit_log = await audit_service.create_audit_log(audit_log)
        return AuditLogResponse(
            success=True,
            data=new_audit_log,
            message="Audit log created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audit/summary")
async def get_audit_summary(start_time: Optional[datetime] = None, end_time: Optional[datetime] = None):
    """获取审计摘要"""
    summary = await audit_service.get_audit_summary(start_time, end_time)
    return {
        "success": True,
        "data": summary,
        "message": "Audit summary retrieved successfully"
    }