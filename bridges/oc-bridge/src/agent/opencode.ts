/**
 * OpenCodeAgent — OpenCode CLI 后端适配器。
 *
 * 实现 BaseAgent 接口，支持 opencode run --format json 模式：
 * - CLI 参数构建（buildArgs）
 * - JSON 事件流解析（parseStreamLine）
 * - 结构化结果聚合（buildStructuredResult）
 * - CLI 存在检测（detectPresence）
 *
 * OpenCode CLI 参考: https://opencode.ai/docs/cli/
 * 注意: 原 opencode-ai/opencode 已归档，项目更名为 Crush（opencode.ai）
 *
 * 非交互模式: opencode run [--format json] [--cwd path] [--agent name] "prompt"
 * JSON 输出: 原始 JSON 事件流（nd-json）
 */
import { execSync } from "node:child_process";
import type { BaseAgent, AgentOptions, CCEvent, StructuredResult } from "./base.js";

/** OpenCode JSON 事件原始格式 */
interface OpenCodeRawEvent {
  type: string;
  id?: string;
  content?: string;
  text?: string;
  tool?: string;
  toolUseId?: string;
  isError?: boolean;
  // session 级别的事件
  session?: string;
  // token 用量（可能出现在完成事件中）
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export class OpenCodeAgent implements BaseAgent {
  readonly name = "opencode";
  readonly command = "opencode";
  readonly displayName = "OpenCode";

  // ---- BaseAgent 接口实现 ----

  /**
   * 构建 opencode run CLI 参数。
   *
   * OpenCode 非交互模式: opencode run [flags] "prompt"
   * - run: 非交互执行子命令
   * - --format json: 输出 JSON 事件流
   * - --cwd: 工作目录
   * - 非交互模式默认自动批准所有权限，无需 skipPermissions
   */
  buildArgs(prompt: string, options: AgentOptions): string[] {
    const args: string[] = ["run", "--format", "json"];

    // 工作目录通过 --cwd 指定
    if (options.workdir) {
      args.push("--cwd", options.workdir);
    }

    // OpenCode 非交互模式默认自动批准所有权限，
    // skipPermissions 无需额外参数

    // prompt 作为最后一个参数
    args.push(prompt);
    return args;
  }

  /**
   * 解析 OpenCode JSON 输出的单行，返回统一的 CCEvent 或 null。
   *
   * OpenCode run --format json 输出格式:
   *   {"type":"text","content":"..."}
   *   {"type":"tool_use","tool":"bash","content":"ls -la"}
   *   {"type":"tool_result","toolUseId":"...","content":"...","isError":false}
   *   {"type":"reasoning","content":"..."}
   *   {"type":"error","content":"..."}
   *
   * 具体事件类型可能因版本变化而不同，
   * 这里基于 OpenCode 工具集（bash, write, edit, patch, grep, glob, ls, view, fetch, agent）
   * 做最佳适配。
   */
  parseStreamLine(line: string): CCEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let raw: OpenCodeRawEvent;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      // 非 JSON 行当作纯文本
      return { type: "text", content: trimmed };
    }

    const type = raw.type;

    // text — 文本输出（agent 的回复）
    if (type === "text") {
      return { type: "text", content: raw.content ?? raw.text ?? "" };
    }

    // reasoning — 推理/思考
    if (type === "reasoning" || type === "thinking") {
      return { type: "thinking", content: raw.content ?? raw.text ?? "" };
    }

    // tool_use — 工具调用
    if (type === "tool_use") {
      const toolName = this._normalizeToolName(raw.tool ?? "");
      return {
        type: "tool_use",
        toolName,
        content: raw.content ?? "",
        toolInput: raw.content ? { command: raw.content } : undefined,
      };
    }

    // tool_result — 工具结果
    if (type === "tool_result") {
      return {
        type: "tool_result",
        toolName: this._normalizeToolName(raw.tool ?? ""),
        content: raw.content ?? raw.text ?? "",
        isError: raw.isError ?? false,
      };
    }

    // done — 完成
    if (type === "done" || type === "complete" || type === "session_end") {
      const usage = raw.usage;
      const tokenUsage = usage
        ? {
            input: Number(usage.inputTokens ?? usage.totalTokens ?? 0),
            output: Number(usage.outputTokens ?? 0),
          }
        : undefined;
      return { type: "done", content: raw.content ?? "", tokenUsage };
    }

    // error — 错误
    if (type === "error") {
      return {
        type: "error",
        content: raw.content ?? raw.text ?? "Unknown OpenCode error",
        isError: true,
      };
    }

