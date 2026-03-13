from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel

from ..models.task import TaskCreate, TaskUpdate, Task
from ..services.task import TaskService
from ..database import get_db

router = APIRouter()


class TaskResponse(BaseModel):
    success: bool
    data: Optional[Task] = None
    message: str = ""


@router.get("/", response_model=List[Task])
async def get_tasks(db = Depends(get_db)):
    """获取所有任务"""
    task_service = TaskService(db)
    return task_service.get_all_tasks()


@router.post("/", response_model=TaskResponse)
async def create_task(task: TaskCreate, db = Depends(get_db)):
    """创建新任务"""
    try:
        task_service = TaskService(db)
        db_task = task_service.create_task(task)
        return TaskResponse(
            success=True,
            data=db_task,
            message="Task created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db = Depends(get_db)):
    """获取单个任务"""
    task_service = TaskService(db)
    task = task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return TaskResponse(success=True, data=task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task: TaskUpdate, db = Depends(get_db)):
    """更新任务"""
    task_service = TaskService(db)
    updated_task = task_service.update_task(task_id, task)
    if not updated_task:
        raise HTTPException(status_code=404, detail="Task not found")

    return TaskResponse(
        success=True,
        data=updated_task,
        message="Task updated successfully"
    )


@router.delete("/{task_id}")
async def delete_task(task_id: str, db = Depends(get_db)):
    """删除任务"""
    task_service = TaskService(db)
    deleted = task_service.delete_task(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"success": True, "message": "Task deleted successfully"}


@router.post("/{task_id}/execute")
async def execute_task(task_id: str, db = Depends(get_db)):
    """执行任务"""
    # TODO: 实现任务执行逻辑
    return {"success": True, "message": "Task execution started"}


@router.post("/{task_id}/pause")
async def pause_task(task_id: str, db = Depends(get_db)):
    """暂停任务"""
    # TODO: 实现任务暂停逻辑
    return {"success": True, "message": "Task paused"}


@router.post("/{task_id}/resume")
async def resume_task(task_id: str, db = Depends(get_db)):
    """恢复任务"""
    # TODO: 实现任务恢复逻辑
    return {"success": True, "message": "Task resumed"}


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str, db = Depends(get_db)):
    """取消任务"""
    # TODO: 实现任务取消逻辑
    return {"success": True, "message": "Task cancelled"}


@router.post("/{task_id}/assign")
async def assign_task(task_id: str, agent_id: str, db = Depends(get_db)):
    """分配任务给 Agent"""
    task_service = TaskService(db)
    updated_task = await task_service.assign_task(task_id, agent_id)
    if not updated_task:
        raise HTTPException(status_code=404, detail="Task not found")

    return {
        "success": True,
        "data": updated_task,
        "message": "Task assigned successfully"
    }