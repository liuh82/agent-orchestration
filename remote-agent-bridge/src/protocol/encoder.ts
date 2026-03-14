import { v4 as uuidv4 } from 'uuid';
import type { MessageType } from './types.js';

export interface EncodedMessage {
  msgId: string;
  type: MessageType;
  ts: number;
  data: unknown;
}

export function encodeMessage(type: MessageType, data: unknown): EncodedMessage {
  return {
    msgId: uuidv4(),
    type,
    ts: Date.now(),
    data,
  };
}

export function stringifyMessage(message: EncodedMessage): string {
  return JSON.stringify(message);
}

export function createAuthRequest(data: {
  token: string;
  bridgeId: string;
  platform: string;
  hostname: string;
  osVersion: string;
  nodeVersion: string;
  bridgeVersion: string;
}): string {
  const encoded = encodeMessage('auth.request', data);
  return stringifyMessage(encoded);
}

export function createBridgeRegister(data: {
  bridgeId: string;
  platform: string;
  hostname: string;
  osVersion: string;
  nodeVersion: string;
  bridgeVersion: string;
  availableAdapters: unknown[];
  activeIDEs: unknown[];
}): string {
  const encoded = encodeMessage('bridge.register', data);
  return stringifyMessage(encoded);
}

export function createTaskProgress(data: {
  taskId: string;
  status: string;
  output?: string;
  progress?: number;
  error?: string;
}): string {
  const encoded = encodeMessage('task.progress', data);
  return stringifyMessage(encoded);
}

export function createTaskComplete(data: {
  taskId: string;
  result: {
    exitCode: number;
    output: string;
    changedFiles: string[];
    duration: number;
  };
}): string {
  const encoded = encodeMessage('task.complete', data);
  return stringifyMessage(encoded);
}

export function createAck(originalMsgId: string, success: boolean): string {
  const encoded = encodeMessage('ack', { originalMsgId, success });
  return stringifyMessage(encoded);
}

export function createPong(timestamp: number): string {
  const encoded = encodeMessage('pong', { timestamp });
  return stringifyMessage(encoded);
}
