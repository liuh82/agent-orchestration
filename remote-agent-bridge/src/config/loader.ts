import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { DEFAULT_CONFIG } from './defaults.js';
import { getConfigFilePath, getDataDir } from '../platform/paths.js';
import { getLogger } from '../utils/logger.js';
import type { BridgeConfig } from './types.js';
import type { LogLevel } from './types.js';

const logger = getLogger('config-loader');

const configSchema = z.object({
  bridge: z.object({
    id: z.string().default(''),
    name: z.string().default(''),
    platform: z.string().default(''),
  }),
  gateway: z.object({
    url: z.string().url().default(''),
    wsUrl: z.string().url().optional(),
    apiUrl: z.string().url().optional(),
    token: z.string().default(''),
    heartbeatInterval: z.number().int().positive().default(30000),
    reconnect: z.object({
      maxRetries: z.number().int().positive().default(Infinity),
      baseDelay: z.number().int().positive().default(1000),
      maxDelay: z.number().int().positive().default(60000),
      jitter: z.number().int().nonnegative().default(1000),
    }),
  }),
  tasks: z.object({
    maxConcurrent: z.number().int().positive().default(3),
    defaultTimeout: z.number().int().positive().default(300),
    queue: z.object({
      maxSize: z.number().int().positive().default(1000),
      timeoutMs: z.number().int().positive().default(300000),
    }),
  }),
  adapters: z.object({
    available: z.array(z.string()).default(['cli']),
    autoDetect: z.boolean().default(true),
    cli: z.object({
      enabled: z.boolean().default(true),
      agents: z.object({
        codex: z.object({ enabled: z.boolean(), path: z.string().optional() }),
        pi: z.object({ enabled: z.boolean(), path: z.string().optional() }),
        acp: z.object({ enabled: z.boolean(), path: z.string().optional() }),
      }),
    }),
    vscode: z.object({
      enabled: z.boolean().default(false),
      enabledPhases: z.array(z.string()).default(['2', '3']),
    }),
    cursor: z.object({
      enabled: z.boolean().default(false),
      enabledPhases: z.array(z.string()).default(['2', '3']),
    }),
    intellij: z.object({
      enabled: z.boolean().default(false),
      enabledPhases: z.array(z.string()).default(['3']),
    }),
  }),
  http: z.object({
    enabled: z.boolean().default(true),
    host: z.string().default('127.0.0.1'),
    port: z.number().int().positive().default(18790),
    cors: z.object({
      enabled: z.boolean().default(false),
      origin: z.string().default('*'),
    }),
    auth: z.object({
      enabled: z.boolean().default(false),
      apiKey: z.string().default(''),
    }),
  }),
  database: z.object({
    path: z.string().default(''),
    busyTimeout: z.number().int().positive().default(5000),
    walMode: z.boolean().default(true),
    cacheSize: z.number().int().positive().default(16000),
  }),
  checkpoint: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().int().positive().default(60000),
    maxAge: z.number().int().positive().default(86400000),
    maxFiles: z.number().int().positive().default(10),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    file: z.object({
      enabled: z.boolean().default(true),
      maxSize: z.number().int().positive().default(10485760),
      maxFiles: z.number().int().positive().default(5),
    }),
    console: z.object({
      enabled: z.boolean().default(true),
      colored: z.boolean().default(true),
    }),
  }),
  security: z.object({
    sandbox: z.object({
      enabled: z.boolean().default(true),
      allowedCommands: z.array(z.string()).default(['codex', 'pi']),
      blockedPatterns: z.array(z.string()).default([]),
      promptSafetyCheck: z.boolean().default(true),
    }),
    audit: z.object({
      enabled: z.boolean().default(true),
      retentionDays: z.number().int().positive().default(30),
    }),
  }),
});

type ConfigFile = z.infer<typeof configSchema>;

export type { ConfigFile };

export function loadConfig(): ConfigFile {
  const configPath = getConfigFilePath();

  if (!existsSync(configPath)) {
    logger.info('No config file found, using defaults');
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const validated = configSchema.parse(parsed);
    logger.info('Config loaded successfully', { path: configPath });
    return mergeWithDefaults(validated);
  } catch (error) {
    logger.warn('Failed to load config, using defaults', { error, path: configPath });
    return DEFAULT_CONFIG;
  }
}

