/**
 * ClaudeCodeExecutor — spawns claude CLI in --print mode.
 *
 * 每行 stream-json 输出通过 output-parser.ts 解析为 CCEvent，
 * 通过 onProgress 回调实时推送给 TaskManager。
 *
 * 实现 BaseAgent 接口，提供 CLI 参数构建、输出解析、结果聚合。
 * 支持 sandbox 模式: 将项目复制到隔离目录执行，完成后生成 diff patch。
 */
import { spawn, execSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AgentExecutor } from "./executor.js";
import type { BaseAgent, AgentOptions, CCEvent, StructuredResult } from "./base.js";
import { parseStreamLine, buildStructuredResult } from "./output-parser.js";
import { logger } from "../logger/index.js";
import { findClaudeCli } from "../utils/platform.js";
import type { Task, ExecutionResult } from "../task/types.js";

export class ClaudeCodeExecutor extends AgentExecutor implements BaseAgent {
  readonly name = "claude";
  readonly command = "claude";
  readonly displayName = "Claude Code";

  // ---- BaseAgent 接口实现 ----

  buildArgs(prompt: string, options: AgentOptions): string[] {
    const args: string[] = [
      "--print",
      "--verbose",
      "--output-format", "stream-json",
    ];

    if (options.skipPermissions) {
      args.push("--dangerously-skip-permissions");
    }
    if (options.allowedTools && options.allowedTools.length > 0) {
      for (const tool of options.allowedTools) {
        args.push("--allowedTools", tool);
      }
    }

    args.push(prompt);
    return args;
  }

  parseStreamLine(line: string): CCEvent | null {
    return parseStreamLine(line);
  }

  buildStructuredResult(events: CCEvent[]): StructuredResult {
    return buildStructuredResult(events);
  }

  async detectPresence(): Promise<boolean> {
    return findClaudeCli() !== null;
  }

  // ---- AgentExecutor 实现 ----
  async execute(
    task: Task,
    onProgress: (progress: number, event?: CCEvent) => void,
    signal: AbortSignal,
  ): Promise<ExecutionResult> {
    const claudePath = findClaudeCli();
    if (!claudePath) {
      return {
        success: false,
        output: "",
        exitCode: 127,
        error: "claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code",
        duration: 0,
      };
    }

    // Sandbox mode: prepare isolated working directory
    const sandboxMode = task.sandboxMode === true;
    let effectiveProjectPath = task.projectPath;
    let sandboxDir: string | null = null;

    if (sandboxMode) {
      // C2: Use mkdtemp for unpredictable directory name (prevents symlink attacks)
      sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-sandbox-"));
      // Copy project to sandbox
      fs.cpSync(task.projectPath, sandboxDir, { recursive: true });
      effectiveProjectPath = sandboxDir;
      logger.info(`[sandbox] Task ${task.taskId} isolated to ${sandboxDir}`);
    }

    // Ensure projectPath exists
    fs.mkdirSync(effectiveProjectPath, { recursive: true });

    const startTime = Date.now();
    const outputChunks: string[] = [];
    const allEvents: CCEvent[] = [];
    let exitCode = 0;
    let killed = false;
    let progress = 10;

    // Progress ticker — 每 5 秒至少上报一次进度
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress = Math.min(progress + 5, 90);
        onProgress(progress);
      }
    }, 5_000);

    return new Promise<ExecutionResult>((resolve) => {
      // Build CLI arguments via BaseAgent interface
      const args = this.buildArgs(task.prompt, {
        workdir: effectiveProjectPath,
        skipPermissions: task.skipPermissions,
        sandboxMode,
        allowedTools: task.allowedTools,
      });

      logger.info(`Spawning: ${claudePath} ${args.join(" ")}`);
      logger.debug(`cwd: ${effectiveProjectPath}`);

      const child = spawn(claudePath, args, {
        cwd: effectiveProjectPath,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      // Store reference for cancellation
      task.childProcess = child;

      // Handle abort (timeout or cancel)
      const onAbort = () => {
        killed = true;
        logger.warn(`Killing task ${task.taskId} (timeout/cancel)`);
        child.kill("SIGKILL");
      };
      signal.addEventListener("abort", onAbort, { once: true });

      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        outputChunks.push(text);

        // 逐行解析 stream-json，转换为 CCEvent 并回调
        const lines = text.split("\n").filter(Boolean);
        for (const line of lines) {
          const evt = parseStreamLine(line);
          if (evt) {
            allEvents.push(evt);

            // 根据事件类型更新进度
            if (evt.type === "tool_use" || evt.type === "tool_result") {
              progress = Math.min(progress + 3, 95);
            } else if (evt.type === "done") {
              progress = 95;
            } else if (evt.type === "text" || evt.type === "thinking") {
              progress = Math.min(progress + 1, 90);
            }

            // 实时推送事件给 TaskManager
            onProgress(progress, evt);
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        logger.debug(`[claude stderr] ${text}`);
        outputChunks.push(text);
      });

      child.on("error", (err) => {
        clearInterval(progressInterval);
        signal.removeEventListener("abort", onAbort);
        // Clean up sandbox on error
        if (sandboxMode && sandboxDir) {
          fs.rmSync(sandboxDir, { recursive: true, force: true });
        }
        const duration = (Date.now() - startTime) / 1000;
        resolve({
          success: false,
          output: outputChunks.join(""),
          exitCode: 1,
          error: `Failed to spawn claude: ${err.message}`,
          duration,
        });
      });

      child.on("close", (code) => {
        clearInterval(progressInterval);
        signal.removeEventListener("abort", onAbort);
        exitCode = code ?? 1;
        const duration = (Date.now() - startTime) / 1000;

        const output = outputChunks.join("");
        const changedFiles = getChangedFiles(effectiveProjectPath, startTime);
        const structuredResult = buildStructuredResult(allEvents);

        // 将事件流中提取的文件列表与 git diff 合并
        const gitFiles = changedFiles || [];
        const eventFiles = structuredResult.filesModified.map((f) => f.path);
        const mergedFiles = [...new Set([...gitFiles, ...eventFiles])];

        // Sandbox mode: generate diff patch
        let sandboxPatch: string | undefined;
        if (sandboxMode && sandboxDir) {
          sandboxPatch = generateSandboxPatch(task.projectPath, sandboxDir);
          // Clean up sandbox directory after generating patch
          fs.rmSync(sandboxDir, { recursive: true, force: true });
          logger.info(`[sandbox] Task ${task.taskId} patch generated, sandbox cleaned up`);
        }

        if (killed) {
          logger.info(`Task ${task.taskId} killed after ${duration.toFixed(1)}s`);
          resolve({
            success: false,
            output,
            exitCode,
            error: `Task ${exitCode === null ? "cancelled" : "timed out"} after ${duration.toFixed(1)}s`,
            changedFiles: mergedFiles,
            duration,
            structuredResult,
            sandboxPatch,
          });
        } else if (exitCode === 0) {
          logger.info(`Task ${task.taskId} completed in ${duration.toFixed(1)}s`);
          resolve({
            success: true,
            output,
            exitCode: 0,
            changedFiles: mergedFiles,
            duration,
            structuredResult,
            sandboxPatch,
          });
        } else {
          logger.warn(`Task ${task.taskId} failed with exit code ${exitCode}`);
          resolve({
            success: false,
            output,
            exitCode,
            error: `Claude exited with code ${exitCode}`,
            changedFiles: mergedFiles,
            duration,
            structuredResult,
            sandboxPatch,
          });
        }
      });
    });
  }
}

