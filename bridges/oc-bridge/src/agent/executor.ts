/**
 * AgentExecutor — abstract base class for agent executors.
 */
import type { Task, ExecutionResult } from "../task/types.js";
import type { CCEvent } from "./output-parser.js";

export abstract class AgentExecutor {
  abstract execute(
    task: Task,
    onProgress: (progress: number, event?: CCEvent) => void,
    signal: AbortSignal,
  ): Promise<ExecutionResult>;
}
