/**
 * output-parser.ts — 解析 CC stream-json 输出为结构化事件和聚合结果。
 *
 * Claude Code --output-format stream-json 每行输出一个 JSON 对象，
 * 本模块将其解析为统一的 CCEvent，并在任务完成后聚合为 StructuredResult。
 *
 * 类型已迁移至 agent/base.ts，此处通过 import + re-export 保持兼容。
 */
import type {
  CCEventType,
  CCEvent,
  FileChange,
  CommandRun,
  StructuredResult,
} from "./base.js";

export type {
  CCEventType,
  CCEvent,
  FileChange,
  CommandRun,
  StructuredResult,
};

/**
 * 解析 stream-json 的单行，返回 CCEvent 或 null。
 *
 * Claude Code stream-json 常见格式:
 *   {"type":"assistant","subtype":"text","content":"..."}
 *   {"type":"tool_use","name":"Write","input":{"file_path":"...","content":"..."}}
 *   {"type":"tool_result","tool_use_id":"...","content":"...","is_error":false}
 *   {"type":"thinking","content":"..."}
 *   {"type":"result","subtype":"success","cost_usd":0.01,"usage":{"input_tokens":100,"output_tokens":50}}
 */
export function parseStreamLine(line: string): CCEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    // 非 JSON 行，当作纯文本事件
    return { type: "text", content: trimmed };
  }

  const type = String(raw.type ?? "");

  // assistant + text → text 事件
  if (type === "assistant" && raw.subtype === "text") {
    return { type: "text", content: String(raw.content ?? "") };
  }

  // assistant + thinking → thinking 事件
  if (type === "assistant" && raw.subtype === "thinking") {
    return { type: "thinking", content: String(raw.content ?? "") };
  }

  // tool_use
  if (type === "tool_use" || type === "tool_use_result") {
    return {
      type: "tool_use",
      toolName: String(raw.name ?? ""),
      toolInput: raw.input ?? raw.tool_input,
      content: raw.content ? String(raw.content) : "",
    };
  }

  // tool_result
  if (type === "tool_result") {
    return {
      type: "tool_result",
      toolName: String(raw.tool_name ?? raw.name ?? ""),
      content: String(raw.content ?? ""),
      isError: Boolean(raw.is_error),
    };
  }

  // thinking (顶层 type)
  if (type === "thinking") {
    return { type: "thinking", content: String(raw.content ?? "") };
  }

  // result — 最终结果
  if (type === "result") {
    const usage = raw.usage as Record<string, unknown> | undefined;
    const tokenUsage = usage
      ? {
          input: Number(usage.input_tokens ?? usage.input ?? 0),
          output: Number(usage.output_tokens ?? usage.output ?? 0),
        }
      : undefined;

    return {
      type: "done",
      content: String(raw.result ?? raw.content ?? ""),
      costUsd: raw.cost_usd ? Number(raw.cost_usd) : undefined,
      tokenUsage,
    };
  }

  // error / system
  if (type === "error" || type === "system") {
    return {
      type: "error",
      content: String(raw.message ?? raw.content ?? ""),
      isError: true,
    };
  }

  // 兜底：当作文本
  if (type === "content_block" || type === "message" || type === "message_start") {
    return { type: "text", content: String(raw.content ?? JSON.stringify(raw)) };
  }

  return null;
}

/**
 * 从事件流聚合出 StructuredResult。
 */
export function buildStructuredResult(events: CCEvent[]): StructuredResult {
  const filesModified: FileChange[] = [];
  const commandsRun: CommandRun[] = [];
  const errors: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  const summaryParts: string[] = [];

  for (const evt of events) {
    // Token 用量累加
    if (evt.tokenUsage) {
      totalInputTokens += evt.tokenUsage.input;
      totalOutputTokens += evt.tokenUsage.output;
    }
    if (evt.costUsd) {
      totalCostUsd += evt.costUsd;
    }

    switch (evt.type) {
      case "tool_use": {
        const tool = evt.toolName ?? "";
        const input = evt.toolInput as Record<string, unknown> | undefined;

        // 文件写入 → created/edited
        if (tool === "Write" && input?.file_path) {
          filesModified.push({ path: String(input.file_path), action: "created" });
        } else if (tool === "Edit" && input?.file_path) {
          filesModified.push({ path: String(input.file_path), action: "edited" });
        } else if (tool === "NotebookEdit" && input?.notebook_path) {
          filesModified.push({ path: String(input.notebook_path), action: "edited" });
        }
        // 命令执行
        if (tool === "Bash" && input?.command) {
          commandsRun.push({ command: String(input.command), exitCode: 0 });
        }
        break;
      }

      case "tool_result": {
        // 从 Bash 输出中提取退出码
        if (evt.toolName === "Bash") {
          const lastCmd = commandsRun[commandsRun.length - 1];
          if (lastCmd && lastCmd.exitCode === 0 && evt.isError) {
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

      case "done": {
        // 最终摘要
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
    costUsd: Math.round(totalCostUsd * 1e6) / 1e6, // 保留 6 位小数
  };
}

/** 去重文件修改记录，同一文件取最新的 action */
function dedupFiles(files: FileChange[]): FileChange[] {
  const map = new Map<string, FileChange>();
  for (const f of files) {
    map.set(f.path, f); // 后出现的覆盖前面的
  }
  return Array.from(map.values());
}
