import sqlite3
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from ..models.workflow import WorkflowDefinition, WorkflowTemplate


class WorkflowService:
    def __init__(self):
        self.conn = sqlite3.connect('workflows.db', check_same_thread=False)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                engine TEXT NOT NULL,
                definition TEXT,
                config TEXT,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS workflow_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                engine TEXT NOT NULL,
                category TEXT,
                definition TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        self.conn.commit()

    async def get_all_workflows(self) -> List[WorkflowDefinition]:
        """获取所有工作流"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM workflows ORDER BY created_at DESC')
        rows = cursor.fetchall()

        workflows = []
        for row in rows:
            workflow = WorkflowDefinition(
                id=row[0],
                name=row[1],
                description=row[2],
                engine=row[3],
                definition=row[4],
                config=row[5],
                created_by=row[6],
                created_at=datetime.fromisoformat(row[7]),
                updated_at=datetime.fromisoformat(row[8])
            )
            workflows.append(workflow)

        return workflows

    async def get_workflow(self, workflow_id: str) -> Optional[WorkflowDefinition]:
        """获取单个工作流"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM workflows WHERE id = ?', (workflow_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return WorkflowDefinition(
            id=row[0],
            name=row[1],
            description=row[2],
            engine=row[3],
            definition=row[4],
            config=row[5],
            created_by=row[6],
            created_at=datetime.fromisoformat(row[7]),
            updated_at=datetime.fromisoformat(row[8])
        )

    async def create_workflow(self, workflow: WorkflowDefinition) -> WorkflowDefinition:
        """创建新工作流"""
        workflow_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO workflows (id, name, description, engine,
                                 definition, config, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            workflow_id,
            workflow.name,
            workflow.description,
            workflow.engine,
            str(workflow.definition),
            str(workflow.config),
            'system',
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        return await self.get_workflow(workflow_id)

    async def update_workflow(self, workflow_id: str, workflow: WorkflowDefinition) -> Optional[WorkflowDefinition]:
        """更新工作流"""
        updated_at = datetime.now()

        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE workflows
            SET name = ?, description = ?, engine = ?,
                definition = ?, config = ?, updated_at = ?
            WHERE id = ?
        ''', (
            workflow.name,
            workflow.description,
            workflow.engine,
            str(workflow.definition),
            str(workflow.config),
            updated_at.isoformat(),
            workflow_id
        ))
        self.conn.commit()

        return await self.get_workflow(workflow_id)

    async def delete_workflow(self, workflow_id: str) -> bool:
        """删除工作流"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM workflows WHERE id = ?', (workflow_id,))
        self.conn.commit()
        return cursor.rowcount > 0

    async def get_templates(self) -> List[WorkflowTemplate]:
        """获取所有模板"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM workflow_templates ORDER BY created_at DESC')
        rows = cursor.fetchall()

        templates = []
        for row in rows:
            template = WorkflowTemplate(
                id=row[0],
                name=row[1],
                description=row[2],
                engine=row[3],
                category=row[4],
                definition=row[5],
                created_at=datetime.fromisoformat(row[6]),
                updated_at=datetime.fromisoformat(row[7])
            )
            templates.append(template)

        return templates

    async def get_template(self, template_id: str) -> Optional[WorkflowTemplate]:
        """获取单个模板"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM workflow_templates WHERE id = ?', (template_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return WorkflowTemplate(
            id=row[0],
            name=row[1],
            description=row[2],
            engine=row[3],
            category=row[4],
            definition=row[5],
            created_at=datetime.fromisoformat(row[6]),
            updated_at=datetime.fromisoformat(row[7])
        )

    async def create_template(self, template: WorkflowTemplate) -> WorkflowTemplate:
        """创建模板"""
        template_id = str(uuid4())
        created_at = datetime.now()
        updated_at = created_at

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO workflow_templates (id, name, description, engine,
                                         category, definition, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            template_id,
            template.name,
            template.description,
            template.engine,
            template.category,
            str(template.definition),
            created_at.isoformat(),
            updated_at.isoformat()
        ))
        self.conn.commit()

        return await self.get_template(template_id)

    async def delete_template(self, template_id: str) -> bool:
        """删除模板"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM workflow_templates WHERE id = ?', (template_id,))
        self.conn.commit()
        return cursor.rowcount > 0