import os from "node:os";
import process from "node:process";
import { execSync } from "node:child_process";

export interface PlatformInfo {
  platform: string;
  hostname: string;
  osVersion: string;
  nodeVersion: string;
}

export function getPlatformInfo(): PlatformInfo {
  return {
    platform: os.platform(),
    hostname: os.hostname(),
    osVersion: os.release(),
    nodeVersion: process.version,
  };
}

/** Find the path to claude CLI, or null if not found. */
export function findClaudeCli(): string | null {
  try {
    return execSync("which claude", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}
