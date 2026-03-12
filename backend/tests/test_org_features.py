#!/usr/bin/env python3
"""
组织架构功能测试
"""

import pytest
import asyncio
from datetime import datetime
from app.services.org_chart import OrgChartService
from app.services.role import RoleService
from app.services.member import MemberService
from app.services.goal import GoalService
from app.services.approval import ApprovalService
from app.services.audit import AuditService


class TestOrgChart:
    """组织架构测试"""

    @pytest.mark.asyncio
    async def test_create_org_node(self):
        """测试创建组织架构节点"""
        service = OrgChartService()

        # 创建根节点
        node_data = {
            "name": "CEO办公室",
            "title": "CEO",
            "department": "EXEC",
            "parent_id": None
        }

        node = await service.create_node(node_data)
        assert node.name == "CEO办公室"
        assert node.department == "EXEC"
        assert node.level == 1
        assert node.parent_id is None

        return node.id

    @pytest.mark.asyncio
    async def test_create_child_node(self, parent_id):
        """测试创建子节点"""
        service = OrgChartService()

        # 创建子节点
        node_data = {
            "name": "技术部",
            "title": "技术总监",
            "department": "TECH",
            "parent_id": parent_id
        }

        node = await service.create_node(node_data)
        assert node.name == "技术部"
        assert node.department == "TECH"
        assert node.level == 2
        assert node.parent_id == parent_id

        return node.id

    @pytest.mark.asyncio
    async def test_get_org_chart(self):
        """测试获取组织架构图"""
        service = OrgChartService()

        chart_data = await service.get_org_chart_data()
        assert chart_data.success is True
        assert "root_nodes" in chart_data.data
        assert "tree" in chart_data.data


class TestRole:
    """角色管理测试"""

    @pytest.mark.asyncio
    async def test_create_role(self):
        """测试创建角色"""
        service = RoleService()

        role_data = {
            "name": "测试角色",
            "code": "TEST_ROLE",
            "description": "测试角色描述",
            "permissions": ["view_test"]
        }

        role = await service.create_role(role_data)
        assert role.name == "测试角色"
        assert role.code == "TEST_ROLE"
        assert role.permissions == ["view_test"]

        return role.id

    @pytest.mark.asyncio
    async def test_update_role(self, role_id):
        """测试更新角色"""
        service = RoleService()

        update_data = {
            "name": "更新后的测试角色",
            "permissions": ["view_test", "edit_test"]
        }

        role = await service.update_role(role_id, update_data)
        assert role.name == "更新后的测试角色"
        assert "edit_test" in role.permissions

        return role.id

    @pytest.mark.asyncio
    async def test_delete_role(self, role_id):
        """测试删除角色"""
        service = RoleService()

        result = await service.delete_role(role_id)
        assert result is True


class TestGoal:
    """目标管理测试"""

    @pytest.mark.asyncio
    async def test_create_goal(self):
        """测试创建目标"""
        service = GoalService()

        goal_data = {
            "title": "完成产品开发",
            "description": "在Q4完成产品开发",
            "type": "objective",
            "priority": "high",
            "status": "active",
            "owner_id": "test_user_1",
            "progress": 50.0
        }

        goal = await service.create_goal(goal_data)
        assert goal.title == "完成产品开发"
        assert goal.priority == "high"
        assert goal.progress == 50.0

        return goal.id

    @pytest.mark.asyncio
    async def test_create_goal_alignment(self):
        """测试创建目标对齐"""
        service = GoalService()

        alignment_data = {
            "parent_id": "goal_1",
            "child_id": "goal_2",
            "weight": 0.8,
            "description": "支持关系"
        }

        alignment = await service.create_goal_alignment(alignment_data)
        assert alignment.parent_id == "goal_1"
        assert alignment.child_id == "goal_2"
        assert alignment.weight == 0.8

        return alignment.id


class TestApproval:
    """审批管理测试"""

    @pytest.mark.asyncio
    async def test_create_approval(self):
        """测试创建审批"""
        service = ApprovalService()

        approval_data = {
            "title": "创建新Agent",
            "type": "agent_create",
            "content": '{"agent_name": "新测试Agent", "model": "claude-3-opus"}',
            "requester_id": "user_1",
            "approver_ids": ["user_2", "user_3"],
            "priority": "medium"
        }

        approval = await service.create_approval(approval_data)
        assert approval.title == "创建新Agent"
        assert approval.type == "agent_create"
        assert approval.requester_id == "user_1"

        return approval.id

    @pytest.mark.asyncio
    async def test_update_approval_status(self, approval_id):
        """测试更新审批状态"""
        service = ApprovalService()

        from app.models.approval import ApprovalStatus

        approval = await service.update_approval_status(
            approval_id,
            ApprovalStatus.APPROVED,
            "user_2",
            "审批人A",
            "批准申请"
        )

        assert approval.status == "approved"

        return approval.id


class TestAudit:
    """审计日志测试"""

    @pytest.mark.asyncio
    async def test_create_audit_log(self):
        """测试创建审计日志"""
        service = AuditService()

        audit_data = {
            "type": "create",
            "action": "agent_create",
            "resource_type": "agents",
            "resource_id": "agent_123",
            "user_id": "user_1",
            "user_name": "测试用户",
            "status_code": 201,
            "duration_ms": 150
        }

        audit_log = await service.create_audit_log(audit_data)
        assert audit_log.action == "agent_create"
        assert audit_log.resource_id == "agent_123"
        assert audit_log.user_id == "user_1"

        return audit_log.id

    @pytest.mark.asyncio
    async def test_get_audit_logs(self):
        """测试获取审计日志"""
        service = AuditService()

        logs = await service.get_audit_logs(page=1, page_size=10)
        assert logs.success is True
        assert "data" in logs
        assert "pagination" in logs


if __name__ == "__main__":
    # 运行测试
    pytest.main(["-v", "test_org_features.py"])