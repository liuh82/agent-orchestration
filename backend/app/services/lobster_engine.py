import subprocess
import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from ..models.workflow import WorkflowDefinition, ExecutionStatus, LogEntry


class LobsterEngine:
    """Lobster 工作流引擎适配器"""

    def __init__(self, lobster_path: str = "lobster"):
        self.lobster_path = lobster_path

    async def execute(self, workflow: WorkflowDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """执行工作流"""
        try:
            # 创建临时工作流文件
            temp_dir = f"/tmp/lobster-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            os.makedirs(temp_dir, exist_ok=True)

            workflow_file = os.path.join(temp_dir, "workflow.json")

            # 构造 Lobster 工作流定义
            lobster_workflow = {
                "name": workflow.name,
                "steps": workflow.definition.get("steps", []),
                "config": workflow.config
            }

            # 写入工作流文件
            with open(workflow_file, 'w') as f:
                json.dump(lobster_workflow, f, indent=2)

            # 构建 Lobster 执行命令
            cmd = [
                self.lobster_path,
                "run",
                workflow_file,
                "--json",
                "--context",
                json.dumps(context)
            ]

            # 执行工作流
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=workflow.config.timeout,
                cwd=temp_dir
            )

            # 解析输出
            if result.returncode == 0:
                output = json.loads(result.stdout)
                return {
                    "success": True,
                    "output": output,
                    "execution_time": result.stderr.count('\n'),
                    "status": "completed"
                }
            else:
                return {
                    "success": False,
                    "error": result.stderr,
                    "execution_time": 0,
                    "status": "failed"
                }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Execution timed out",
                "execution_time": workflow.config.timeout,
                "status": "failed"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time": 0,
                "status": "failed"
            }
        finally:
            # 清理临时文件
            if 'temp_dir' in locals() and os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir)

    async def get_status(self, execution_id: str) -> ExecutionStatus:
        """获取执行状态"""
        # TODO: 实现 Lobster 执行状态查询
        return ExecutionStatus(
            id=execution_id,
            status="running",
            startTime=datetime.now(),
            progress=0,
            currentStep="",
            logs=[]
        )

    async def get_logs(self, execution_id: str) -> List[LogEntry]:
        """获取执行日志"""
        # TODO: 实现 Lobster 日志查询
        return []

    async def pause(self, execution_id: str) -> bool:
        """暂停工作流（Lobster 不支持暂停）"""
        return False

    async def resume(self, execution_id: str) -> bool:
        """恢复工作流"""
        # Lobster 支持断点续执
        cmd = [self.lobster_path, "resume", execution_id]
        result = subprocess.run(cmd, capture_output=True)
        return result.returncode == 0

    async def cancel(self, execution_id: str) -> bool:
        """取消工作流"""
        cmd = [self.lobster_path, "cancel", execution_id]
        result = subprocess.run(cmd, capture_output=True)
        return result.returncode == 0


class LobsterWorkflowEngine:
    """Lobster 工作流引擎包装类"""

    def __init__(self):
        self.engine = LobsterEngine()

    async def execute(self, workflow: WorkflowDefinition, context: Dict[str, Any]) -> Dict[str, Any]:
        """执行工作流"""
        return await self.engine.execute(workflow, context)

    async def pause(self, execution_id: str) -> bool:
        """暂停工作流"""
        return await self.engine.pause(execution_id)

    async def resume(self, execution_id: str) -> bool:
        """恢复工作流"""
        return await self.engine.resume(execution_id)

    async def cancel(self, execution_id: str) -> bool:
        """取消工作流"""
        return await self.engine.cancel(execution_id)

    async def get_logs(self, execution_id: str) -> List[LogEntry]:
        """获取执行日志"""
        return await self.engine.get_logs(execution_id)