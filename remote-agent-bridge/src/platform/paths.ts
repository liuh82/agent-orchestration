import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { OS } from './index.js';

export function getConfigDir(): string {
  if (OS === 'win32') {
    return join(process.env['APPDATA'] || homedir(), 'oc-bridge');
  }
  return join(homedir(), '.oc-bridge');
}

export function getTaskDir(): string {
  if (OS === 'win32') {
    return join(process.env['TEMP'] || homedir(), 'oc-tasks');
  }
  return join(tmpdir(), 'oc-tasks');
}

export function getLogDir(): string {
  const configDir = getConfigDir();
  return join(configDir, 'logs');
}

export function getDataDir(): string {
  const configDir = getConfigDir();
  return join(configDir, 'data');
}

export function getCheckpointDir(): string {
  const dataDir = getDataDir();
  return join(dataDir, 'checkpoints');
}

export function getTokenPath(): string {
  const configDir = getConfigDir();
  return join(configDir, 'gateway.token');
}

export function getConfigFilePath(): string {
  const configDir = getConfigDir();
  return join(configDir, 'config.json');
}

export function ensureDirectories(): void {
  const dirs = [getConfigDir(), getTaskDir(), getLogDir(), getDataDir(), getCheckpointDir()];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function normalizePath(path: string): string {
  if (OS === 'win32') {
    return path.replace(/\//g, '\\');
  }
  return path;
}
