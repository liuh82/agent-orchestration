/**
 * `oc-bridge setup` — save gateway configuration.
 */
import { Command } from "commander";
import { saveConfig, getBridgeId, loadConfig, getConfigDir } from "../storage/config.js";
import { logger } from "../logger/index.js";
import { findClaudeCli } from "../utils/platform.js";

export function setupCommand(): Command {
  return new Command("setup")
    .description("Configure oc-bridge connection to Nexus Gateway")
    .requiredOption("--url <url>", "Gateway WebSocket URL, e.g. ws://localhost:8082/api/v1/gateway/ws")
    .requiredOption("--token <token>", "Gateway API token")
    .option("--max-concurrent <n>", "Max concurrent tasks", "3")
    .action((opts) => {
      const existing = loadConfig();
      const bridgeId = existing?.bridgeId || getBridgeId();

      const config = {
        serverUrl: opts.url,
        token: opts.token,
        bridgeId,
        maxConcurrent: parseInt(opts.maxConcurrent, 10),
      };

      saveConfig(config);

      const claudePath = findClaudeCli();
      if (!claudePath) {
        logger.warn("claude CLI not found in PATH. Task execution will fail until installed.");
        logger.warn("Install with: npm install -g @anthropic-ai/claude-code");
      }

      logger.info(`Configuration saved to ${getConfigDir()}/config.json`);
      logger.info(`Bridge ID: ${bridgeId}`);
      logger.info(`Server:   ${config.serverUrl}`);
      logger.info(`Next:     oc-bridge start`);
    });
}
