#!/usr/bin/env python3
"""
组织架构功能测试
"""

import pytest
import asyncio
from datetime import datetime
from uuid import uuid4
from sqlalchemy.orm import Session
from app.services.org_chart import OrgChartService
from app.services.role import RoleService
from app.services.member import MemberService
from app.services.goal import GoalService
from app.services.approval import ApprovalService
from app.services.audit import AuditService

from app.models.org_chart import OrganizationChartCreate
from app.models.role import RoleCreate, RoleUpdate
from app.models.goal import GoalCreate, GoalAlignmentCreate
from app.models.approval import ApprovalCreate, ApprovalStatus, ApprovalType
from app.models.audit_log import AuditLogCreate, AuditLogType, AuditLogAction


class TestOrgChart:
    """组织架构测试"""

    def test_create_org_node(self, db: Session):
        """测试创建组织架构节点"""
        service = OrgChartService(db)

        # 创建根节点
        node_data = OrganizationChartCreate(
            name="CEO办公室",
            title="CEO",
            department="EXEC",
            parent_id=None
        )

        node = await service.create_node(node_data)
        assert node.name == "CEO办公室"
        assert node.department == "EXEC"
        assert node.level == 1
        assert node.parent_id is None

        return node.id

    def test_create_child_node(self, db: Session):
        """测试创建子节点"""
        service = OrgChartService(db)

        # 先创建父节点
        parent_data = OrganizationChartCreate(
            name="CEO办公室",
            title="CEO",
            department="EXEC",
            parent_id=None
        )
        parent = service.create_node(parent_data)

        # 创建子节点
        node_data = OrganizationChartCreate(
            name="技术部",
            title="技术总监",
            department="TECH",
            parent_id=parent.id
        )

        node = service.create_node(node_data)
        assert node.name == "技术部"
        assert node.department == "TECH"
        assert node.level == 2
        assert node.parent_id == parent.id

        return node.id

    def test_get_org_chart(self, db: Session):
        """测试获取组织架构图"""
        service = OrgChartService(db)

        chart_data = service.get_org_chart_data()
        assert chart_data.success is True
        assert "root_nodes" in chart_data.data
        assert "tree" in chart_data.data


class TestRole:
    """角色管理测试"""

    def test_create_role(self, db: Session):
        """测试创建角色"""
        service = RoleService(db)

        role_data = RoleCreate(
            name="测试角色",
            code="TEST_ROLE_ABC",
            description="测试角色描述",
            permissions=["view_test"]
        )

        role = service.create_role(role_data)
        assert role.name == "测试角色"
        assert role.permissions == ["view_test"]

        return role.id

    def test_update_role(self, db: Session):
        """测试更新角色"""
        service = RoleService(db)

        # 先创建角色
        role_data = RoleCreate(
            name="测试角色",
            code="TEST_ROLE_UPDATE_XYZ",
            description="测试角色描述",
            permissions=["view_test"]
        )
        role = service.create_role(role_data)

        # 更新角色
        update_data = RoleUpdate(
            name="更新后的测试角色",
            code=role.code,
            description="更新后的描述",
            permissions=["view_test", "edit_test"],
            is_active=True
        )

        updated_role = service.update_role(role.id, update_data)
        assert updated_role.name == "更新后的测试角色"
        assert "edit_test" in updated_role.permissions

        return role.id

    def test_delete_role(self, db: Session):
        """测试删除角色"""
        service = RoleService(db)

        # 先创建角色
        role_data = RoleCreate(
            name="待删除角色",
            code="DELETE_ROLE_DEF",
            description="待删除",
            permissions=["view_test"]
        )
        role = service.create_role(role_data)

        # 删除角色
        result = service.delete_role(role.id)
        assert result is True

        # 验证角色已被软删除
        deleted_role = service.get_role(role.id)
        assert deleted_role is None


