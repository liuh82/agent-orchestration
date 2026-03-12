from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks

from ..models.task import TaskCreate, TaskUpdate, Task
from ..services.task import TaskService

router = APIRouter()

task_service = TaskService()


class TaskResponse(BaseModel):
    success: bool
    data: Optional[Task] = None
    message: str = ""


@router.get("/", response_model=List[Task])
async def get_tasks():
    """获取所有任务"""
    return await task_service.get_all_tasks()


@router.post("/", response_model=TaskResponse)
async def create_task(task: TaskCreate):
    """创建新任务"""
    try:
        db_task = await task_service.create_task(task)
        return TaskResponse(
            success=True,
            data=db_task,
            message="Task created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """获取单个任务"""
    task = await task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return TaskResponse(success=True, data=task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task: TaskUpdate):
    """更新任务"""
    updated_task = await task_service.update_task(task_id, task)
    if not updated_task:
        raise HTTPException(status_code=404, detail="Task not found")

    return TaskResponse(
        success=True,
        data=updated_task,
        message="Task updated successfully"
    )


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """删除任务"""
    deleted = await task_service.delete_task(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"success": True, "message": "Task deleted successfully"}


@router.post("/{task_id}/execute")
async def execute_task(task_id: str):
    """执行任务"""
    # TODO: 实现任务执行逻辑
    return {"success": True, "message": "Task execution started"}


@router.post("/{task_id}/pause")
async def pause_task(task_id: str):
    """暂停任务"""
    # TODO: 实现任务暂停逻辑
    return {"success": True, "message": "Task paused"}


@router.post("/{task_id}/resume")
async def resume_task(task_id: str):
    """恢复任务"""
    # TODO: 实现任务恢复逻辑
    return {"success": True, "message": "Task resumed"}


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str):
    """取消任务"""
    # TODO: 实现任务取消逻辑
    return {"success": True, "message": "Task cancelled"}


@router.post("/{task_id}/assign")
async def assign_task(task_id: str, agent_id: str):
    """分配任务给 Agent"""
    updated_task = await task_service.assign_task(task_id, agent_id)
    if not updated_task:
        raise HTTPException(status_code=404, detail="Task not found")

    return {
        "success": True,
        "data": updated_task,
        "message": "Task assigned successfully"
    }