export function loadConfigFromEnv(): Partial<BridgeConfig> {
  const overrides: Partial<BridgeConfig> = {};

  const envValue = (key: string): string | undefined => {
    return process.env[key];
  };

  const bridgeId = envValue('OC_BRIDGE_ID');
  const bridgeName = envValue('OC_BRIDGE_NAME');
  const gatewayUrl = envValue('OC_GATEWAY_URL');
  const gatewayToken = envValue('OC_GATEWAY_TOKEN');
  const heartbeatInterval = envValue('OC_GATEWAY_HEARTBEAT_INTERVAL');
  const maxConcurrent = envValue('OC_TASKS_MAX_CONCURRENT');
  const defaultTimeout = envValue('OC_TASKS_DEFAULT_TIMEOUT');
  const httpEnabled = envValue('OC_HTTP_ENABLED');
  const httpHost = envValue('OC_HTTP_HOST');
  const httpPort = envValue('OC_HTTP_PORT');
  const logLevel = envValue('OC_LOG_LEVEL');
  const databasePath = envValue('OC_DATABASE_PATH');
  const checkpointEnabled = envValue('OC_CHECKPOINT_ENABLED');
  const sandboxEnabled = envValue('OC_SANDBOX_ENABLED');

  if (bridgeId) {
    overrides.bridge = { ...(overrides.bridge ?? DEFAULT_CONFIG.bridge), id: bridgeId };
  }
  if (bridgeName) {
    overrides.bridge = { ...(overrides.bridge ?? DEFAULT_CONFIG.bridge), name: bridgeName };
  }
  if (gatewayUrl) {
    overrides.gateway = { ...(overrides.gateway ?? DEFAULT_CONFIG.gateway), url: gatewayUrl };
  }
  if (gatewayToken) {
    overrides.gateway = { ...(overrides.gateway ?? DEFAULT_CONFIG.gateway), token: gatewayToken };
  }
  if (heartbeatInterval) {
    const parsed = parseInt(heartbeatInterval, 10);
    if (!isNaN(parsed)) {
      overrides.gateway = { ...(overrides.gateway ?? DEFAULT_CONFIG.gateway), heartbeatInterval: parsed };
    }
  }
  if (maxConcurrent) {
    const parsed = parseInt(maxConcurrent, 10);
    if (!isNaN(parsed)) {
      overrides.tasks = { ...(overrides.tasks ?? DEFAULT_CONFIG.tasks), maxConcurrent: parsed };
    }
  }
  if (defaultTimeout) {
    const parsed = parseInt(defaultTimeout, 10);
    if (!isNaN(parsed)) {
      overrides.tasks = { ...(overrides.tasks ?? DEFAULT_CONFIG.tasks), defaultTimeout: parsed };
    }
  }
  if (httpEnabled) {
    const parsed = httpEnabled === 'true';
    overrides.http = { ...(overrides.http ?? DEFAULT_CONFIG.http), enabled: parsed };
  }
  if (httpHost) {
    overrides.http = { ...(overrides.http ?? DEFAULT_CONFIG.http), host: httpHost };
  }
  if (httpPort) {
    const parsed = parseInt(httpPort, 10);
    if (!isNaN(parsed)) {
      overrides.http = { ...(overrides.http ?? DEFAULT_CONFIG.http), port: parsed };
    }
  }
  if (logLevel && ['error', 'warn', 'info', 'debug'].includes(logLevel)) {
    overrides.logging = { ...(overrides.logging ?? DEFAULT_CONFIG.logging), level: logLevel as LogLevel };
  }
  if (databasePath) {
    overrides.database = { ...(overrides.database ?? DEFAULT_CONFIG.database), path: databasePath };
  }
  if (checkpointEnabled) {
    const parsed = checkpointEnabled === 'true';
    overrides.checkpoint = { ...(overrides.checkpoint ?? DEFAULT_CONFIG.checkpoint), enabled: parsed };
  }
  if (sandboxEnabled) {
    const parsed = sandboxEnabled === 'true';
    overrides.security = {
      ...(overrides.security ?? DEFAULT_CONFIG.security),
      sandbox: {
        ...(overrides.security?.sandbox ?? DEFAULT_CONFIG.security.sandbox),
        enabled: parsed,
      },
    };
  }

  if (Object.keys(overrides).length > 0) {
    logger.debug('Config overrides from env loaded');
  }

  return overrides;
}

export function mergeConfigs(base: BridgeConfig, override: Partial<BridgeConfig>): BridgeConfig {
  return {
    ...base,
    ...override,
    bridge: { ...base.bridge, ...(override.bridge ?? {}) },
    gateway: { ...base.gateway, ...(override.gateway ?? {}) },
    tasks: { ...base.tasks, ...(override.tasks ?? {}) },
    adapters: { ...base.adapters, ...(override.adapters ?? {}) },
    http: { ...base.http, ...(override.http ?? {}) },
    database: { ...base.database, ...(override.database ?? {}) },
    checkpoint: { ...base.checkpoint, ...(override.checkpoint ?? {}) },
    logging: { ...base.logging, ...(override.logging ?? {}) },
    security: { ...base.security, ...(override.security ?? {}) },
  };
}

export function saveConfig(config: ConfigFile): void {
  const configPath = getConfigFilePath();
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  logger.info('Config saved', { path: configPath });
}

export function getDatabasePath(config: BridgeConfig): string {
  if (config.database.path) {
    return config.database.path;
  }
  return join(getDataDir(), 'bridge.db');
}

const mergeWithDefaults = (validated: unknown): BridgeConfig => {
  return { ...DEFAULT_CONFIG, ...(validated as Partial<BridgeConfig>) };
};
