import type { TaskSubmit } from './protocol/types.js';
import type { AgentAdapter } from './adapters/types.js';
import type { ExecuteRequest } from './adapters/types.js';
import { EventEmitter } from 'events';
import { PRIORITY_WEIGHTS } from './config/defaults.js';
import { getLogger } from './utils/logger.js';

const logger = getLogger('task-queue');

interface QueuedTask extends TaskSubmit {
  queuedAt: number;
  weight: number;
}

interface RunningTask {
  id: string;
  request: ExecuteRequest;
  adapter: AgentAdapter;
  controller: AbortController;
  startedAt: number;
  timeout?: NodeJS.Timeout;
}

class TaskQueue extends EventEmitter {
  private queue: QueuedTask[] = [];
  private running: Map<string, RunningTask> = new Map();
  private maxConcurrent: number;
  private paused = false;

  constructor(maxConcurrent = 3) {
    super();
    this.maxConcurrent = maxConcurrent;
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = n;
    logger.debug(`Max concurrent tasks updated`, { maxConcurrent: n });
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  pause(): void {
    this.paused = true;
    logger.info('Task queue paused');
  }

  resume(): void {
    this.paused = false;
    logger.info('Task queue resumed');
    this.process();
  }

  isPaused(): boolean {
    return this.paused;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getRunningCount(): number {
    return this.running.size;
 }

  getQueuedTasks(): QueuedTask[] {
    return [...this.queue];
  }

  getRunningTasks(): RunningTask[] {
    return Array.from(this.running.values());
  }

  enqueue(task: TaskSubmit): void {
    const weight = PRIORITY_WEIGHTS[task.priority] ?? 2;
    const queuedTask: QueuedTask = {
      ...task,
      queuedAt: Date.now(),
      weight,
    };

    this.queue.push(queuedTask);
    this.queue.sort((a, b) => {
      if (a.weight !== b.weight) return b.weight - a.weight;
      return a.queuedAt - b.queuedAt;
    });

    logger.debug('Task enqueued', { taskId: task.taskId, priority: task.priority, queueSize: this.queue.length });
    this.emit('enqueued', task.taskId);

    this.process();
  }

  cancel(taskId: string): boolean {
    const queuedIndex = this.queue.findIndex((t) => t.taskId === taskId);
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1);
      logger.info('Task cancelled (queued)', { taskId });
      this.emit('cancelled', taskId);
      return true;
    }

    const running = this.running.get(taskId);
    if (running) {
      running.controller.abort();
      running.timeout && clearTimeout(running.timeout);
      this.running.delete(taskId);
      logger.info('Task cancelled (running)', { taskId });
      this.emit('cancelled', taskId);
      this.process();
      return true;
    }

    return false;
  }

  private process(): void {
    if (this.paused) return;
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.execute(task);
    }
  }

  private async execute(task: QueuedTask): Promise<void> {
    const taskId = task.taskId;
    const controller = new AbortController();

    try {
      this.emit('started', taskId);

      const adapter = await this.findAdapter(task.agentType);
      if (!adapter) {
        throw new Error(`No adapter available for agent type: ${task.agentType}`);
      }

      const request: ExecuteRequest = {
        prompt: task.prompt,
        cwd: task.projectPath,
        agentType: task.agentType,
        timeout: task.timeout * 1000,
        signal: controller.signal,
        onOutput: (line) => {
          this.emit('output', { taskId, line });
        },
        onProgress: (percent) => {
          this.emit('progress', { taskId, progress: percent });
        },
      };

      const runningTask: RunningTask = {
        id: taskId,
        request,
        adapter,
        controller,
        startedAt: Date.now(),
      };

      this.running.set(taskId, runningTask);

      logger.info('Task execution started', { taskId, agentType: task.agentType });

      if (task.timeout) {
        runningTask.timeout = setTimeout(() => {
          controller.abort();
          logger.warn('Task timeout', { taskId, timeout: task.timeout });
        }, task.timeout * 1000);
      }

      const result = await adapter.execute(request);

      runningTask.timeout && clearTimeout(runningTask.timeout);
      this.running.delete(taskId);

      const duration = Date.now() - runningTask.startedAt;

      logger.info('Task completed', { taskId, exitCode: result.exitCode, duration });

      this.emit('completed', {
        taskId,
        exitCode: result.exitCode,
        output: result.output,
        changedFiles: result.changedFiles,
        duration,
      });

      this.process();
    } catch (error) {
      this.running.delete(taskId);
      logger.error('Task failed', { taskId, error });
      this.emit('failed', { taskId, error: error instanceof Error ? error.message : String(error) });
      this.process();
    }
  }

  private async findAdapter(agentType: string): Promise<AgentAdapter | null> {
    const registry = (await import('./adapters/registry.js')).default;
    return registry.find(agentType);
  }

  clear(): void {
    this.queue = [];
    for (const [taskId, running] of this.running.entries()) {
      running.controller.abort();
      running.timeout && clearTimeout(running.timeout);
      this.emit('cancelled', taskId);
    }
    this.running.clear();
    logger.info('Task queue cleared');
  }

  shutdown(): Promise<void> {
    this.paused = true;

    const runningPromises = Array.from(this.running.entries()).map(([taskId, running]) => {
      running.controller.abort();
      running.timeout && clearTimeout(running.timeout);
      return this.waitForTaskEnd(taskId, running.adapter);
    });

    logger.info('Task queue shutdown initiated', { running: runningPromises.length });

    return Promise.all(runningPromises).then(() => {
      this.queue = [];
      this.running.clear();
      logger.info('Task queue shutdown complete');
    });
  }

  private async waitForTaskEnd(taskId: string, adapter: AgentAdapter): Promise<void> {
    await adapter.cancel(taskId);
  }

  onStarted(callback: (taskId: string) => void): void {
    this.on('started', callback);
  }

  onCompleted(callback: (result: { taskId: string; exitCode: number; output: string; changedFiles: string[]; duration: number }) => void): void {
    this.on('completed', callback);
  }

  onFailed(callback: (error: { taskId: string; error: string }) => void): void {
    this.on('failed', callback);
  }

  onCancelled(callback: (taskId: string) => void): void {
    this.on('cancelled', callback);
  }

  onOutput(callback: (data: { taskId: string; line: string }) => void): void {
    this.on('output', callback);
  }

  onProgress(callback: (data: { taskId: string; progress: number }) => void): void {
    this.on('progress', callback);
  }

  onEnqueued(callback: (taskId: string) => void): void {
    this.on('enqueued', callback);
  }
}

export { TaskQueue };
export type { QueuedTask, RunningTask };
