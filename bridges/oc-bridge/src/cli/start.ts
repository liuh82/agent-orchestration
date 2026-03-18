/**
 * `oc-bridge start` — connect to Nexus Gateway and start accepting tasks.
 */
import { Command } from "commander";
import { loadConfig } from "../storage/config.js";
import { logger } from "../logger/index.js";
import { WSConnection, type ConnectionEvent } from "../websocket/connection.js";
import { TaskManager } from "../task/task-manager.js";
import { initRegistry } from "../agent/registry.js";

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

      // Initialize agent registry
      initRegistry();

      // Create WSConnection — we need a reference to set up TaskManager later
      let taskManager: TaskManager | null = null;

      const conn = new WSConnection(config, (event: ConnectionEvent) => {
        handleEvent(event, taskManager!);
      });

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
        // Create TaskManager after connection is established so it can send messages
        taskManager = new TaskManager(config.maxConcurrent, { send: (msg) => conn.send(msg) });
        logger.info("Ready — waiting for tasks...");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to connect: ${msg}`);
        process.exit(1);
      }
    });
}

function handleEvent(event: ConnectionEvent, taskManager: TaskManager): void {
  switch (event.type) {
    case "registered":
      logger.info(`Bridge registered. Resumed tasks: ${event.resumedTasks.length}`);
      break;

    case "task.submit":
      taskManager.submit(event.task);
      break;

    case "task.cancel":
      taskManager.cancel(event.task.taskId);
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
