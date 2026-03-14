import type { OSType } from '../protocol/types.js';

export interface BridgeConfig {
  bridge: BridgeSection;
  gateway: GatewaySection;
  tasks: TasksSection;
  adapters: AdaptersSection;
  http: HttpSection;
  database: DatabaseSection;
  checkpoint: CheckpointSection;
  logging: LoggingSection;
  security: SecuritySection;
}

export interface BridgeSection {
  id: string;
  name: string;
  platform: OSType;
  hostname?: string;
}

export interface GatewaySection {
  url: string;
  wsUrl?: string;
  apiUrl?: string;
  token: string;
  heartbeatInterval: number;
  reconnect: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    jitter: number;
  };
}

export interface TasksSection {
  maxConcurrent: number;
  defaultTimeout: number;
  queue: {
    maxSize: number;
    timeoutMs: number;
  };
}

export interface AdaptersSection {
  available: string[];
  autoDetect: boolean;
  cli: CliAdapterConfig;
  vscode: IDEAdapterConfig;
  cursor: IDEAdapterConfig;
  intellij: IDEAdapterConfig;
}

export interface CliAdapterConfig {
  enabled: boolean;
  agents: {
    codex: { enabled: boolean; path?: string };
    pi: { enabled: boolean; path?: string };
    acp: { enabled: boolean; path?: string };
  };
}

export interface IDEAdapterConfig {
  enabled: boolean;
  enabledPhases: string[];
}

export interface HttpSection {
  enabled: boolean;
  host: string;
  port: number;
  cors: {
    enabled: boolean;
    origin: string;
  };
  auth: {
    enabled: boolean;
    apiKey: string;
  };
}

export interface DatabaseSection {
  path: string;
  busyTimeout: number;
  walMode: boolean;
  cacheSize: number;
}

export interface CheckpointSection {
  enabled: boolean;
  interval: number;
  maxAge: number;
  maxFiles: number;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggingSection {
  level: LogLevel;
  file: {
    enabled: boolean;
    maxSize: number;
    maxFiles: number;
  };
  console: {
    enabled: boolean;
    colored: boolean;
  };
}

export interface SecuritySection {
  sandbox: {
    enabled: boolean;
    allowedCommands: string[];
    blockedPatterns: string[];
    promptSafetyCheck: boolean;
    allowedBasePaths?: string[];
  };
  audit: {
    enabled: boolean;
    retentionDays: number;
  };
}