/**
 * Generate unified diff patch between original project and sandbox.
 * Uses diff -ruN for maximum compatibility.
 */
function generateSandboxPatch(originalPath: string, sandboxPath: string): string | undefined {
  try {
    // C3: Use execFileSync to avoid shell injection via path interpolation
    const patch = execFileSync(
      "diff",
      ["-ruN", originalPath, sandboxPath],
      { encoding: "utf-8", timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
    ).trim();

    // M2: Check for actual diff hunks, not just "Only in" lines
    if (!patch || !patch.includes("@@")) {
      logger.info("[sandbox] No meaningful changes detected in sandbox");
      return undefined;
    }

    // Strip absolute paths from patch for portability (replace base dirs with "a/" and "b/")
    // Replace longer path first to avoid prefix collision
    const [longer, shorter, longLabel, shortLabel] =
      sandboxPath.length >= originalPath.length
        ? [sandboxPath, originalPath, "b/", "a/"]
        : [originalPath, sandboxPath, "a/", "b/"];

    const normalizedPatch = patch
      .replace(new RegExp(escapeRegExp(longer) + "/?", "g"), longLabel)
      .replace(new RegExp(escapeRegExp(shorter) + "/?", "g"), shortLabel);

    logger.info(`[sandbox] Generated patch: ${normalizedPatch.split("\n").length} lines`);
    return normalizedPatch;
  } catch (err: unknown) {
    // diff returns exit code 1 when files differ, exit code 2 on error
    if (err && typeof err === "object" && "status" in err) {
      const status = (err as { status: number }).status;
      if (status === 1) {
        // No differences (or only "Only in" output already handled above)
        return undefined;
      }
    }
    logger.warn(`[sandbox] Failed to generate patch: ${err}`);
    return undefined;
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get list of files changed since `since` timestamp by checking git status.
 * Falls back to empty list if not a git repo.
 */
function getChangedFiles(projectPath: string, since: number): string[] {
  try {
    // M4: Use top-level execSync import, execFileSync to avoid shell injection
    const output = execFileSync(
      "git",
      ["-C", projectPath, "diff", "--name-only", "--diff-filter=ACMR"],
      { encoding: "utf-8", timeout: 5_000 },
    ).trim();
    if (!output) return [];
    return output.split("\n").filter(Boolean).map((f: string) =>
      path.relative(projectPath, f)
    );
  } catch {
    return [];
  }
}
