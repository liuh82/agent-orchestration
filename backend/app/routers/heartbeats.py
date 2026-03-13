import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks

from ..models.heartbeat import (
    HeartbeatCreate, HeartbeatUpdate, Heartbeat,
    HeartbeatResponse, HeartbeatListResponse
)
from ..models.heartbeat_log import (
    HeartbeatLog, HeartbeatLogCreate,
    HeartbeatLogListResponse
)
from ..services.heartbeat import HeartbeatService
from ..services.scheduler import scheduler

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize services
heartbeat_service = HeartbeatService()
scheduler.set_heartbeat_service(heartbeat_service)


@router.get("", response_model=HeartbeatListResponse)
async def get_heartbeats():
    """Get all heartbeat configurations"""
    heartbeats = await heartbeat_service.get_all_heartbeats()
    # Batch get next run times to avoid N+1 query
    heartbeat_ids = [hb.id for hb in heartbeats]
    jobs_info = scheduler.get_jobs_info_batch(heartbeat_ids)

    heartbeats_with_next_run = []
    for hb in heartbeats:
        hb_dict = hb.model_dump()
        job_info = jobs_info.get(hb.id)
        if job_info:
            hb_dict["next_run_at"] = job_info["next_run_time"]
        heartbeats_with_next_run.append(hb_dict)

    return HeartbeatListResponse(
        success=True,
        data=heartbeats_with_next_run,
        message="Heartbeats retrieved successfully"
    )


@router.get("/stats")
async def get_heartbeat_stats():
    """Get heartbeat statistics"""
    try:
        stats = await heartbeat_service.get_stats()
        return {
            "success": True,
            "data": stats,
            "message": "Stats retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Failed to get heartbeat stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve heartbeat statistics")


@router.get("/{heartbeat_id}", response_model=HeartbeatResponse)
async def get_heartbeat(heartbeat_id: str):
    """Get single heartbeat configuration"""
    try:
        heartbeat = await heartbeat_service.get_heartbeat(heartbeat_id)
        if not heartbeat:
            raise HTTPException(status_code=404, detail="Heartbeat not found")

        # Add next run time from scheduler
        job_info = scheduler.get_job_info(heartbeat_id)
        hb_dict = heartbeat.model_dump()
        if job_info:
            hb_dict["next_run_at"] = job_info["next_run_time"]

        return HeartbeatResponse(
            success=True,
            data=hb_dict,
            message="Heartbeat retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get heartbeat {heartbeat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve heartbeat")


@router.post("", response_model=HeartbeatResponse)
async def create_heartbeat(data: HeartbeatCreate, background_tasks: BackgroundTasks):
    """Create new heartbeat configuration"""
    try:
        new_heartbeat = await heartbeat_service.create_heartbeat(data)

        # Schedule heartbeat
        if data.is_active:
            scheduler.schedule_heartbeat(new_heartbeat.id, data.interval_seconds)

        return HeartbeatResponse(
            success=True,
            data=new_heartbeat,
            message="Heartbeat created successfully"
        )
    except ValueError as e:
        logger.error(f"Invalid heartbeat data: {e}")
        raise HTTPException(status_code=400, detail="Invalid heartbeat data")
    except Exception as e:
        logger.error(f"Failed to create heartbeat: {e}")
        raise HTTPException(status_code=500, detail="Failed to create heartbeat")


@router.put("/{heartbeat_id}", response_model=HeartbeatResponse)
async def update_heartbeat(heartbeat_id: str, data: HeartbeatUpdate):
    """Update heartbeat configuration"""
    try:
        updated_heartbeat = await heartbeat_service.update_heartbeat(heartbeat_id, data)
        if not updated_heartbeat:
            raise HTTPException(status_code=404, detail="Heartbeat not found")

        # Reschedule if active and interval changed
        if data.is_active is not None or data.interval_seconds is not None:
            if updated_heartbeat.is_active:
                scheduler.schedule_heartbeat(heartbeat_id, updated_heartbeat.interval_seconds)
            else:
                scheduler.unschedule_heartbeat(heartbeat_id)

        return HeartbeatResponse(
            success=True,
            data=updated_heartbeat,
            message="Heartbeat updated successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update heartbeat {heartbeat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update heartbeat")


@router.delete("/{heartbeat_id}")
async def delete_heartbeat(heartbeat_id: str):
    """Delete heartbeat configuration"""
    try:
        deleted = await heartbeat_service.delete_heartbeat(heartbeat_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Heartbeat not found")

        # Unschedule job
        scheduler.unschedule_heartbeat(heartbeat_id)

        return {
            "success": True,
            "message": "Heartbeat deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete heartbeat {heartbeat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete heartbeat")


@router.post("/{heartbeat_id}/enable")
async def enable_heartbeat(heartbeat_id: str):
    """Enable a heartbeat"""
    try:
        heartbeat = await heartbeat_service.get_heartbeat(heartbeat_id)
        if not heartbeat:
            raise HTTPException(status_code=404, detail="Heartbeat not found")

        # Update heartbeat
        updated = await heartbeat_service.update_heartbeat(
            heartbeat_id,
            HeartbeatUpdate(is_active=True)
        )

        # Schedule job
        scheduler.schedule_heartbeat(heartbeat_id, updated.interval_seconds)

        return {
            "success": True,
            "message": "Heartbeat enabled successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to enable heartbeat {heartbeat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to enable heartbeat")


@router.post("/{heartbeat_id}/disable")
async def disable_heartbeat(heartbeat_id: str):
    """Disable a heartbeat"""
    try:
        heartbeat = await heartbeat_service.get_heartbeat(heartbeat_id)
        if not heartbeat:
            raise HTTPException(status_code=404, detail="Heartbeat not found")

        # Update heartbeat
        await heartbeat_service.update_heartbeat(
            heartbeat_id,
            HeartbeatUpdate(is_active=False)
        )

        # Unschedule job
        scheduler.unschedule_heartbeat(heartbeat_id)

        return {
            "success": True,
            "message": "Heartbeat disabled successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to disable heartbeat {heartbeat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to disable heartbeat")


@router.post("/{heartbeat_id}/trigger")
async def trigger_heartbeat(heartbeat_id: str, background_tasks: BackgroundTasks):
    """Manually trigger a heartbeat execution"""
    try:
        heartbeat = await heartbeat_service.get_heartbeat(heartbeat_id)
        if not heartbeat:
            raise HTTPException(status_code=404, detail="Heartbeat not found")

        # Execute in background
        background_tasks.add_task(scheduler.trigger_manually, heartbeat_id)

        return {
            "success": True,
            "message": "Heartbeat triggered successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger heartbeat {heartbeat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to trigger heartbeat")


@router.get("/{heartbeat_id}/logs", response_model=HeartbeatLogListResponse)
async def get_heartbeat_logs(heartbeat_id: str, limit: int = 50):
    """Get execution history for a heartbeat"""
    try:
        logs = await heartbeat_service.get_logs_by_heartbeat(heartbeat_id, limit)
        return HeartbeatLogListResponse(
            success=True,
            data=logs,
            message="Logs retrieved successfully"
        )
    except Exception as e:
        logger.error(f"Failed to get logs for heartbeat {heartbeat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve logs")
