/**
 * `oc-bridge start` — connect to Nexus Gateway and start accepting tasks.
 * Includes graceful shutdown, state persistence check, and reconnection support.
 */
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, getConfigDir } from "../storage/config.js";
import { logger } from "../logger/index.js";
import { WSConnection, type ConnectionEvent } from "../websocket/connection.js";
import { TaskManager } from "../task/task-manager.js";
import { initRegistry } from "../agent/registry.js";
import { checkPreviousSession } from "../storage/state.js";

const GRACEFUL_SHUTDOWN_MS = 10_000;

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

      // Check for unfinished tasks from previous session
      checkPreviousSession();

      // Initialize agent registry
      initRegistry();

      // Create WSConnection — we need a reference to set up TaskManager later
      let taskManager: TaskManager | null = null;

      const conn = new WSConnection(config, (event: ConnectionEvent) => {
        handleEvent(event, taskManager!);
      });

      // Graceful shutdown handler
      let shuttingDown = false;
      const shutdown = async () => {
        if (shuttingDown) return; // prevent double-shutdown
        shuttingDown = true;

        logger.info("Shutting down...");

        // 1. Stop accepting new tasks
        if (taskManager) {
          taskManager.stopAccepting();
        }

        // 2. Wait for running tasks (max 10s)
        if (taskManager && taskManager.activeCount > 0) {
          await taskManager.drainRunning(GRACEFUL_SHUTDOWN_MS);
        }

        // 3. Persist state
        if (taskManager) {
          taskManager.persistState();
        }

        // 4. Close WebSocket (stops reconnection)
        conn.disconnect();

        // 5. Clean up PID file
        try {
          fs.unlinkSync(pidFile);
        } catch {
          // ignore
        }

        logger.info("Shutdown complete");
        process.exit(0);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

      // PID file for status/stop commands
      const pidFile = path.join(getConfigDir(), "bridge.pid");

      try {
        await conn.connect();
        // Create TaskManager after connection is established so it can send messages
        taskManager = new TaskManager(config.maxConcurrent, { send: (msg) => conn.send(msg) });

        // Write PID file
        fs.writeFileSync(pidFile, String(process.pid), "utf-8");
        logger.info(`PID file written: ${pidFile}`);

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
      // Reconnection is handled inside WSConnection — just log
      logger.warn(`Disconnected from server (code: ${event.code})`);
      break;

    case "error":
      logger.error(`Connection error: ${event.error}`);
      break;
  }
}
