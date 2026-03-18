/**
 * ClaudeCodeExecutor — spawns claude CLI in --print mode.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { AgentExecutor } from "./executor.js";
import { logger } from "../logger/index.js";
import { findClaudeCli } from "../utils/platform.js";
import type { Task, ExecutionResult } from "../task/types.js";

export class ClaudeCodeExecutor extends AgentExecutor {
  async execute(
    task: Task,
    onProgress: (progress: number) => void,
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

    // Ensure projectPath exists
    fs.mkdirSync(task.projectPath, { recursive: true });

    const startTime = Date.now();
    const outputChunks: string[] = [];
    let exitCode = 0;
    let killed = false;
    let progress = 10;

    // Progress ticker — report at least every 5 seconds
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress = Math.min(progress + 5, 90);
        onProgress(progress);
      }
    }, 5_000);

    return new Promise<ExecutionResult>((resolve) => {
      const args = [
        "--print", "--verbose",
        "--output-format", "stream-json",
        task.prompt,
      ];

      logger.info(`Spawning: ${claudePath} ${args.join(" ")}`);
      logger.debug(`cwd: ${task.projectPath}`);

      const child = spawn(claudePath, args, {
        cwd: task.projectPath,
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
        // Try to parse stream-json events for better progress tracking
        const lines = text.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const evt = JSON.parse(line);
            if (evt.type === "assistant" || evt.type === "result") {
              progress = Math.min(progress + 2, 95);
              onProgress(progress);
            }
          } catch {
            // Not JSON, just raw text — still count as progress
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
        const changedFiles = getChangedFiles(task.projectPath, startTime);

        if (killed) {
          logger.info(`Task ${task.taskId} killed after ${duration.toFixed(1)}s`);
          resolve({
            success: false,
            output,
            exitCode,
            error: `Task ${exitCode === null ? "cancelled" : "timed out"} after ${duration.toFixed(1)}s`,
            duration,
          });
        } else if (exitCode === 0) {
          logger.info(`Task ${task.taskId} completed in ${duration.toFixed(1)}s`);
          resolve({
            success: true,
            output,
            exitCode: 0,
            changedFiles,
            duration,
          });
        } else {
          logger.warn(`Task ${task.taskId} failed with exit code ${exitCode}`);
          resolve({
            success: false,
            output,
            exitCode,
            error: `Claude exited with code ${exitCode}`,
            changedFiles,
            duration,
          });
        }
      });
    });
  }
}

/**
 * Get list of files changed since `since` timestamp by checking git status.
 * Falls back to empty list if not a git repo.
 */
function getChangedFiles(projectPath: string, since: number): string[] {
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    // Use git diff to find changed files
    const sinceDate = new Date(since).toISOString();
    const output = execSync(
      `git -C "${projectPath}" diff --name-only --diff-filter=ACMR HEAD -- "${projectPath}" 2>/dev/null || git -C "${projectPath}" diff --name-only`,
      { encoding: "utf-8", timeout: 5_000 },
    ).trim();
    if (!output) return [];
    return output.split("\n").filter(Boolean).map((f) =>
      path.relative(projectPath, f)
    );
  } catch {
    return [];
  }
}
