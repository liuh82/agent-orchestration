/**
 * `oc-bridge start` — connect to Nexus Gateway and stay running.
 */
import { Command } from "commander";
import { loadConfig } from "../storage/config.js";
import { logger } from "../logger/index.js";
import { WSConnection, type ConnectionEvent } from "../websocket/connection.js";

export function startCommand(): Command {
  return new Command("start")
    .description("Connect to Nexus Gateway and start accepting tasks")
    .option("-v, --verbose", "Enable debug logging")
    .action(async (opts) => {
      if (opts.verbose) {
        logger.setLevel("debug");
      }

      const config = loadConfig();
      if (!config) {
        logger.error("Not configured. Run `oc-bridge setup` first.");
        process.exit(1);
      }

      logger.info(`Starting oc-bridge (id: ${config.bridgeId})...`);

      const conn = new WSConnection(config, handleEvent);

      // Graceful shutdown
      const shutdown = () => {
        logger.info("Shutting down...");
        conn.disconnect();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

      try {
        await conn.connect();
        logger.info("Ready — waiting for tasks...");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to connect: ${msg}`);
        process.exit(1);
      }
    });
}

function handleEvent(event: ConnectionEvent): void {
  switch (event.type) {
    case "registered":
      logger.info(`Bridge registered. Resumed tasks: ${event.resumedTasks.length}`);
      break;

    case "task.submit":
      // Phase 2 will implement actual task execution
      logger.info(`Task received (Phase 1 — acknowledging only): ${event.task.taskId}`);
      break;

    case "task.cancel":
      logger.info(`Task cancel received: ${event.task.taskId}`);
      break;

    case "disconnected":
      logger.warn(`Disconnected from server (code: ${event.code})`);
      // Phase 3 will implement reconnection
      process.exit(1);
      break;

    case "error":
      logger.error(`Connection error: ${event.error}`);
      break;
  }
}
