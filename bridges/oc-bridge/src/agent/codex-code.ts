/**
 * CodexCodeAgent — OpenAI Codex CLI 后端适配器。
 *
 * 实现 BaseAgent 接口，支持 codex exec --json 模式的：
 * - CLI 参数构建（buildArgs）
 * - JSONL 事件流解析（parseStreamLine）
 * - 结构化结果聚合（buildStructuredResult）
 * - CLI 存在检测（detectPresence）
 *
 * Codex CLI 参考: https://developers.openai.com/codex/cli/reference/
 * JSON 事件格式: https://developers.openai.com/codex/noninteractive/
 *
 * 事件类型: thread.started, turn.started, item.started, item.completed,
 *           turn.completed, turn.failed, error
 * item 类型: command_execution, agent_message, file_change, reasoning,
 *            mcp_tool_call, web_search, plan_update
 */
import { execSync } from "node:child_process";
import type { BaseAgent, AgentOptions, CCEvent, StructuredResult } from "./base.js";

/** Codex JSONL 事件中 item 的结构 */
interface CodexItem {
  id?: string;
  type: string;
  text?: string;
  command?: string;
  status?: string;
  file_path?: string;
  change_type?: string;
  content?: string;
  diff?: string;
  exit_code?: number;
}

/** Codex JSONL 事件原始格式 */
interface CodexRawEvent {
  type: string;
  thread_id?: string;
  item?: CodexItem;
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  message?: string;
  error?: string;
}

export class CodexCodeAgent implements BaseAgent {
  readonly name = "codex";
  readonly command = "codex";
  readonly displayName = "Codex CLI";

  // ---- BaseAgent 接口实现 ----

  /**
   * 构建 codex exec CLI 参数。
   *
   * Codex 非交互模式: codex exec [flags] "prompt"
   * - exec: 非交互执行子命令
   * - --json: 输出 JSONL 事件流
   * - --full-auto: workspace-write 沙盒 + 仅失败时审批（对应 skipPermissions）
   * - --cd: 工作目录
   */
  buildArgs(prompt: string, options: AgentOptions): string[] {
    const args: string[] = ["exec", "--json"];

    // Codex --full-auto 等效于 --ask-for-approval on-failure + --sandbox workspace-write
    if (options.skipPermissions) {
      args.push("--full-auto");
    }

    // 沙盒模式: 降级到 workspace-write（codex 原生支持更细粒度的沙盒控制）
    if (options.sandboxMode) {
      args.push("--sandbox", "workspace-write");
    } else if (!options.skipPermissions) {
      // 默认使用 read-only 沙盒，确保安全
      args.push("--sandbox", "read-only");
    }

    // 工作目录通过 --cd 指定
    if (options.workdir) {
      args.push("--cd", options.workdir);
    }

    // prompt 作为最后一个参数
    args.push(prompt);
    return args;
  }

