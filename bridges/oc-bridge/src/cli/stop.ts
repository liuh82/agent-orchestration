/**
 * `oc-bridge stop` — send SIGTERM to a running bridge process.
 */
import { Command } from "commander";
import fs from "node:fs";
import { getConfigDir } from "../storage/config.js";
import { logger } from "../logger/index.js";

export function stopCommand(): Command {
  return new Command("stop")
    .description("Stop a running oc-bridge process")
    .action(() => {
      const pidFile = `${getConfigDir()}/bridge.pid`;

      let pid: number;
      try {
        pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
      } catch {
        logger.error("No running bridge found (no PID file).");
        process.exit(1);
      }

      // Verify process is alive
      try {
        process.kill(pid, 0);
      } catch {
        logger.error(`Bridge process (pid: ${pid}) is not running. Cleaning up stale PID file.`);
        try {
          fs.unlinkSync(pidFile);
        } catch {
          // ignore
        }
        process.exit(1);
      }

      // Send SIGTERM
      try {
        process.kill(pid, "SIGTERM");
        logger.info(`Sent SIGTERM to bridge process (pid: ${pid})`);
        logger.info("Bridge is shutting down gracefully...");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to stop bridge: ${msg}`);
        process.exit(1);
      }
    });
}
