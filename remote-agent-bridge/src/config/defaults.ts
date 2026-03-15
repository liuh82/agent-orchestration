import type { BridgeConfig } from './types.js';
import { OS } from '../platform/index.js';
import { HOSTNAME } from '../platform/index.js';

export const DEFAULT_CONFIG: BridgeConfig = {
  bridge: {
    id: '',
    name: `bridge-${OS}-${HOSTNAME}`,
    platform: OS,
    hostname: HOSTNAME,
  },
  gateway: {
    url: process.env.OC_GATEWAY_URL || '',
    token: process.env.OC_GATEWAY_TOKEN || '',
    heartbeatInterval: 30000,
    reconnect: {
      maxRetries: Infinity,
      baseDelay: 1000,
      maxDelay: 60000,
      jitter: 1000,
    },
  },
  tasks: {
    maxConcurrent: 3,
    defaultTimeout: 300,
    queue: {
      maxSize: 1000,
      timeoutMs: 300000,
    },
  },
  adapters: {
    available: ['cli'],
    autoDetect: true,
    cli: {
      enabled: true,
      agents: {
        codex: { enabled: true },
        pi: { enabled: true },
        acp: { enabled: true },
      },
    },
    vscode: {
      enabled: false,
      enabledPhases: ['2', '3'],
    },
    cursor: {
      enabled: false,
      enabledPhases: ['2', '3'],
    },
    intellij: {
      enabled: false,
      enabledPhases: ['3'],
    },
  },
  http: {
    enabled: true,
    host: '127.0.0.1',
    port: 18790,
    cors: {
      enabled: false,
      origin: '*',
    },
    auth: {
      enabled: process.env.NODE_ENV === 'production',
      apiKey: process.env.OC_HTTP_API_KEY || '',
    },
  },
  database: {
    path: '',
    busyTimeout: 5000,
    walMode: true,
    cacheSize: 16000,
  },
  checkpoint: {
    enabled: true,
    interval: 60000,
    maxAge: 86400000,
    maxFiles: 10,
  },
  logging: {
    level: 'info',
    file: {
      enabled: true,
      maxSize: 10485760,
      maxFiles: 5,
    },
    console: {
      enabled: true,
      colored: true,
    },
  },
  security: {
    sandbox: {
      enabled: true,
      allowedCommands: ['codex', 'pi', 'openclaw'],
      blockedPatterns: [
        'rm -rf',
        'sudo',
        'chmod 777',
        'mkfs',
        'format',
        'del /f',
        'format c:',
      ],
      promptSafetyCheck: true,
      allowedBasePaths: ['/home', '/workspace', '/projects', '/tmp', process.env['HOME'] || '/home'],
    },
    audit: {
      enabled: true,
      retentionDays: 30,
    },
  },
};

export const PRIORITY_WEIGHTS = {
  high: 3,
  normal: 2,
  low: 1,
} as const;

export const TASK_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['queued', 'cancelled'],
  queued: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: ['queued'],
  cancelled: [],
};

/** Validate critical config values — call at startup */
export function validateConfig(config: BridgeConfig): string[] {
  const errors: string[] = [];

  if (!config.gateway.token) {
    errors.push('gateway.token is empty — set OC_GATEWAY_TOKEN env var');
  }

  if (config.http.enabled && config.http.auth.enabled && !config.http.auth.apiKey) {
    errors.push('http.auth.apiKey is empty while HTTP auth is enabled — set OC_HTTP_API_KEY env var');
  }

  if (process.env.NODE_ENV === 'production' && !config.http.auth.enabled) {
    errors.push('HTTP auth must be enabled in production — set OC_HTTP_API_KEY env var');
  }

  return errors;
}
