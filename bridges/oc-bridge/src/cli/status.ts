/**
 * `oc-bridge status` — show configuration and runtime status.
 */
import { Command } from "commander";
import fs from "node:fs";
import { loadConfig, getConfigDir } from "../storage/config.js";
import { loadState } from "../storage/state.js";
import { logger } from "../logger/index.js";
import { findClaudeCli } from "../utils/platform.js";

export function statusCommand(): Command {
  return new Command("status")
    .description("Show oc-bridge configuration and status")
    .action(() => {
      const config = loadConfig();

      if (!config) {
        console.log("oc-bridge is not configured.");
        console.log("Run `oc-bridge setup` first to configure the connection.");
        process.exit(1);
      }

      console.log("=== oc-bridge Status ===\n");

      // Configuration
      console.log("[Configuration]");
      console.log(`  Bridge ID:      ${config.bridgeId}`);
      console.log(`  Server URL:     ${config.serverUrl}`);
      console.log(`  Token:          ${config.token.slice(0, 8)}...`);
      console.log(`  Max Concurrent: ${config.maxConcurrent}`);
      console.log(`  Config Dir:     ${getConfigDir()}`);

      // Claude CLI
      const claudePath = findClaudeCli();
      console.log(`  Claude CLI:     ${claudePath ?? "NOT FOUND"}`);

      // State
      const state = loadState();
      console.log(`\n[State]`);
      console.log(`  Unfinished Tasks: ${state.tasks.length}`);
      if (state.tasks.length > 0) {
        for (const t of state.tasks) {
          console.log(`    - ${t.taskId} (${t.status})`);
        }
      }
      console.log(`  Last Saved:      ${state.lastSaved}`);

      // PID file check
      const pidFile = `${getConfigDir()}/bridge.pid`;
      try {
        const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
        // Check if process is alive
        try {
          process.kill(pid, 0);
          console.log(`\n[Runtime]`);
          console.log(`  Status:   RUNNING (pid: ${pid})`);
        } catch {
          console.log(`\n[Runtime]`);
          console.log(`  Status:   NOT RUNNING (stale pid: ${pid})`);
          console.log(`  Hint:     Run \`oc-bridge start\` to start.`);
        }
      } catch {
        console.log(`\n[Runtime]`);
        console.log(`  Status:   NOT RUNNING`);
        console.log(`  Hint:     Run \`oc-bridge start\` to start.`);
      }
    });
}