  /**
   * 解析 Codex JSONL 输出的单行，返回统一的 CCEvent 或 null。
   *
   * Codex exec --json 每行输出一个 JSON 对象，格式示例:
   *   {"type":"thread.started","thread_id":"..."}
   *   {"type":"turn.started"}
   *   {"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"...","status":"in_progress"}}
   *   {"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"..."}}
   *   {"type":"item.completed","item":{"id":"item_5","type":"file_change","file_path":"...","change_type":"created"}}
   *   {"type":"item.completed","item":{"id":"item_6","type":"reasoning","text":"..."}}
   *   {"type":"turn.completed","usage":{"input_tokens":24763,"output_tokens":122}}
   *   {"type":"error","message":"..."}
   */
  parseStreamLine(line: string): CCEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let raw: CodexRawEvent;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      // 非 JSON 行当作纯文本
      return { type: "text", content: trimmed };
    }

    const type = raw.type;

    // turn.completed — 包含 token 用量，映射为 done 事件
    if (type === "turn.completed") {
      const usage = raw.usage;
      const tokenUsage = usage
        ? {
            input: Number(usage.input_tokens ?? usage.total_tokens ?? 0),
            output: Number(usage.output_tokens ?? 0),
          }
        : undefined;
      return { type: "done", content: "", tokenUsage };
    }

    // turn.failed — 执行失败
    if (type === "turn.failed") {
      return {
        type: "error",
        content: raw.message ?? raw.error ?? "Codex turn failed",
        isError: true,
      };
    }

    // error — 顶层错误
    if (type === "error") {
      return {
        type: "error",
        content: raw.message ?? raw.error ?? "Unknown Codex error",
        isError: true,
      };
    }

    // thread.started — 跳过（元数据，非输出事件）
    if (type === "thread.started") {
      return null;
    }

    // turn.started — 跳过（元数据）
    if (type === "turn.started") {
      return null;
    }

    // item.started — 工具调用开始
    if (type === "item.started" && raw.item) {
      return this._mapItemToEvent(raw.item, "started");
    }

    // item.completed — 工具调用完成
    if (type === "item.completed" && raw.item) {
      return this._mapItemToEvent(raw.item, "completed");
    }

    // item.failed — 工具调用失败
    if (type === "item.failed" && raw.item) {
      return {
        type: "tool_result",
        toolName: raw.item.type,
        content: raw.item.text ?? raw.item.content ?? "",
        isError: true,
      };
    }

    // 兜底: 跳过未知事件
    return null;
  }

  /**
   * 从事件流聚合出 StructuredResult。
   *
   * 从 item.started/completed 事件中提取文件修改、命令执行记录，
   * 从 turn.completed 中提取 token 用量，从 agent_message 中生成摘要。
   */
  buildStructuredResult(events: CCEvent[]): StructuredResult {
    const filesModified: Array<{ path: string; action: "created" | "edited" | "deleted" }> = [];
    const commandsRun: Array<{ command: string; exitCode: number }> = [];
    const errors: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const summaryParts: string[] = [];

    for (const evt of events) {
      // Token 用量累加（来自 turn.completed 事件的 done 类型）
      if (evt.tokenUsage) {
        totalInputTokens += evt.tokenUsage.input;
        totalOutputTokens += evt.tokenUsage.output;
      }

      switch (evt.type) {
        case "tool_use": {
          // 从 codex 命令执行事件中提取命令
          if (evt.toolName === "command_execution" && evt.content) {
            commandsRun.push({ command: evt.content, exitCode: 0 });
          }
          break;
        }

        case "tool_result": {
          // 从命令完成事件中更新退出码
          if (evt.toolName === "command_execution" && evt.isError) {
            const lastCmd = commandsRun[commandsRun.length - 1];
            if (lastCmd) {
              lastCmd.exitCode = 1;
            }
          }
          // 文件修改完成事件
          if (evt.toolName === "file_change" && evt.toolInput) {
            const input = evt.toolInput as Record<string, unknown>;
            const filePath = String(input.path ?? "");
            const action = String(input.action ?? "edited");
            if (filePath) {
              filesModified.push({
                path: filePath,
                action: action === "created" ? "created" : action === "deleted" ? "deleted" : "edited",
              });
            }
          }
          if (evt.isError && evt.toolName) {
            errors.push(`[${evt.toolName}] ${evt.content}`);
          }
          break;
        }

        case "text": {
          // agent_message 的文本内容作为摘要
          if (evt.content && evt.content.length > 20) {
            summaryParts.push(evt.content);
          }
          break;
        }

        case "thinking": {
          // reasoning 内容也纳入摘要
          if (evt.content && evt.content.length > 50) {
            summaryParts.push(evt.content);
          }
          break;
        }

        case "error": {
          errors.push(evt.content);
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
      costUsd: 0, // Codex 不在事件流中报告成本，需要通过 API 查询
    };
  }

  /**
   * 检测 codex CLI 是否存在于当前系统。
   */
  async detectPresence(): Promise<boolean> {
    return findCodexCli() !== null;
  }

  // ---- 内部方法 ----

  /**
   * 将 Codex item 事件映射为统一的 CCEvent。
   *
   * item 类型映射:
   * - agent_message → text
   * - command_execution → tool_use (started) / tool_result (completed)
   * - file_change → tool_result
   * - reasoning → thinking
   * - mcp_tool_call → tool_use
   * - web_search → tool_use
   * - plan_update → text
   */
  private _mapItemToEvent(item: CodexItem, phase: "started" | "completed"): CCEvent | null {
    switch (item.type) {
      case "agent_message": {
        // agent_message 只在 completed 时有文本内容
        if (phase === "completed" && item.text) {
          return { type: "text", content: item.text, subtype: "agent_message" };
        }
        return null;
      }

      case "command_execution": {
        if (phase === "started") {
          return {
            type: "tool_use",
            toolName: "command_execution",
            content: item.command ?? "",
            toolInput: { command: item.command },
          };
        }
        // completed
        return {
          type: "tool_result",
          toolName: "command_execution",
          content: item.content ?? item.text ?? "",
          isError: item.status === "failed",
        };
      }

      case "file_change": {
        if (phase === "completed") {
          const action = item.change_type ?? "edited";
          return {
            type: "tool_result",
            toolName: "file_change",
            content: `修改文件: ${item.file_path ?? ""} (${action})`,
            toolInput: {
              path: item.file_path ?? "",
              action: action === "created" ? "created" : action === "deleted" ? "deleted" : "edited",
              diff: item.diff,
            },
          };
        }
        return null;
      }

      case "reasoning": {
        if (phase === "completed" && item.text) {
          return { type: "thinking", content: item.text };
        }
        return null;
      }

      case "mcp_tool_call": {
        if (phase === "started") {
          return {
            type: "tool_use",
            toolName: item.content ?? "mcp_tool_call",
            content: "",
          };
        }
        return {
          type: "tool_result",
          toolName: item.content ?? "mcp_tool_call",
          content: item.text ?? item.content ?? "",
          isError: item.status === "failed",
        };
      }

      case "web_search": {
        if (phase === "started") {
          return {
            type: "tool_use",
            toolName: "web_search",
            content: item.command ?? item.text ?? "",
          };
        }
        return {
          type: "tool_result",
          toolName: "web_search",
          content: item.text ?? "",
          isError: item.status === "failed",
        };
      }

      case "plan_update": {
        if (phase === "completed" && item.text) {
          return { type: "text", content: item.text, subtype: "plan_update" };
        }
        return null;
      }

      default:
        // 未知 item 类型，跳过
        return null;
    }
  }
}

/**
 * 查找 codex CLI 路径，不存在则返回 null。
 */
function findCodexCli(): string | null {
  try {
    return execSync("which codex", { encoding: "utf-8" }).trim();
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
