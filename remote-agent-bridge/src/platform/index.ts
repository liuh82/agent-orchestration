import type { OSType } from '../protocol/types.js';
import { hostname } from 'os';

export const OS: OSType = process.platform as OSType;
export const IS_WINDOWS = OS === 'win32';
export const IS_MAC = OS === 'darwin';
export const IS_LINUX = OS === 'linux';
export const HOSTNAME = hostname();
export const NODE_VERSION = process.version;
export const ARCH = process.arch;

export function getOSType(): OSType {
  return OS;
}

export function getHostname(): string {
  return HOSTNAME;
}

export function getNodeVersion(): string {
  return NODE_VERSION;
}

export function isWindows(): boolean {
  return IS_WINDOWS;
}

export function isMac(): boolean {
  return IS_MAC;
}

export function isLinux(): boolean {
  return IS_LINUX;
}