class TestGoal:
    """目标管理测试"""

    @pytest.mark.asyncio
    async def test_create_goal(self, db: Session):
        """测试创建目标"""
        service = GoalService(db)

        goal_data = GoalCreate(
            title="完成产品开发",
            description="在Q4完成产品开发",
            type="objective",
            priority="high",
            status="active",
            owner_id="test_user_1",
            progress=50.0
        )

        goal = await service.create_goal(goal_data)
        assert goal.title == "完成产品开发"
        assert goal.priority == "high"
        assert goal.progress == 50.0

        return goal.id

    @pytest.mark.asyncio
    async def test_create_goal_alignment(self, db: Session):
        """测试创建目标对齐"""
        service = GoalService(db)

        # 先创建两个目标
        goal1_data = GoalCreate(
            title="父目标",
            description="父目标",
            type="objective",
            priority="high",
            status="active",
            owner_id="test_user_1"
        )
        goal1 = await service.create_goal(goal1_data)

        goal2_data = GoalCreate(
            title="子目标",
            description="子目标",
            type="objective",
            priority="medium",
            status="active",
            owner_id="test_user_1"
        )
        goal2 = await service.create_goal(goal2_data)

        # 创建对齐关系
        alignment_data = GoalAlignmentCreate(
            parent_id=goal1.id,
            child_id=goal2.id,
            weight=0.8,
            description="支持关系"
        )

        alignment = await service.create_goal_alignment(alignment_data)
        assert alignment.parent_id == goal1.id
        assert alignment.child_id == goal2.id
        assert alignment.weight == 0.8

        return alignment.id


class TestApproval:
    """审批管理测试"""

    @pytest.mark.asyncio
    async def test_create_approval(self, db: Session):
        """测试创建审批"""
        service = ApprovalService(db)

        approval_data = ApprovalCreate(
            title="创建新Agent",
            type=ApprovalType.AGENT_CREATE,
            content='{"agent_name": "新测试Agent", "model": "claude-3-opus"}',
            requester_id="user_1",
            approver_ids=["user_2", "user_3"],
            priority="medium"
        )

        approval = await service.create_approval(approval_data)
        assert approval.title == "创建新Agent"
        assert approval.type == ApprovalType.AGENT_CREATE
        assert approval.requester_id == "user_1"

        return approval.id

    @pytest.mark.asyncio
    async def test_update_approval_status(self, db: Session):
        """测试更新审批状态"""
        service = ApprovalService(db)

        # 先创建审批
        approval_data = ApprovalCreate(
            title="待审批测试",
            type=ApprovalType.AGENT_CREATE,
            content='{"test": "data"}',
            requester_id="user_1",
            approver_ids=["user_2"],
            priority="medium"
        )
        approval = await service.create_approval(approval_data)

        # 更新审批状态
        updated_approval = await service.update_approval_status(
            approval.id,
            ApprovalStatus.APPROVED,
            "user_2",
            "审批人A",
            "批准申请"
        )

        assert updated_approval.status == ApprovalStatus.APPROVED.value

        return approval.id


class TestAudit:
    """审计日志测试"""

    @pytest.mark.asyncio
    async def test_create_audit_log(self, db: Session):
        """测试创建审计日志"""
        service = AuditService(db)

        audit_data = AuditLogCreate(
            type=AuditLogType.CREATE,
            action=AuditLogAction.AGENT_CREATE,
            resource_type="agents",
            resource_id="agent_123",
            user_id="user_1",
            user_name="测试用户",
            status_code=201,
            duration_ms=150
        )

        audit_log = await service.create_audit_log(audit_data)
        assert audit_log.action == AuditLogAction.AGENT_CREATE
        assert audit_log.resource_id == "agent_123"
        assert audit_log.user_id == "user_1"

        return audit_log.id

    @pytest.mark.asyncio
    async def test_get_audit_logs(self, db: Session):
        """测试获取审计日志"""
        service = AuditService(db)

        logs = await service.get_audit_logs(page=1, page_size=10)
        assert logs.success is True
        assert logs.data is not None
        assert "pagination" in logs.model_dump()


if __name__ == "__main__":
    # 运行测试
    pytest.main(["-v", "test_org_features.py"])
