/** Task lifecycle types. */

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "timeout" | "cancelled";

export interface Task {
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: string;
  timeout: number;
  priority: string;
  preferredIde: string | null;
  status: TaskStatus;
  startedAt?: number;
  completedAt?: number;
  /** Reference to the child process for cancellation. */
  childProcess?: import("node:child_process").ChildProcess;
  /** Abort controller for timeout. */
  abortController?: AbortController;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  exitCode: number;
  changedFiles?: string[];
  error?: string;
  duration: number;
}
