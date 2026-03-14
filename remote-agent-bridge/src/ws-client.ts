import WebSocket, { type WebSocket as WebSocketType } from 'ws';
import { EventEmitter } from 'events';
import type { BridgeMessage, BridgeStatus, TaskSubmit, TaskCancel } from './protocol/types.js';
import { decodeMessage } from './protocol/decoder.js';
import { createAuthRequest, createBridgeRegister, createTaskProgress, createTaskComplete, createAck, createPong } from './protocol/encoder.js';
import { getLogger } from './utils/logger.js';
import { ExponentialBackoff } from './utils/retry.js';
import { isTerminating } from './utils/graceful-shutdown.js';

const logger = getLogger('ws-client');

// ---- Runtime message validators ----

interface ValidatedAuthResponse {
  success: boolean;
  bridgeId?: string;
  error?: string;
}

interface ValidatedPing {
  timestamp: number;
}

interface ValidatedTaskSubmit {
  taskId: string;
  prompt: string;
  projectPath: string;
  agentType: string;
  timeout: number;
  priority: string;
  callbackId?: string;
  preferredIde?: string;
}

interface ValidatedTaskCancel {
  taskId: string;
  reason: string;
}

interface ValidatedAck {
  originalMsgId: string;
  success: boolean;
}

interface ValidatedError {
  code: string;
  message: string;
  details?: unknown;
}

function validateAuthResponse(data: unknown): ValidatedAuthResponse | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  if (typeof obj['success'] !== 'boolean') return null;
  return {
    success: obj['success'],
    bridgeId: typeof obj['bridgeId'] === 'string' ? obj['bridgeId'] : undefined,
    error: typeof obj['error'] === 'string' ? obj['error'] : undefined,
  };
}

function validatePing(data: unknown): ValidatedPing | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  if (typeof obj['timestamp'] !== 'number') return null;
  return { timestamp: obj['timestamp'] };
}

function validateTaskSubmit(data: unknown): ValidatedTaskSubmit | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  const taskId = obj['taskId'];
  if (typeof taskId !== 'string' || !taskId) return null;
  if (typeof obj['prompt'] !== 'string') return null;
  if (typeof obj['projectPath'] !== 'string') return null;
  if (typeof obj['agentType'] !== 'string') return null;
  return {
    taskId,
    prompt: obj['prompt'],
    projectPath: obj['projectPath'],
    agentType: obj['agentType'],
    timeout: typeof obj['timeout'] === 'number' ? obj['timeout'] : 300,
    priority: typeof obj['priority'] === 'string' ? obj['priority'] : 'normal',
    callbackId: typeof obj['callbackId'] === 'string' ? obj['callbackId'] : undefined,
    preferredIde: typeof obj['preferredIde'] === 'string' ? obj['preferredIde'] : undefined,
  };
}

function validateTaskCancel(data: unknown): ValidatedTaskCancel | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  const taskId = obj['taskId'];
  if (typeof taskId !== 'string' || !taskId) return null;
  if (typeof obj['reason'] !== 'string') return null;
  return { taskId, reason: obj['reason'] };
}

function validateAck(data: unknown): ValidatedAck | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  if (typeof obj['originalMsgId'] !== 'string') return null;
  if (typeof obj['success'] !== 'boolean') return null;
  return { originalMsgId: obj['originalMsgId'], success: obj['success'] };
}

function validateError(data: unknown): ValidatedError | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj: Record<string, unknown> = data as Record<string, unknown>;
  if (typeof obj['code'] !== 'string') return null;
  if (typeof obj['message'] !== 'string') return null;
  return {
    code: obj['code'],
    message: obj['message'],
    details: obj['details'],
  };
}

export interface WSClientConfig {
  url: string;
  token: string;
  bridgeId: string;
  hostname: string;
  osVersion: string;
  nodeVersion: string;
  bridgeVersion: string;
  heartbeatInterval: number;
  reconnect: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    jitter: number;
  };
}

type WSClientEvents = {
  connected: [];
  disconnected: [reason?: string];
  authenticated: [bridgeId: string];
  registered: [];
  taskSubmit: [task: TaskSubmit];
  taskCancel: [task: TaskCancel];
  ping: [timestamp: number];
  error: [error: Error];
  message: [msg: BridgeMessage];
};

class WSClient extends EventEmitter {
  private ws: WebSocketType | null = null;
  private config: WSClientConfig;
  private status: BridgeStatus = 'INITIALIZING';
  private connectedAt: number = 0;
  private lastPing: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private backoff: ExponentialBackoff;
  private reconnectAttempts = 0;
  private authenticated = false;
  private registered = false;

