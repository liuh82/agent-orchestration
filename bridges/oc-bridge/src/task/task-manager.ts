/**
 * TaskManager — queues tasks, enforces maxConcurrent, and manages lifecycle.
 * Includes state persistence and enhanced timeout management.
 */
import { logger } from "../logger/index.js";
import { getExecutor } from "../agent/registry.js";
import type { Task, ExecutionResult } from "./types.js";
import type { TaskSubmit, TaskProgress, TaskComplete, TaskAck } from "../websocket/types.js";
import { loadState, saveState, toPersisted } from "../storage/state.js";

/** Callbacks for sending messages back over WebSocket. */
export interface TaskMessageSender {
  send(msg: unknown): void;
}

export class TaskManager {
  private queue: Task[] = [];
  private running = new Map<string, Task>();
  private maxConcurrent: number;
  private sender: TaskMessageSender;
  private accepting = true; // whether to accept new tasks

  constructor(maxConcurrent: number, sender: TaskMessageSender) {
    this.maxConcurrent = maxConcurrent;
    this.sender = sender;
  }

  /** Submit a new task from server. */
  submit(taskMsg: TaskSubmit): void {
    if (!this.accepting) {
      logger.warn(`Rejected task ${taskMsg.taskId} — bridge is shutting down`);
      return;
    }

    const task: Task = {
      taskId: taskMsg.taskId,
      prompt: taskMsg.prompt,
      projectPath: taskMsg.projectPath,
      agentType: taskMsg.agentType,
      timeout: taskMsg.timeout,
      priority: taskMsg.priority,
      preferredIde: taskMsg.preferredIde,
      skipPermissions: taskMsg.skipPermissions,
      allowedTools: taskMsg.allowedTools,
      status: "pending",
    };

    logger.info(`Task queued: ${task.taskId} (agent=${task.agentType}, timeout=${task.timeout}s)`);

    // Send ack immediately
    const ack: TaskAck = { type: "task.ack", taskId: task.taskId, ts: Date.now() };
    this.sender.send(ack);

    this.queue.push(task);
    this.drain();
  }

  /** Cancel a running task. */
  cancel(taskId: string): boolean {
    const task = this.running.get(taskId);
    if (task && task.childProcess) {
      task.status = "cancelled";
      task.childProcess.kill("SIGKILL");
      logger.info(`Task cancelled: ${taskId}`);
      this.persistState();
      return true;
    }
    // Remove from queue if pending
    const idx = this.queue.findIndex((t) => t.taskId === taskId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      logger.info(`Task removed from queue: ${taskId}`);
      return true;
    }
    return false;
  }

  /** Number of currently running tasks. */
  get activeCount(): number {
    return this.running.size;
  }

  /** Stop accepting new tasks (for graceful shutdown). */
  stopAccepting(): void {
    this.accepting = false;
    logger.info("No longer accepting new tasks");
  }

  /** Wait for all running tasks to complete, up to a timeout. */
  async drainRunning(timeoutMs: number): Promise<void> {
    if (this.running.size === 0) return;

    logger.info(`Waiting for ${this.running.size} running task(s) to finish (max ${timeoutMs / 1000}s)...`);

    return new Promise<void>((resolve) => {
      const forceKillTimer = setTimeout(() => {
        logger.warn(`Grace period expired. Force-killing ${this.running.size} task(s)...`);
        for (const task of this.running.values()) {
          if (task.childProcess) {
            task.childProcess.kill("SIGKILL");
          }
        }
        resolve();
      }, timeoutMs);

      const checkInterval = setInterval(() => {
        if (this.running.size === 0) {
          clearTimeout(forceKillTimer);
          clearInterval(checkInterval);
          resolve();
        }
      }, 200);
    });
  }

  /** Save current running tasks to state.json. */
  persistState(): void {
    const state = loadState();
    state.tasks = Array.from(this.running.values()).map(toPersisted);
    saveState(state);
  }

  /** Try to start queued tasks up to maxConcurrent. */
  private drain(): void {
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.execute(task);
    }
  }

  /** Execute a single task. */
  private execute(task: Task): void {
    task.status = "running";
    task.startedAt = Date.now();
    this.running.set(task.taskId, task);

    // Persist to state.json
    this.persistState();

    logger.info(`Task started: ${task.taskId} (${this.running.size}/${this.maxConcurrent})`);

    // Set up timeout via AbortController
    const abortController = new AbortController();
    task.abortController = abortController;
    const timeoutMs = task.timeout * 1000;
    const timer = setTimeout(() => {
      logger.warn(`Task ${task.taskId} timed out after ${task.timeout}s`);
      abortController.abort();
    }, timeoutMs);

    // Progress callback
    const onProgress = (progress: number) => {
      const msg: TaskProgress = {
        type: "task.progress",
        taskId: task.taskId,
        progress,
        ts: Date.now(),
      };
      this.sender.send(msg);
    };

    getExecutor(task.agentType)
      .execute(task, onProgress, abortController.signal)
      .then((result: ExecutionResult) => this.onComplete(task, result))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.onComplete(task, {
          success: false,
          output: "",
          exitCode: 1,
          error: msg,
          duration: 0,
        });
      })
      .finally(() => clearTimeout(timer));
  }

  /** Handle task completion. */
  private onComplete(task: Task, result: ExecutionResult): void {
    this.running.delete(task.taskId);
    task.completedAt = Date.now();
    task.status = result.success ? "completed" : "failed";

    logger.info(
      `Task ${task.taskId} ${result.success ? "completed" : "failed"} ` +
      `(exit=${result.exitCode}, duration=${result.duration.toFixed(1)}s)`,
    );

    const msg: TaskComplete = {
      type: "task.complete",
      taskId: task.taskId,
      success: result.success,
      output: result.output,
      error: result.error,
      exitCode: result.exitCode,
      changedFiles: result.changedFiles,
      duration: result.duration,
      ts: Date.now(),
    };
    this.sender.send(msg);

    // Report 100% progress on completion
    this.sender.send({
      type: "task.progress",
      taskId: task.taskId,
      progress: 100,
      ts: Date.now(),
    } satisfies TaskProgress);

    // Update state — remove completed/failed task from persistence
    this.persistState();

    // Drain remaining queue
    this.drain();
  }
}
