"""Input node — extracts context data from project/task as workflow entry point."""
import logging
import os
import time
from typing import Any, Dict, List, Optional

from ..registry import NodeRegistry
from .base import BaseNodeExecutor, NodeContext, NodeResult, NodeStatus

logger = logging.getLogger(__name__)

# Field options per source type
SOURCE_FIELDS: Dict[str, List[str]] = {
    "project": ["title", "description", "documents"],
    "task": ["title", "description", "requirements", "input_files"],
}

# Text file extensions that we read content for
_TEXT_EXTENSIONS = {
    ".txt", ".md", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml",
    ".toml", ".cfg", ".ini", ".sh", ".bash", ".zsh", ".html", ".css", ".scss",
    ".less", ".sql", ".r", ".go", ".rs", ".java", ".kt", ".c", ".h", ".cpp",
    ".hpp", ".rb", ".php", ".swift", ".dart", ".lua", ".pl", ".ex", ".exs",
}


@NodeRegistry.register(
    "input",
    label="输入",
    description="Extract context data from project/task as workflow entry point",
    category="trigger",
    icon="folder-open",
)
class InputNodeExecutor(BaseNodeExecutor):
    """Extracts context data from project, task, manual input, or upstream."""

    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "label": {
                "type": "string",
                "title": "标签",
                "default": "输入",
            },
            "source": {
                "type": "string",
                "title": "数据来源",
                "enum": ["project", "task", "manual", "upstream"],
                "default": "project",
            },
            "fields": {
                "type": "array",
                "title": "提取字段",
                "items": {"type": "string"},
                "default": ["title", "description"],
            },
            "includeFiles": {
                "type": "boolean",
                "title": "包含附件文件",
                "default": True,
            },
            "template": {
                "type": "string",
                "title": "组装模板（可选）",
                "description": "用 {{ field }} 引用字段",
            },
            "outputAlias": {
                "type": "string",
                "title": "输出变量名",
                "default": "input",
            },
        },
        "required": ["source"],
    }

    async def execute(self, context: NodeContext) -> NodeResult:
        start = time.time()
        source = context.node_config.get("source", "project")
        fields: List[str] = context.node_config.get("fields", ["title", "description"])
        include_files: bool = context.node_config.get("includeFiles", True)
        template: Optional[str] = context.node_config.get("template")
        output_alias: str = context.node_config.get("outputAlias", "input")

        try:
            collected: Dict[str, Any] = {}

            if source == "project":
                collected = await self._extract_from_project(context, fields, include_files)
            elif source == "task":
                collected = await self._extract_from_task(context, fields, include_files)
            elif source == "manual":
                collected = dict(context.input_data)
            elif source == "upstream":
                collected = dict(context.upstream_outputs)
            else:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"Unknown source type: {source}",
                )

            # Filter by requested fields (but always keep task_description)
            if fields:
                filtered: Dict[str, Any] = {}
                for f in fields:
                    if f in collected:
                        filtered[f] = collected[f]
                # Always pass through extra fields like task_description
                for key in collected:
                    if key not in filtered and key.startswith('task_'):
                        filtered[key] = collected[key]
                collected = filtered

            # Template rendering
            if template:
                rendered = template
                for key, value in collected.items():
                    placeholder = "{{ " + key + " }}"
                    if isinstance(value, str):
                        rendered = rendered.replace(placeholder, value)
                    elif isinstance(value, list):
                        rendered = rendered.replace(placeholder, str(value))
                    elif value is not None:
                        rendered = rendered.replace(placeholder, str(value))
                collected["template_output"] = rendered

            duration_ms = int((time.time() - start) * 1000)
            return NodeResult(
                status=NodeStatus.SUCCESS,
                output_data={output_alias: collected},
                duration_ms=duration_ms,
            )
        except Exception as e:
            logger.warning("Input node error: %s", e)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=str(e),
            )

    async def _extract_from_project(
        self,
        context: NodeContext,
        fields: List[str],
        include_files: bool,
    ) -> Dict[str, Any]:
        """Extract data from project and project_documents."""
        db = context.db_session
        project_id = context.input_data.get("project_id")
        if not db or not project_id:
            logger.warning("Input node: no db session or project_id in input_data")
            return {}

        from app.models.project import Project

        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return {"error": f"Project not found: {project_id}"}

        result: Dict[str, Any] = {}
        if "title" in fields:
            result["title"] = project.name
        if "description" in fields:
            result["description"] = project.description or ""

        # Merge task-level fields from input_data if present
        task_desc = context.input_data.get("description", "")
        if task_desc:
            result["task_description"] = task_desc

        # Load project documents
        if "documents" in fields:
            from app.models.project_document import ProjectDocument

            docs = db.query(ProjectDocument).filter(
                ProjectDocument.project_id == project_id,
            ).all()
            result["documents"] = []
            for d in docs:
                doc_entry = {
                    "id": d.id,
                    "title": d.title,
                    "doc_type": d.doc_type,
                    "content": d.content,
                    "file_path": d.file_path,
                    "file_type": d.file_type,
                }
                # Read file content if content is empty but file exists
                if not doc_entry["content"] and doc_entry["file_path"] and os.path.isfile(doc_entry["file_path"]):
                    ext = os.path.splitext(doc_entry["file_path"])[1].lower()
                    if ext in _TEXT_EXTENSIONS:
                        try:
                            with open(doc_entry["file_path"], "r", encoding="utf-8") as f:
                                doc_entry["content"] = f.read()
                        except Exception:
                            pass
                result["documents"].append(doc_entry)

        # Load files if includeFiles
        if include_files:
            from app.models.project_document import ProjectDocument

            file_docs = db.query(ProjectDocument).filter(
                ProjectDocument.project_id == project_id,
                ProjectDocument.file_path.isnot(None),
            ).all()
            files = []
            for fd in file_docs:
                file_entry = {
                    "name": os.path.basename(fd.file_path) if fd.file_path else fd.title,
                    "path": fd.file_path,
                }
                if fd.file_path and os.path.isfile(fd.file_path):
                    ext = os.path.splitext(fd.file_path)[1].lower()
                    if ext in _TEXT_EXTENSIONS:
                        try:
                            with open(fd.file_path, "r", encoding="utf-8") as f:
                                file_entry["content"] = f.read()
                        except Exception:
                            pass
                if fd.content:
                    file_entry["content"] = fd.content
                files.append(file_entry)
            if files:
                result["files"] = files

        return result

    async def _extract_from_task(
        self,
        context: NodeContext,
        fields: List[str],
        include_files: bool,
    ) -> Dict[str, Any]:
        """Extract data from task and task files."""
        db = context.db_session
        task_id = context.input_data.get("task_id")
        if not db or not task_id:
            logger.warning("Input node: no db session or task_id in input_data")
            return {}

        from app.models.task import NexusTask

        task = db.query(NexusTask).filter(NexusTask.id == task_id).first()
        if not task:
            return {"error": f"Task not found: {task_id}"}

        result: Dict[str, Any] = {}
        if "title" in fields:
            result["title"] = task.title or task.name
        if "description" in fields:
            result["description"] = task.description or ""
        if "requirements" in fields:
            result["requirements"] = task.spec or ""

        # Load task files (stored as task_files relation or input_data)
        if include_files and "input_files" in fields:
            # Task files can be referenced from input_data
            input_files = context.input_data.get("input_files", [])
            files = []
            for fp in input_files:
                file_entry: Dict[str, Any] = {"name": os.path.basename(fp), "path": fp}
                if os.path.isfile(str(fp)):
                    ext = os.path.splitext(str(fp))[1].lower()
                    if ext in _TEXT_EXTENSIONS:
                        try:
                            with open(str(fp), "r", encoding="utf-8") as f:
                                file_entry["content"] = f.read()
                        except Exception:
                            pass
                files.append(file_entry)
            if files:
                result["input_files"] = files

        return result