  constructor(config: WSClientConfig) {
    super();
    this.config = config;
    this.backoff = new ExponentialBackoff(
      config.reconnect.baseDelay,
      config.reconnect.maxDelay,
      config.reconnect.jitter
    );
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      logger.warn('Already connecting or connected');
      return;
    }

    if (isTerminating()) {
      logger.warn('Bridge is terminating, not connecting');
      return;
    }

    this.setStatus('CONNECTING');
    logger.info('Connecting to gateway', { url: this.config.url });

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => this.onOpen());
      this.ws.on('message', (rawData, isBinary) => this.onMessage(rawData, isBinary));
      this.ws.on('close', (code, reason) => this.onClose(code, reason));
      this.ws.on('error', (error) => this.onError(error));
    } catch (error) {
      logger.error('Failed to create WebSocket connection', { error });
      this.scheduleReconnect();
    }
  }

  disconnect(reason?: string): void {
    logger.info('Disconnecting', { reason });
    this.stopHeartbeat();
    this.cancelReconnect();

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close(1000, reason);
      this.ws = null;
    }

    this.authenticated = false;
    this.registered = false;
    this.setStatus('TERMINATED');
    this.emit('disconnected', reason);
  }

  private onOpen(): void {
    logger.info('WebSocket connection established');
    this.connectedAt = Date.now();
    this.setStatus('AUTHENTICATING');
    this.sendAuth();
  }

  private sendAuth(): void {
    const authData = {
      token: this.config.token,
      bridgeId: this.config.bridgeId,
      platform: process.platform as 'darwin' | 'win32' | 'linux',
      hostname: this.config.hostname,
      osVersion: this.config.osVersion,
      nodeVersion: this.config.nodeVersion,
      bridgeVersion: this.config.bridgeVersion,
    };

    const message = createAuthRequest(authData);
    this.sendRaw(message);
    logger.debug('Auth request sent');
  }

  private onMessage(rawData: unknown, _isBinary: boolean): void {
    try {
      let messageStr = '';
      if (Array.isArray(rawData)) {
        const buffer = rawData[0];
        if (Buffer.isBuffer(buffer)) {
          messageStr = buffer.toString();
        } else {
          logger.warn('Unknown message data type', { type: typeof rawData });
          return;
        }
      } else if (Buffer.isBuffer(rawData)) {
        messageStr = rawData.toString();
      } else if (typeof rawData === 'string') {
        messageStr = rawData;
      } else {
        logger.warn('Unknown message data type', { type: typeof rawData });
        return;
      }

      const message = decodeMessage(messageStr);

      if (!message) {
        logger.warn('Failed to decode message');
        return;
      }

      this.emit('message', message);

      switch (message.type) {
        case 'auth.response':
          this.handleAuthResponse(message.data as unknown);
          break;
        case 'ping':
          this.handlePing(message.data as unknown);
          break;
        case 'task.submit':
          this.handleTaskSubmit(message.data as unknown);
          break;
        case 'task.cancel':
          this.handleTaskCancel(message.data as unknown);
          break;
        case 'ack':
          this.handleAck(message.data as unknown);
          break;
        case 'error':
          this.handleError(message.data as unknown);
          break;
        default:
          logger.debug('Unhandled message type', { type: message.type });
      }
    } catch (error) {
      logger.error('Error processing message', { error });
    }
  }

  private handleAuthResponse(data: unknown): void {
    const response = validateAuthResponse(data);
    if (!response) {
      logger.error('Invalid auth_response message format', { data });
      return;
    }

    if (response.success) {
      this.authenticated = true;
      this.setStatus('REGISTERING');
      this.sendRegister();
      this.emit('authenticated', this.config.bridgeId);
      logger.info('Authentication successful');
    } else {
      logger.error('Authentication failed', { error: response.error });
      this.emit('error', new Error(`Authentication failed: ${response.error}`));
      this.disconnect('authentication_failed');
    }
  }

  private sendRegister(): void {
    const registerData = {
      bridgeId: this.config.bridgeId,
      platform: process.platform as 'darwin' | 'win32' | 'linux',
      hostname: this.config.hostname,
      osVersion: this.config.osVersion,
      nodeVersion: this.config.nodeVersion,
      bridgeVersion: this.config.bridgeVersion,
      availableAdapters: [],
      activeIDEs: [],
    };

    const message = createBridgeRegister(registerData);
    this.sendRaw(message);
    logger.debug('Register request sent');
  }

  private handlePing(data: unknown): void {
    const ping = validatePing(data);
    if (!ping) {
      logger.warn('Invalid ping message format', { data });
      return;
    }
    this.lastPing = ping.timestamp;
    const pong = createPong(ping.timestamp);
    this.sendRaw(pong);
    logger.debug('Pong sent');
  }

  private handleTaskSubmit(data: unknown): void {
    const task = validateTaskSubmit(data);
    if (!task) {
      logger.error('Invalid task_submit message format', { data });
      return;
    }
    const taskMsg: TaskSubmit = {
      type: 'task.submit',
      taskId: task.taskId,
      prompt: task.prompt,
      projectPath: task.projectPath,
      agentType: task.agentType as TaskSubmit['agentType'],
      timeout: task.timeout,
      priority: task.priority as TaskSubmit['priority'],
      callbackId: task.callbackId,
      preferredIde: task.preferredIde,
    };
    this.emit('taskSubmit', taskMsg);
    this.sendAck(task.taskId, true);
    logger.info('Task received', { taskId: task.taskId, priority: task.priority });
  }

  private handleTaskCancel(data: unknown): void {
    const task = validateTaskCancel(data);
    if (!task) {
      logger.error('Invalid task_cancel message format', { data });
      return;
    }
    const cancelMsg: TaskCancel = {
      type: 'task.cancel',
      taskId: task.taskId,
      reason: task.reason,
    };
    this.emit('taskCancel', cancelMsg);
    this.sendAck(task.taskId, true);
    logger.info('Task cancel received', { taskId: task.taskId, reason: task.reason });
  }

  private handleAck(data: unknown): void {
    const ack = validateAck(data);
    if (!ack) {
      logger.warn('Invalid ack message format', { data });
      return;
    }
    logger.debug('Ack received', { originalMsgId: ack.originalMsgId, success: ack.success });
  }

  private handleError(data: unknown): void {
    const error = validateError(data);
    if (!error) {
      logger.error('Invalid error message format', { data });
      return;
    }
    logger.error('Error message received', { code: error.code, message: error.message });
    this.emit('error', new Error(`Gateway error: ${error.code} - ${error.message}`));
  }

  private sendAck(originalMsgId: string, success: boolean): void {
    const ack = createAck(originalMsgId, success);
    this.sendRaw(ack);
  }

  private onClose(code: number, reason: Buffer): void {
    const reasonStr = reason.toString();
    logger.info('WebSocket connection closed', { code, reason: reasonStr });

    this.stopHeartbeat();
    this.authenticated = false;
    this.registered = false;
    this.ws = null;

    this.emit('disconnected', reasonStr || `code ${code}`);

    if (!isTerminating() && code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private onError(error: Error): void {
    logger.error('WebSocket error', { error });
    this.emit('error', error);
  }

  sendTaskProgress(taskId: string, status: string, output?: string, progress?: number, error?: string): void {
    const message = createTaskProgress({ taskId, status, output, progress, error });
    this.sendRaw(message);
  }

  sendTaskComplete(taskId: string, result: { exitCode: number; output: string; changedFiles: string[]; duration: number }): void {
    const message = createTaskComplete({ taskId, result });
    this.sendRaw(message);
    logger.info('Task complete sent', { taskId });
  }

  private sendRaw(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message: WebSocket not connected');
      return;
    }

    try {
      this.ws.send(message);
    } catch (error) {
      logger.error('Failed to send message', { error });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const message = createPong(Date.now());
      this.sendRaw(message);
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.cancelReconnect();

    if (this.reconnectAttempts >= this.config.reconnect.maxRetries) {
      logger.error('Max reconnection attempts reached');
      this.setStatus('TERMINATED');
      return;
    }

    const delay = this.backoff.next();
    this.reconnectAttempts++;

    logger.info(`Scheduling reconnect in ${Math.round(delay)}ms`, { attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: BridgeStatus): void {
    const oldStatus = this.status;
    this.status = status;
    logger.debug('Status changed', { oldStatus, newStatus: status });

    if (status === 'READY' && oldStatus !== 'READY') {
      this.startHeartbeat();
      this.registered = true;
      this.emit('registered');
      this.reconnectAttempts = 0;
      this.backoff.reset();
    }
  }

  getStatus(): BridgeStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'READY';
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  isRegistered(): boolean {
    return this.registered;
  }

  getConnectionInfo(): {
    status: BridgeStatus;
    connectedAt: number;
    uptime: number;
    lastPing: number;
  } {
    return {
      status: this.status,
      connectedAt: this.connectedAt,
      uptime: this.connectedAt > 0 ? Date.now() - this.connectedAt : 0,
      lastPing: this.lastPing,
    };
  }

  override on<E extends keyof WSClientEvents>(event: E, listener: (...args: WSClientEvents[E]) => void): this {
    return super.on(event, listener);
  }

  override off<E extends keyof WSClientEvents>(event: E, listener: (...args: WSClientEvents[E]) => void): this {
    return super.off(event, listener);
  }
}

export { WSClient };
