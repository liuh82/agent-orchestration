from datetime import datetime
import json
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select, update, delete
from sqlalchemy.orm import Session

from ..models.workflow import WorkflowDefinition, WorkflowTemplate
from ..models.orm_models import Workflow as WorkflowDefinitionORM, WorkflowTemplate as WorkflowTemplateORM


def _safe_json_parse(val, default=None):
    """Safely parse JSON string, returning dict or default on failure."""
    if not val:
        return default
    if isinstance(val, (dict, list)):
        return val
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_workflows(self) -> List[dict]:
        """获取所有工作流"""
        result = self.db.execute(
            select(WorkflowDefinitionORM).order_by(WorkflowDefinitionORM.created_at.desc())
        )
        workflow_orms = result.scalars().all()

        workflows = []
        for wo in workflow_orms:
            workflows.append({
                "id": wo.id,
                "name": wo.name,
                "description": wo.description,
                "engine": wo.engine,
                "definition": _safe_json_parse(wo.definition),
                "config": _safe_json_parse(wo.config, default={}),
                "created_by": wo.created_by,
                "created_at": wo.created_at,
                "updated_at": wo.updated_at,
            })

        return workflows

    def get_workflow(self, workflow_id: str) -> Optional[dict]:
        """获取单个工作流"""
        result = self.db.execute(
            select(WorkflowDefinitionORM).where(WorkflowDefinitionORM.id == workflow_id)
        )
        wo = result.scalar_one_or_none()

        if not wo:
            return None

        return {
            "id": wo.id,
            "name": wo.name,
            "description": wo.description,
            "engine": wo.engine,
            "definition": _safe_json_parse(wo.definition),
            "config": _safe_json_parse(wo.config, default={}),
            "created_by": wo.created_by,
            "created_at": wo.created_at,
            "updated_at": wo.updated_at,
        }

    def create_workflow(self, workflow: WorkflowDefinition) -> WorkflowDefinition:
        """创建新工作流"""
        workflow_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        workflow_orm = WorkflowDefinitionORM(
            id=workflow_id,
            name=workflow.name,
            description=workflow.description,
            engine=workflow.engine,
            definition=json.dumps(workflow.definition),
            config=json.dumps(workflow.config),
            created_by='system',
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        self.db.add(workflow_orm)
        self.db.commit()
        self.db.refresh(workflow_orm)

        return self.get_workflow(workflow_id)

    def update_workflow(self, workflow_id: str, workflow: WorkflowDefinition) -> Optional[WorkflowDefinition]:
        """更新工作流"""
        result = self.db.execute(
            select(WorkflowDefinitionORM).where(WorkflowDefinitionORM.id == workflow_id)
        )
        workflow_orm = result.scalar_one_or_none()

        if not workflow_orm:
            return None

        updated_at = datetime.now()

        workflow_orm.name = workflow.name
        workflow_orm.description = workflow.description
        workflow_orm.engine = workflow.engine
        workflow_orm.definition = json.dumps(workflow.definition)
        workflow_orm.config = json.dumps(workflow.config)
        workflow_orm.updated_at = updated_at.isoformat()

        self.db.commit()
        self.db.refresh(workflow_orm)

        return self.get_workflow(workflow_id)

    def delete_workflow(self, workflow_id: str) -> bool:
        """删除工作流"""
        result = self.db.execute(
            select(WorkflowDefinitionORM).where(WorkflowDefinitionORM.id == workflow_id)
        )
        workflow_orm = result.scalar_one_or_none()

        if not workflow_orm:
            return False

        self.db.delete(workflow_orm)
        self.db.commit()

        return True

    def get_templates(self) -> List[WorkflowTemplate]:
        """获取所有模板"""
        result = self.db.execute(
            select(WorkflowTemplateORM).order_by(WorkflowTemplateORM.created_at.desc())
        )
        template_orms = result.scalars().all()

        templates = []
        for template_orm in template_orms:
            template = WorkflowTemplate(
                id=template_orm.id,
                name=template_orm.name,
                description=template_orm.description,
                engine=template_orm.engine,
                category=template_orm.category,
                definition=template_orm.definition,
                created_at=datetime.fromisoformat(template_orm.created_at),
                updated_at=datetime.fromisoformat(template_orm.updated_at)
            )
            templates.append(template)

        return templates

    def get_template(self, template_id: str) -> Optional[WorkflowTemplate]:
        """获取单个模板"""
        result = self.db.execute(
            select(WorkflowTemplateORM).where(WorkflowTemplateORM.id == template_id)
        )
        template_orm = result.scalar_one_or_none()

        if not template_orm:
            return None

        return WorkflowTemplate(
            id=template_orm.id,
            name=template_orm.name,
            description=template_orm.description,
            engine=template_orm.engine,
            category=template_orm.category,
            definition=template_orm.definition,
            created_at=datetime.fromisoformat(template_orm.created_at),
            updated_at=datetime.fromisoformat(template_orm.updated_at)
        )

    def create_template(self, template: WorkflowTemplate) -> WorkflowTemplate:
        """创建模板"""
        template_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        template_orm = WorkflowTemplateORM(
            id=template_id,
            name=template.name,
            description=template.description,
            engine=template.engine,
            category=template.category,
            definition=json.dumps(template.definition),
            created_at=created_at.isoformat(),
            updated_at=updated_at.isoformat()
        )

        self.db.add(template_orm)
        self.db.commit()
        self.db.refresh(template_orm)

        return self.get_template(template_id)

    def delete_template(self, template_id: str) -> bool:
        """删除模板"""
        result = self.db.execute(
            select(WorkflowTemplateORM).where(WorkflowTemplateORM.id == template_id)
        )
        template_orm = result.scalar_one_or_none()

        if not template_orm:
            return False

        self.db.delete(template_orm)
        self.db.commit()

        return True