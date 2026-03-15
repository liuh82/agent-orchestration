"""Project documents and agent-config sub-routes."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.project import Project
from app.models.project_document import ProjectDocument
from app.models.agent_config_file import AgentConfigFile
from app.models.user import User
from app.services.file_service import file_service
from app.schemas.common import success_response, error_response

router = APIRouter()


# ── Helpers ─────────────────────────────────────────────────


def _check_project(project_id: str, user: User, db: Session) -> Optional[Project]:
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == (user.id if user.role != "admin" else Project.user_id),
    ).first()
    return project


def _doc_to_dict(d: ProjectDocument) -> dict:
    return {
        "id": d.id,
        "project_id": d.project_id,
        "doc_type": d.doc_type,
        "title": d.title,
        "content": d.content,
        "file_path": d.file_path,
        "file_type": d.file_type,
        "file_size": d.file_size,
        "created_by": d.created_by,
        "created_at": d.created_at or "",
        "updated_at": d.updated_at or "",
    }


def _config_to_dict(c: AgentConfigFile) -> dict:
    return {
        "id": c.id,
        "project_id": c.project_id,
        "agent_type_id": c.agent_type_id,
        "config_type": c.config_type,
        "content": c.content,
        "is_template": c.is_template,
        "created_at": c.created_at or "",
        "updated_at": c.updated_at or "",
    }


# ── Project Documents ───────────────────────────────────────


@router.get("/documents/")
def list_documents(
    project_id: str,
    doc_type: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_project(project_id, user, db):
        return error_response(404, "Project not found")

    query = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id)
    if doc_type:
        query = query.filter(ProjectDocument.doc_type == doc_type)
    docs = query.order_by(ProjectDocument.created_at.desc()).all()
    return success_response([_doc_to_dict(d) for d in docs])


class DocumentCreate(BaseModel):
    doc_type: str
    title: str
    content: Optional[str] = None


@router.post("/documents/")
def create_document(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    body: Optional[DocumentCreate] = None,
    doc_type: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    project = _check_project(project_id, user, db)
    if not project:
        return error_response(404, "Project not found")

    # JSON body mode
    if body and not file:
        doc = ProjectDocument(
            project_id=project_id,
            doc_type=body.doc_type,
            title=body.title,
            content=body.content,
            created_by=user.id,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return success_response(_doc_to_dict(doc), "Document created")

    # Multipart file mode
    if file:
        try:
            meta = file_service.save_file(file)
        except ValueError as e:
            return error_response(400, str(e))

        doc = ProjectDocument(
            project_id=project_id,
            doc_type=doc_type or "custom",
            title=title or file.filename or "Untitled",
            file_path=meta["file_path"],
            file_type=meta["mime_type"],
            file_size=meta["file_size"],
            created_by=user.id,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return success_response(_doc_to_dict(doc), "Document uploaded")

    return error_response(400, "Provide JSON body or file upload")


@router.get("/documents/{doc_id}")
def get_document(
    project_id: str,
    doc_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_project(project_id, user, db):
        return error_response(404, "Project not found")

    doc = db.query(ProjectDocument).filter(
        ProjectDocument.id == doc_id,
        ProjectDocument.project_id == project_id,
    ).first()
    if not doc:
        return error_response(404, "Document not found")
    return success_response(_doc_to_dict(doc))


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    doc_type: Optional[str] = None


@router.put("/documents/{doc_id}")
def update_document(
    project_id: str,
    doc_id: str,
    body: DocumentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_project(project_id, user, db):
        return error_response(404, "Project not found")

    doc = db.query(ProjectDocument).filter(
        ProjectDocument.id == doc_id,
        ProjectDocument.project_id == project_id,
    ).first()
    if not doc:
        return error_response(404, "Document not found")

    if body.title is not None:
        doc.title = body.title
    if body.content is not None:
        doc.content = body.content
    if body.doc_type is not None:
        doc.doc_type = body.doc_type

    db.commit()
    db.refresh(doc)
    return success_response(_doc_to_dict(doc), "Document updated")


@router.delete("/documents/{doc_id}")
def delete_document(
    project_id: str,
    doc_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_project(project_id, user, db):
        return error_response(404, "Project not found")

    doc = db.query(ProjectDocument).filter(
        ProjectDocument.id == doc_id,
        ProjectDocument.project_id == project_id,
    ).first()
    if not doc:
        return error_response(404, "Document not found")

    if doc.file_path:
        file_service.delete_file(doc.file_path)

    db.delete(doc)
    db.commit()
    return success_response(None, "Document deleted")


# ── Agent Config Files ──────────────────────────────────────


@router.get("/agent-configs/")
def list_configs(
    project_id: str,
    agent_type_id: Optional[str] = Query(None),
    config_type: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_project(project_id, user, db):
        return error_response(404, "Project not found")

    query = db.query(AgentConfigFile).filter(AgentConfigFile.project_id == project_id)
    if agent_type_id:
        query = query.filter(AgentConfigFile.agent_type_id == agent_type_id)
    if config_type:
        query = query.filter(AgentConfigFile.config_type == config_type)
    configs = query.order_by(AgentConfigFile.created_at.desc()).all()
    return success_response([_config_to_dict(c) for c in configs])


class ConfigCreate(BaseModel):
    agent_type_id: Optional[str] = None
    config_type: str
    content: Optional[str] = None
    is_template: Optional[bool] = False


@router.post("/agent-configs/")
def create_config(
    project_id: str,
    body: ConfigCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _check_project(project_id, user, db)
    if not project:
        return error_response(404, "Project not found")

    config = AgentConfigFile(
        project_id=project_id,
        agent_type_id=body.agent_type_id,
        config_type=body.config_type,
        content=body.content,
        is_template=body.is_template or False,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return success_response(_config_to_dict(config), "Config created")


@router.get("/agent-configs/{config_id}")
def get_config(
    project_id: str,
    config_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_project(project_id, user, db):
        return error_response(404, "Project not found")

    config = db.query(AgentConfigFile).filter(
        AgentConfigFile.id == config_id,
        AgentConfigFile.project_id == project_id,
    ).first()
    if not config:
        return error_response(404, "Config not found")
    return success_response(_config_to_dict(config))


class ConfigUpdate(BaseModel):
    config_type: Optional[str] = None
    content: Optional[str] = None
    is_template: Optional[bool] = None


@router.put("/agent-configs/{config_id}")
def update_config(
    project_id: str,
    config_id: str,
    body: ConfigUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_project(project_id, user, db):
        return error_response(404, "Project not found")

    config = db.query(AgentConfigFile).filter(
        AgentConfigFile.id == config_id,
        AgentConfigFile.project_id == project_id,
    ).first()
    if not config:
        return error_response(404, "Config not found")

    if body.config_type is not None:
        config.config_type = body.config_type
    if body.content is not None:
        config.content = body.content
    if body.is_template is not None:
        config.is_template = body.is_template

    db.commit()
    db.refresh(config)
    return success_response(_config_to_dict(config), "Config updated")


@router.delete("/agent-configs/{config_id}")
def delete_config(
    project_id: str,
    config_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_project(project_id, user, db):
        return error_response(404, "Project not found")

    config = db.query(AgentConfigFile).filter(
        AgentConfigFile.id == config_id,
        AgentConfigFile.project_id == project_id,
    ).first()
    if not config:
        return error_response(404, "Config not found")

    db.delete(config)
    db.commit()
    return success_response(None, "Config deleted")
