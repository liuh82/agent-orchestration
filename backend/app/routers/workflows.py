from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException

from ..models.workflow import WorkflowDefinition, WorkflowTemplate
from ..services.workflow import WorkflowService
from ..services.workflow_engine_registry import workflow_engine_registry

router = APIRouter()

workflow_service = WorkflowService()


class WorkflowResponse(BaseModel):
    success: bool
    data: Optional[WorkflowDefinition] = None
    message: str = ""


@router.get("/", response_model=List[WorkflowDefinition])
async def get_workflows():
    """获取所有工作流"""
    return await workflow_service.get_all_workflows()


@router.post("/", response_model=WorkflowResponse)
async def create_workflow(workflow: WorkflowDefinition):
    """创建新工作流"""
    try:
        db_workflow = await workflow_service.create_workflow(workflow)
        return WorkflowResponse(
            success=True,
            data=db_workflow,
            message="Workflow created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str):
    """获取单个工作流"""
    workflow = await workflow_service.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return WorkflowResponse(success=True, data=workflow)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(workflow_id: str, workflow: WorkflowDefinition):
    """更新工作流"""
    updated_workflow = await workflow_service.update_workflow(workflow_id, workflow)
    if not updated_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return WorkflowResponse(
        success=True,
        data=updated_workflow,
        message="Workflow updated successfully"
    )


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """删除工作流"""
    deleted = await workflow_service.delete_workflow(workflow_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return {"success": True, "message": "Workflow deleted successfully"}


@router.post("/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, context: dict = {}):
    """执行工作流"""
    # 获取工作流定义
    workflow = await workflow_service.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # 检查是否有对应的引擎
    engine = workflow_engine_registry.get(workflow.engine)
    if not engine:
        raise HTTPException(status_code=400, detail=f"Engine '{workflow.engine}' not available")

    try:
        # 执行工作流
        result = await engine.execute(workflow, context)

        # 记录执行日志
        execution_id = str(hash(workflow_id + str(context)))

        return {
            "success": True,
            "message": "Workflow execution started",
            "execution_id": execution_id,
            "engine": workflow.engine,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute workflow: {str(e)}")


@router.get("/status/{execution_id}")
async def get_workflow_status(execution_id: str):
    """获取工作流执行状态"""
    # TODO: 实现从缓存或数据库获取执行状态
    return {
        "success": True,
        "data": {
            "id": execution_id,
            "status": "running",
            "progress": 50,
            "current_step": "执行任务中",
            "created_at": datetime.now().isoformat()
        }
    }


@router.get("/logs/{execution_id}")
async def get_workflow_logs(execution_id: str):
    """获取工作流执行日志"""
    # TODO: 实现从缓存或数据库获取执行日志
    return {
        "success": True,
        "data": [
            {
                "id": "1",
                "timestamp": datetime.now().isoformat(),
                "level": "info",
                "message": "工作流开始执行",
                "data": None
            }
        ]
    }


@router.get("/templates", response_model=List[WorkflowTemplate])
async def get_templates():
    """获取工作流模板"""
    return await workflow_service.get_templates()


@router.get("/templates/{template_id}", response_model=WorkflowTemplate)
async def get_template(template_id: str):
    """获取单个模板"""
    template = await workflow_service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.post("/templates/", response_model=WorkflowTemplate)
async def create_template(template: WorkflowTemplate):
    """创建模板"""
    return await workflow_service.create_template(template)


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    """删除模板"""
    deleted = await workflow_service.delete_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"success": True, "message": "Template deleted successfully"}