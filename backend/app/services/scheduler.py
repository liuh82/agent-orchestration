import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, List

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.jobstores.memory import MemoryJobStore

from .heartbeat import HeartbeatService
from ..models.heartbeat_log import HeartbeatLogStatus, HeartbeatLogCreate

logger = logging.getLogger(__name__)

# 从环境变量读取时区，默认 Asia/Shanghai
TIMEZONE = os.getenv("SCHEDULER_TIMEZONE", "Asia/Shanghai")


class SchedulerService:
    """APScheduler wrapper for heartbeat execution"""

    _instance: Optional["SchedulerService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        self.scheduler = AsyncIOScheduler(
            jobstore=MemoryJobStore(),
            timezone=TIMEZONE
        )
        self.heartbeat_service: Optional[HeartbeatService] = None
        self._is_running = False

    def set_heartbeat_service(self, service: HeartbeatService):
        """Set heartbeat service"""
        self.heartbeat_service = service

    def start(self):
        """Start scheduler"""
        if not self._is_running:
            self.scheduler.start()
            self._is_running = True
            logger.info(f"Heartbeat scheduler started (timezone: {TIMEZONE})")

    def shutdown(self, wait: bool = True):
        """Shutdown scheduler"""
        if self._is_running:
            self.scheduler.shutdown(wait=wait)
            self._is_running = False
            logger.info("Heartbeat scheduler shutdown")

    async def load_and_schedule_heartbeats(self):
        """Load active heartbeats from DB and schedule them"""
        if not self.heartbeat_service:
            logger.warning("Heartbeat service not set, skipping load")
            return

        heartbeats = await self.heartbeat_service.get_active_heartbeats()
        logger.info(f"Loading {len(heartbeats)} active heartbeats")

        for hb in heartbeats:
            self.schedule_heartbeat(hb.id, hb.interval_seconds)

    def schedule_heartbeat(self, heartbeat_id: str, interval_seconds: int):
        """Schedule a heartbeat job"""
        job_id = f"heartbeat_{heartbeat_id}"

        # Remove existing job if any
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
            logger.info(f"Removed existing job for heartbeat {heartbeat_id}")

        # Add new job
        self.scheduler.add_job(
            self._execute_heartbeat_with_retry,
            trigger=IntervalTrigger(seconds=interval_seconds),
            args=[heartbeat_id],
            id=job_id,
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=60
        )
        logger.info(f"Scheduled heartbeat {heartbeat_id} every {interval_seconds}s")

    def unschedule_heartbeat(self, heartbeat_id: str):
        """Remove a heartbeat job"""
        job_id = f"heartbeat_{heartbeat_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
            logger.info(f"Unscheduled heartbeat {heartbeat_id}")

    def get_job_info(self, heartbeat_id: str) -> Optional[dict]:
        """Get job information"""
        job_id = f"heartbeat_{heartbeat_id}"
        job = self.scheduler.get_job(job_id)
        if not job:
            return None
        return {
            "id": job.id,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
        }

    def get_jobs_info_batch(self, heartbeat_ids: List[str]) -> dict[str, Optional[dict]]:
        """Batch get job information for multiple heartbeats (solves N+1 query)"""
        result = {}
        for heartbeat_id in heartbeat_ids:
            job_id = f"heartbeat_{heartbeat_id}"
            job = self.scheduler.get_job(job_id)
            if job:
                result[heartbeat_id] = {
                    "id": job.id,
                    "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                }
            else:
                result[heartbeat_id] = None
        return result

    async def _execute_heartbeat_with_retry(self, heartbeat_id: str, max_retries: int = 3):
        """Execute heartbeat with retry mechanism"""
        retry_count = 0
        last_error = None

        while retry_count < max_retries:
            try:
                await self.execute_heartbeat(heartbeat_id)
                # Success, exit retry loop
                return
            except Exception as e:
                retry_count += 1
                last_error = e
                logger.warning(
                    f"Heartbeat {heartbeat_id} execution failed (attempt {retry_count}/{max_retries}): {e}"
                )
                if retry_count < max_retries:
                    # Exponential backoff: 1s, 2s, 4s
                    backoff = 2 ** (retry_count - 1)
                    await asyncio.sleep(backoff)

        # All retries failed
        logger.error(f"Heartbeat {heartbeat_id} failed after {max_retries} retries: {last_error}")

    async def execute_heartbeat(self, heartbeat_id: str):
        """Execute a heartbeat task"""
        if not self.heartbeat_service:
            logger.error(f"Cannot execute heartbeat {heartbeat_id}: service not set")
            return

        heartbeat = await self.heartbeat_service.get_heartbeat(heartbeat_id)
        if not heartbeat:
            logger.warning(f"Heartbeat {heartbeat_id} not found, skipping execution")
            return

        if not heartbeat.is_active:
            logger.debug(f"Heartbeat {heartbeat_id} is inactive, skipping execution")
            return

        logger.info(f"Executing heartbeat {heartbeat_id}: {heartbeat.name}")

        # Create log entry
        log_data = HeartbeatLogCreate(
            heartbeat_id=heartbeat_id,
            status=HeartbeatLogStatus.RUNNING
        )
        log = await self.heartbeat_service.create_log(log_data)

        # Execute action
        result = None
        error_message = None
        status = HeartbeatLogStatus.SUCCESS

        try:
            result = await self._execute_action(heartbeat)
            logger.info(f"Heartbeat {heartbeat_id} executed successfully")
        except Exception as e:
            error_message = str(e)
            status = HeartbeatLogStatus.FAILED
            logger.error(f"Heartbeat {heartbeat_id} failed: {error_message}")

        # Update log with result
        completed_at = datetime.now()
        await self.heartbeat_service.update_log(
            log.id, status, result, error_message, completed_at
        )

        # Update heartbeat run times
        next_run = completed_at + timedelta(seconds=heartbeat.interval_seconds)
        await self.heartbeat_service.update_run_times(heartbeat_id, completed_at, next_run)

    async def _execute_action(self, heartbeat) -> dict:
        """Execute heartbeat action based on type"""
        action_type = heartbeat.action_type

        if action_type == "check_agent_status":
            return await self._check_agent_status(heartbeat.action_params)
        elif action_type == "send_reminder":
            return await self._send_reminder(heartbeat.action_params)
        elif action_type == "custom":
            return await self._execute_custom(heartbeat.action_params)
        else:
            raise ValueError(f"Unknown action type: {action_type}")

    async def _check_agent_status(self, params: dict) -> dict:
        """Check agent status action"""
        # TODO: Implement actual agent status check
        # This would query the agents table or call agent API
        return {
            "action": "check_agent_status",
            "message": "Agent status check completed",
            "timestamp": datetime.now().isoformat(),
        }

    async def _send_reminder(self, params: dict) -> dict:
        """Send reminder action"""
        # TODO: Implement actual reminder sending
        # This could send email, notification, etc.
        return {
            "action": "send_reminder",
            "message": "Reminder sent",
            "timestamp": datetime.now().isoformat(),
        }

    async def _execute_custom(self, params: dict) -> dict:
        """Execute custom action"""
        # Custom actions would be defined by params
        return {
            "action": "custom",
            "params": params,
            "message": "Custom action executed",
            "timestamp": datetime.now().isoformat(),
        }

    async def trigger_manually(self, heartbeat_id: str) -> dict:
        """Manually trigger a heartbeat"""
        await self.execute_heartbeat(heartbeat_id)
        job_info = self.get_job_info(heartbeat_id)
        return {
            "heartbeat_id": heartbeat_id,
            "triggered": True,
            "next_run_time": job_info["next_run_time"] if job_info else None,
        }


# Global scheduler instance
scheduler = SchedulerService()
