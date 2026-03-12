#!/usr/bin/env python3
"""
数据库初始化脚本
用于创建所有必要的表和初始数据
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.org_chart import OrgChartService
from app.services.role import RoleService
from app.services.member import MemberService
from app.services.goal import GoalService
from app.services.approval import ApprovalService
from app.services.audit import AuditService
from app.services.agent import AgentService
from app.services.task import TaskService
from app.services.workflow import WorkflowService
from app.services.cost import CostService
from datetime import datetime


def init_database():
    """初始化数据库并创建初始数据"""
    print("正在初始化数据库...")

    # 初始化所有服务
    org_chart_service = OrgChartService()
    role_service = RoleService()
    member_service = MemberService()
    goal_service = GoalService()
    approval_service = ApprovalService()
    audit_service = AuditService()
    agent_service = AgentService()
    task_service = TaskService()
    workflow_service = WorkflowService()
    cost_service = CostService()

    print("✅ 所有服务已初始化")

    # 创建初始角色
    print("\n创建初始角色...")
    initial_roles = [
        {
            "name": "系统管理员",
            "code": "SYS_ADMIN",
            "description": "系统管理员，拥有所有权限",
            "permissions": ["*"]
        },
        {
            "name": "项目经理",
            "code": "PROJECT_MANAGER",
            "description": "项目经理，管理项目和任务",
            "permissions": ["create_task", "update_task", "delete_task", "create_workflow", "view_all"]
        },
        {
            "name": "开发者",
            "code": "DEVELOPER",
            "description": "开发者，执行任务",
            "permissions": ["view_task", "execute_task", "update_own_task"]
        },
        {
            "name": "查看者",
            "code": "VIEWER",
            "description": "只读权限，查看所有数据",
            "permissions": ["view_all"]
        }
    ]

    for role_data in initial_roles:
        try:
            existing_role = role_service.get_role_by_code(role_data["code"])
            if not existing_role:
                role = role_service.create_role(role_data)
                print(f"✅ 创建角色: {role.name} ({role.code})")
            else:
                print(f"⚠️ 角色已存在: {role_data['code']}")
        except Exception as e:
            print(f"❌ 创建角色失败: {role_data['code']} - {str(e)}")

    # 创建初始部门
    print("\n创建初始部门...")
    initial_departments = [
        {
            "name": "技术部",
            "code": "TECH",
            "description": "技术研发部门"
        },
        {
            "name": "产品部",
            "code": "PRODUCT",
            "description": "产品设计部门"
        },
        {
            "name": "运营部",
            "code": "OPERATION",
            "description": "运营支持部门"
        },
        {
            "name": "人事部",
            "code": "HR",
            "description": "人力资源部门"
        }
    ]

    for dept in initial_departments:
        try:
            # 创建部门作为组织架构节点
            org_node = org_chart_service.create_node({
                "name": dept["name"],
                "title": "部门",
                "department": dept["code"],
                "parent_id": None,
                "email": f"hr@{dept['code'].lower()}.company.com"
            })
            print(f"✅ 创建部门: {org_node.name}")
        except Exception as e:
            print(f"❌ 创建部门失败: {dept['code']} - {str(e)}")

    print("\n✅ 数据库初始化完成!")
    print("\n初始数据:")
    print("- 角色数量: 4")
    print("- 部门数量: 4")
    print("\n你可以通过以下 API 接口管理组织架构:")
    print("- GET /api/org/chart - 获取组织架构图")
    print("- GET /api/org/roles - 获取角色列表")
    print("- GET /api/org/members - 获取成员列表")
    print("- GET /api/org/goals - 获取目标列表")
    print("- GET /api/org/approvals - 获取审批列表")
    print("- GET /api/org/audit/logs - 获取审计日志")


if __name__ == "__main__":
    init_database()