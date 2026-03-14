import type { TaskSubmit } from './protocol/types.js';
import type { AgentAdapter } from './adapters/types.js';
import type { ExecuteRequest, ExecuteResult } from './adapters/types.js';
import type { TaskQueue } from './task-queue.js';
import { getLogger } from './utils/logger.js';
import { isTerminating } from './utils/graceful-shutdown.js';

const logger = getLogger('task-runner');

interface TaskExecution {
  taskId: string;
  request: ExecuteRequest;
  adapter: AgentAdapter;
  controller: AbortController;
  startedAt: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: ExecuteResult;
  error?: string;
}

class TaskRunner {
  private taskQueue: TaskQueue;
  private executions = new Map<string, TaskExecution>();
  private maxConcurrent: number;
  private runningCount = 0;

  constructor(taskQueue: TaskQueue, maxConcurrent = 3) {
    this.taskQueue = taskQueue;
    this.maxConcurrent = maxConcurrent;
    this.setupQueueListeners();
  }

  private setupQueueListeners(): void {
    this.taskQueue.on('completed', (data) => {
      const execution = this.executions.get(data.taskId);
      if (execution) {
        execution.status = 'completed';
        execution.result = {
          exitCode: data.exitCode,
          output: data.output,
          changedFiles: data.changedFiles,
          duration: data.duration,
          success: data.exitCode === 0,
        };
        this.runningCount--;
        logger.debug('Task execution completed', { taskId: data.taskId });
      }
    });

    this.taskQueue.on('failed', (data) => {
      const execution = this.executions.get(data.taskId);
      if (execution) {
        execution.status = 'failed';
        execution.error = data.error;
        this.runningCount--;
        logger.debug('Task execution failed', { taskId: data.taskId, error: data.error });
      }
    });

    this.taskQueue.on('cancelled', (taskId) => {
      const execution = this.executions.get(taskId);
      if (execution) {
        execution.status = 'cancelled';
        this.runningCount--;
        logger.debug('Task execution cancelled', { taskId });
      }
    });
  }

  submit(task: TaskSubmit): void {
    if (isTerminating()) {
      logger.warn('Bridge is terminating, refusing new task', { taskId: task.taskId });
      return;
    }

    this.taskQueue.enqueue(task);
    logger.info('Task submitted to runner', { taskId: task.taskId, priority: task.priority });
  }

  cancel(taskId: string): boolean {
    const result = this.taskQueue.cancel(taskId);
    if (result) {
      const execution = this.executions.get(taskId);
      if (execution) {
        execution.controller.abort();
      }
    }
    return result;
  }

  getExecution(taskId: string): TaskExecution | undefined {
    return this.executions.get(taskId);
  }

  getAllExecutions(): TaskExecution[] {
    return Array.from(this.executions.values());
  }

  getRunningCount(): number {
    return this.runningCount;
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = n;
    this.taskQueue.setMaxConcurrent(n);
    logger.info('Max concurrent tasks updated', { maxConcurrent: n });
  }

  getStatus(): {
    running: number;
    queued: number;
    maxConcurrent: number;
  } {
    return {
      running: this.runningCount,
      queued: this.taskQueue.getQueueSize(),
      maxConcurrent: this.maxConcurrent,
    };
  }

  pause(): void {
    this.taskQueue.pause();
  }

  resume(): void {
    this.taskQueue.resume();
  }

  async shutdown(): Promise<void> {
    logger.info('Task runner shutting down');
    await this.taskQueue.shutdown();
    this.executions.clear();
    this.runningCount = 0;
  }
}

export { TaskRunner };
export type { TaskExecution };
