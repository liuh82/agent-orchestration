/** Task lifecycle types. */

import type { CCEvent, StructuredResult } from "../agent/output-parser.js";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "timeout" | "cancelled";

/** 任务进度消息 — 通过 WebSocket 实时推送到服务端 */
export interface TaskProgressMessage {
  type: "task.progress";
  taskId: string;
  /** 百分比进度 0-100 */
  progress: number;
  /** 解析后的结构化事件（可选） */
  event?: CCEvent;
  /** 时间戳 */
  ts: number;
}

export interface Task {
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: string;
  timeout: number;
  priority: string;
  preferredIde: string | null;
  skipPermissions?: boolean;
  allowedTools?: string[];
  sandboxMode?: boolean;
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
  /** 聚合的结构化结果（JSON 序列化后存入数据库） */
  structuredResult?: StructuredResult;
  /** sandbox 模式生成的 diff patch */
  sandboxPatch?: string;
}
