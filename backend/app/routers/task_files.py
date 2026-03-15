"""Task file sub-routes — upload, download, delete."""
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.task import NexusTask
from app.models.task_file import TaskFile
from app.models.user import User
from app.services.file_service import file_service
from app.schemas.common import success_response, error_response

router = APIRouter()


def _check_task(task_id: str, user: User, db: Session) -> Optional[NexusTask]:
    query = db.query(NexusTask).filter(NexusTask.id == task_id)
    if user.role != "admin":
        query = query.filter(NexusTask.user_id == user.id)
    return query.first()


def _file_to_dict(f: TaskFile) -> dict:
    return {
        "id": f.id,
        "task_id": f.task_id,
        "file_type": f.file_type,
        "file_name": f.file_name,
        "file_path": f.file_path,
        "file_size": f.file_size,
        "mime_type": f.mime_type,
        "uploaded_by": f.uploaded_by,
        "created_at": f.created_at or "",
    }


# ── GET /tasks/:task_id/files ───────────────────────────────


@router.get("/")
def list_task_files(
    task_id: str,
    file_type: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_task(task_id, user, db):
        return error_response(404, "Task not found")

    query = db.query(TaskFile).filter(TaskFile.task_id == task_id)
    if file_type:
        query = query.filter(TaskFile.file_type == file_type)
    files = query.order_by(TaskFile.created_at.desc()).all()
    return success_response([_file_to_dict(f) for f in files])


# ── POST /tasks/:task_id/files ──────────────────────────────


@router.post("/")
def upload_task_file(
    task_id: str,
    file_type: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _check_task(task_id, user, db)
    if not task:
        return error_response(404, "Task not found")

    try:
        meta = file_service.save_file(file)
    except ValueError as e:
        return error_response(400, str(e))

    tf = TaskFile(
        task_id=task_id,
        file_type=file_type,
        file_name=meta["file_name"],
        file_path=meta["file_path"],
        file_size=meta["file_size"],
        mime_type=meta["mime_type"],
        uploaded_by=user.id,
    )
    db.add(tf)
    db.commit()
    db.refresh(tf)
    return success_response(_file_to_dict(tf), "File uploaded")


# ── GET /tasks/:task_id/files/:file_id/download ─────────────


@router.get("/{file_id}/download")
def download_task_file(
    task_id: str,
    file_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_task(task_id, user, db):
        return error_response(404, "Task not found")

    tf = db.query(TaskFile).filter(
        TaskFile.id == file_id,
        TaskFile.task_id == task_id,
    ).first()
    if not tf:
        return error_response(404, "File not found")

    abs_path = file_service.get_abs_path(tf.file_path)
    if not abs_path:
        return error_response(404, "File not found on disk")

    return FileResponse(
        path=abs_path,
        filename=tf.file_name,
        media_type=tf.mime_type or "application/octet-stream",
    )


# ── DELETE /tasks/:task_id/files/:file_id ───────────────────


@router.delete("/{file_id}")
def delete_task_file(
    task_id: str,
    file_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _check_task(task_id, user, db):
        return error_response(404, "Task not found")

    tf = db.query(TaskFile).filter(
        TaskFile.id == file_id,
        TaskFile.task_id == task_id,
    ).first()
    if not tf:
        return error_response(404, "File not found")

    if tf.file_path:
        file_service.delete_file(tf.file_path)

    db.delete(tf)
    db.commit()
    return success_response(None, "File deleted")
