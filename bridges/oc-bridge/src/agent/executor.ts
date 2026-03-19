/**
 * AgentExecutor — abstract base class for agent executors.
 *
 * 进程生命周期（spawn / stdout 处理 / abort / cleanup）由此类管理。
 * 各后端的差异（CLI 参数、输出解析、结果聚合）通过 BaseAgent 接口注入。
 */
import type { Task, ExecutionResult } from "../task/types.js";
import type { CCEvent } from "./base.js";

export abstract class AgentExecutor {
  abstract execute(
    task: Task,
    onProgress: (progress: number, event?: CCEvent) => void,
    signal: AbortSignal,
  ): Promise<ExecutionResult>;
}