    // session started — 跳过
    if (type === "session" || type === "session_start") {
      return null;
    }

    // 兜底: 尝试当作文本
    if (raw.content || raw.text) {
      return { type: "text", content: raw.content ?? raw.text ?? "" };
    }

    return null;
  }

  /**
   * 从事件流聚合出 StructuredResult。
   *
   * 从工具调用事件中提取文件修改和命令执行记录，
   * 从完成事件中提取 token 用量，从文本事件中生成摘要。
   */
  buildStructuredResult(events: CCEvent[]): StructuredResult {
    const filesModified: Array<{ path: string; action: "created" | "edited" | "deleted" }> = [];
    const commandsRun: Array<{ command: string; exitCode: number }> = [];
    const errors: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const summaryParts: string[] = [];

    for (const evt of events) {
      // Token 用量累加
      if (evt.tokenUsage) {
        totalInputTokens += evt.tokenUsage.input;
        totalOutputTokens += evt.tokenUsage.output;
      }

      switch (evt.type) {
        case "tool_use": {
          const tool = evt.toolName ?? "";
          const input = evt.toolInput as Record<string, unknown> | undefined;

          // 文件写入工具
          if ((tool === "write" || tool === "Write") && input?.file_path) {
            filesModified.push({ path: String(input.file_path), action: "created" });
          } else if ((tool === "edit" || tool === "Edit") && input?.file_path) {
            filesModified.push({ path: String(input.file_path), action: "edited" });
          } else if ((tool === "patch" || tool === "Patch") && input?.file_path) {
            filesModified.push({ path: String(input.file_path), action: "edited" });
          }

          // 命令执行工具
          if (tool === "bash" || tool === "Bash") {
            const cmd = evt.content || (input?.command as string) || "";
            if (cmd) {
              commandsRun.push({ command: cmd, exitCode: 0 });
            }
          }
          break;
        }

        case "tool_result": {
          // 从命令结果中更新退出码
          if ((evt.toolName === "bash" || evt.toolName === "Bash") && evt.isError) {
            const lastCmd = commandsRun[commandsRun.length - 1];
            if (lastCmd) {
              lastCmd.exitCode = 1;
            }
          }
          if (evt.isError && evt.toolName) {
            errors.push(`[${evt.toolName}] ${evt.content}`);
          }
          break;
        }

        case "error": {
          errors.push(evt.content);
          break;
        }

        case "text": {
          // 文本输出作为摘要
          if (evt.content && evt.content.length > 20) {
            summaryParts.push(evt.content);
          }
          break;
        }

        case "done": {
          if (evt.content) {
            summaryParts.push(evt.content);
          }
          break;
        }
      }
    }

    // 去重文件列表
    const uniqueFiles = dedupFiles(filesModified);

    return {
      filesModified: uniqueFiles,
      commandsRun,
      errors,
      summary: summaryParts.join("\n").slice(0, 500) || `${events.length} 条事件已处理`,
      tokenUsage: { input: totalInputTokens, output: totalOutputTokens },
      costUsd: 0, // OpenCode 不在事件流中报告成本
    };
  }

  /**
   * 检测 opencode CLI 是否存在于当前系统。
   */
  async detectPresence(): Promise<boolean> {
    return findOpenCodeCli() !== null;
  }

  // ---- 内部方法 ----

  /**
   * 将 OpenCode 工具名映射为统一的工具名。
   * OpenCode 工具: bash, write, edit, patch, grep, glob, ls, view, fetch, agent, diagnostics
   */
  private _normalizeToolName(tool: string): string {
    // 统一为小写
    const normalized = tool.toLowerCase().trim();
    const mapping: Record<string, string> = {
      bash: "Bash",
      write: "Write",
      edit: "Edit",
      patch: "Patch",
      grep: "Grep",
      glob: "Glob",
      ls: "Ls",
      view: "View",
      fetch: "Fetch",
      agent: "Agent",
      diagnostics: "Diagnostics",
    };
    return mapping[normalized] ?? tool;
  }
}

/**
 * 查找 opencode CLI 路径，不存在则返回 null。
 */
function findOpenCodeCli(): string | null {
  try {
    return execSync("which opencode", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

/** 去重文件修改记录，同一文件取最新的 action */
function dedupFiles(
  files: Array<{ path: string; action: "created" | "edited" | "deleted" }>,
): Array<{ path: string; action: "created" | "edited" | "deleted" }> {
  const map = new Map<string, { path: string; action: "created" | "edited" | "deleted" }>();
  for (const f of files) {
    map.set(f.path, f);
  }
  return Array.from(map.values());
}
