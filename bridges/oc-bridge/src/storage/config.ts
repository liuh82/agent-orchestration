import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { v4 } from "uuid";

export interface BridgeConfig {
  /** Nexus Gateway WebSocket URL */
  serverUrl: string;
  /** Gateway API token */
  token: string;
  /** Unique bridge ID (generated on first setup) */
  bridgeId: string;
  /** Max concurrent tasks */
  maxConcurrent: number;
}

const CONFIG_DIR = path.join(os.homedir(), ".oc-bridge");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function ensureDir(): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function loadConfig(): BridgeConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as BridgeConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: BridgeConfig): void {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  fs.chmodSync(CONFIG_FILE, 0o600); // owner-only read/write
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getBridgeId(config?: BridgeConfig): string {
  if (config?.bridgeId) return config.bridgeId;
  // Generate or restore bridge ID from state file
  ensureDir();
  const stateFile = path.join(CONFIG_DIR, "bridge-id");
  try {
    return fs.readFileSync(stateFile, "utf-8").trim();
  } catch {
    // Generate new one and persist
    const id = v4();
    fs.writeFileSync(stateFile, id, "utf-8");
    return id;
  }
}
