#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, loadConfigFromEnv, saveConfig, mergeConfigs } from './config/loader.js';
import type { BridgeConfig } from './config/types.js';
import { Bridge } from './bridge.js';
import { HttpServer } from './http-server.js';
import { setupGracefulShutdown, registerShutdownHandler } from './utils/graceful-shutdown.js';
import { getLogger } from './utils/logger.js';
import { BRIDGE_VERSION, BRIDGE_NAME } from './version.js';
import { ensureDirectories, getConfigFilePath, getTokenPath } from './platform/paths.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const logger = getLogger('cli');

const program = new Command();

program
  .name('oc-bridge')
  .description(`${BRIDGE_NAME} - Remote Agent Bridge for AI Agent Orchestration`)
  .version(BRIDGE_VERSION);

program
  .command('start')
  .description('Start the Bridge service')
  .option('-c, --config <path>', 'Path to config file')
  .option('--gateway-url <url>', 'Gateway WebSocket URL')
  .option('--gateway-token <token>', 'Gateway authentication token')
  .option('--http-port <port>', 'HTTP server port', '18790')
  .option('--log-level <level>', 'Log level (error, warn, info, debug)', 'info')
  .action(startCommand);

program
  .command('setup')
  .description('Interactive setup wizard')
  .action(setupCommand);

program
  .command('status')
  .description('Show Bridge status')
  .action(statusCommand);

program
  .command('config')
  .description('Manage configuration')
  .argument('[action]', 'Action: show, edit, reset', 'show')
  .action(configCommand);

program
  .command('token')
  .description('Set or show gateway token')
  .argument('[token]', 'Gateway token to set')
  .action(tokenCommand);

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

async function startCommand(options: {
  config?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  httpPort?: string;
  logLevel?: string;
}): Promise<void> {
  try {
    ensureDirectories();

    let bridgeConfig = loadConfig() as BridgeConfig;

    if (options['gatewayUrl'] !== undefined) {
      bridgeConfig.gateway.url = options['gatewayUrl'];
    }
    if (options['gatewayToken'] !== undefined) {
      bridgeConfig.gateway.token = options['gatewayToken'];
    }
    if (options['httpPort'] !== undefined) {
      bridgeConfig.http.port = parseInt(options['httpPort'], 10);
    }
    if (options['logLevel'] !== undefined) {
      const validLevels = ['error', 'warn', 'info', 'debug'];
      const level = options['logLevel'];
      if (validLevels.includes(level)) {
        bridgeConfig.logging.level = level as 'error' | 'warn' | 'info' | 'debug';
      }
    }

    const envConfig = loadConfigFromEnv();
    bridgeConfig = mergeConfigs(bridgeConfig, envConfig);

    logger.info(`${BRIDGE_NAME} v${BRIDGE_VERSION}`, {
      platform: process.platform,
      nodeVersion: process.version,
    });

    const httpServer = new HttpServer(bridgeConfig.http);
    await httpServer.start();

    const bridge = new Bridge(bridgeConfig);
    httpServer.setBridge(bridge);

    registerShutdownHandler({
      name: 'bridge',
      handler: async (signal: NodeJS.Signals) => {
        logger.info(`Received ${signal}, shutting down...`);
        await httpServer.stop();
        await bridge.stop();
      },
      timeout: 30000,
    });

    setupGracefulShutdown();

    await bridge.start();

  } catch (error) {
    logger.error('Failed to start Bridge', { error });
    process.exit(1);
  }
}

async function setupCommand(): Promise<void> {
  logger.info('Starting interactive setup...');

  ensureDirectories();

  const existingConfig = loadConfig() as BridgeConfig;

  const answers = await promptForConfig(existingConfig);

  saveConfig(answers);

  logger.info('Configuration saved to', { path: getConfigFilePath() });
  logger.info('Run "oc-bridge start" to start the bridge');
}

async function promptForConfig(_existing: BridgeConfig): Promise<BridgeConfig> {
  const { DEFAULT_CONFIG } = await import('./config/defaults.js');
  return DEFAULT_CONFIG as BridgeConfig;
}

async function statusCommand(): Promise<void> {
  const configFilePath = getConfigFilePath();
  const tokenPath = getTokenPath();

  console.log('\n=== Bridge Status ===\n');

  console.log('Configuration:');
  if (existsSync(configFilePath)) {
    const config = loadConfig() as BridgeConfig;
    console.log(`  File: ${configFilePath}`);
    console.log(`  Gateway URL: ${config.gateway.url}`);
    console.log(`  Bridge ID: ${config.bridge.id || 'not set'}`);
    console.log(`  HTTP Server: ${config.http.enabled ? `enabled (${config.http.host}:${config.http.port})` : 'disabled'}`);
  } else {
    console.log(`  No config file found at ${configFilePath}`);
  }

  console.log('\nToken:');
  if (existsSync(tokenPath)) {
    const token = readFileSync(tokenPath, 'utf-8').trim();
    console.log(`  Token file: ${tokenPath}`);
    console.log(`  Token: ${token.substring(0, 8)}...`);
  } else {
    console.log(`  No token file found at ${tokenPath}`);
  }

  console.log();
}

async function configCommand(action: string): Promise<void> {
  const configFilePath = getConfigFilePath();

  switch (action) {
    case 'show':
      if (existsSync(configFilePath)) {
        const config = loadConfig();
        console.log(JSON.stringify(config, null, 2));
      } else {
        console.log('No config file found');
      }
      break;

    case 'edit':
      console.log(`Edit config at: ${configFilePath}`);
      break;

    case 'reset':
      const { DEFAULT_CONFIG } = await import('./config/defaults.js');
      saveConfig(DEFAULT_CONFIG);
      console.log('Configuration reset to defaults');
      break;

    default:
      console.log(`Unknown action: ${action}`);
      console.log('Available actions: show, edit, reset');
  }
}

async function tokenCommand(token?: string): Promise<void> {
  const tokenPath = getTokenPath();

  if (token) {
    writeFileSync(tokenPath, token.trim(), { mode: 0o600 });
    console.log(`Token saved to ${tokenPath}`);
  } else if (existsSync(tokenPath)) {
    const savedToken = readFileSync(tokenPath, 'utf-8').trim();
    console.log(`Token: ${savedToken.substring(0, 8)}...`);
  } else {
    console.log(`No token file found at ${tokenPath}`);
    console.log('Use "oc-bridge token <your-token>" to set it');
  }
}
