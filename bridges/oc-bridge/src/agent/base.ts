/**
 * agent/base.ts — 多后端抽象层的基础类型和接口。
 *
 * 所有 Agent 后端（Claude Code / Codex / OpenCode）都应实现 BaseAgent 接口。
 * 类型从此模块导出，其他模块通过 re-export 或直接引用保持兼容。
 */

// ---- 共享类型 ----

/** 事件类型枚举 */
export type CCEventType =
  | "text"
  | "tool_use"
  | "tool_result"
  | "thinking"
  | "error"
  | "done";

/** 单条结构化事件 — 所有后端输出的统一事件格式 */
export interface CCEvent {
  type: CCEventType;
  subtype?: string;
  content: string;
  toolName?: string;
  toolInput?: unknown;
  isError?: boolean;
  costUsd?: number;
  tokenUsage?: { input: number; output: number };
}

/** 文件修改记录 */
export interface FileChange {
  path: string;
  action: "created" | "edited" | "deleted";
}

/** 命令执行记录 */
export interface CommandRun {
  command: string;
  exitCode: number;
}

/** 聚合结果 — 任务完成后一次性生成 */
export interface StructuredResult {
  filesModified: FileChange[];
  commandsRun: CommandRun[];
  errors: string[];
  summary: string;
  tokenUsage: { input: number; output: number };
  costUsd: number;
}

// ---- Agent 接口 ----

/** Agent 执行选项 */
export interface AgentOptions {
  workdir?: string;
  timeout?: number;
  skipPermissions?: boolean;
  sandboxMode?: boolean;
  allowedTools?: string[];
  extraEnv?: Record<string, string>;
}

/**
 * BaseAgent — 所有后端 Agent 必须实现的接口。
 *
 * 每个后端提供：CLI 名称、参数构建、输出解析、结构化结果聚合、存在检测。
 * 进程管理（spawn / abort）由 AgentExecutor 统一处理，不在接口中。
 */
export interface BaseAgent {
  /** 唯一标识符，如 'claude', 'codex', 'opencode' */
  readonly name: string;

  /** CLI 命令名，如 'claude', 'codex' */
  readonly command: string;

  /** 人类可读的显示名 */
  readonly displayName: string;

  /**
   * 根据 prompt 和选项构建 CLI 参数列表。
   * prompt 总是作为最后一个参数。
   */
  buildArgs(prompt: string, options: AgentOptions): string[];

  /**
   * 解析 CLI 输出的一行，返回统一的 CCEvent 或 null（跳过该行）。
   */
  parseStreamLine(line: string): CCEvent | null;

  /**
   * 从事件流聚合出 StructuredResult。
   */
  buildStructuredResult(events: CCEvent[]): StructuredResult;

  /**
   * 检测该 Agent CLI 是否存在于当前系统。
   */
  detectPresence(): Promise<boolean>;
}
