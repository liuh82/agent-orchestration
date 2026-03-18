/**
 * AgentExecutor — abstract base class for agent executors.
 */
import type { Task, ExecutionResult } from "../task/types.js";

export abstract class AgentExecutor {
  abstract execute(
    task: Task,
    onProgress: (progress: number) => void,
    signal: AbortSignal,
  ): Promise<ExecutionResult>;
}
