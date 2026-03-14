import { type DatabaseManager } from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('audit');

export interface AuditEvent {
  action: string;
  entity: string;
  entityId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

class AuditLogger {
  private db: DatabaseManager | null = null;
  private enabled = true;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  setDatabase(db: DatabaseManager): void {
    this.db = db;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.debug('Audit logger enabled status changed', { enabled });
  }

  log(event: AuditEvent): void {
    if (!this.enabled || !this.db) {
      return;
    }

    try {
      this.db.addAuditLog({
        id: uuidv4(),
        action: event.action,
        entity: event.entity,
        entityId: event.entityId,
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: event.details ? JSON.stringify(event.details) : undefined,
      });
      logger.debug('Audit log recorded', { action: event.action, entity: event.entity });
    } catch (error) {
      logger.error('Failed to write audit log', { event, error });
    }
  }

  logAuth(bridgeId: string, success: boolean, error?: string): void {
    this.log({
      action: 'AUTH',
      entity: 'bridge',
      entityId: bridgeId,
      details: { success, error },
    });
  }

  logTaskSubmit(taskId: string, agentType: string, prompt: string): void {
    this.log({
      action: 'TASK_SUBMIT',
      entity: 'task',
      entityId: taskId,
      details: { agentType, promptLength: prompt.length },
    });
  }

  logTaskStart(taskId: string, agentType: string): void {
    this.log({
      action: 'TASK_START',
      entity: 'task',
      entityId: taskId,
      details: { agentType },
    });
  }

  logTaskComplete(taskId: string, exitCode: number, duration: number): void {
    this.log({
      action: 'TASK_COMPLETE',
      entity: 'task',
      entityId: taskId,
      details: { exitCode, duration },
    });
  }

  logTaskFail(taskId: string, error: string): void {
    this.log({
      action: 'TASK_FAIL',
      entity: 'task',
      entityId: taskId,
      details: { error },
    });
  }

  logTaskCancel(taskId: string, reason: string): void {
    this.log({
      action: 'TASK_CANCEL',
      entity: 'task',
      entityId: taskId,
      details: { reason },
    });
  }

  logBridgeRegister(bridgeId: string, adapters: string[]): void {
    this.log({
      action: 'BRIDGE_REGISTER',
      entity: 'bridge',
      entityId: bridgeId,
      details: { adapters },
    });
  }

  logBridgeDisconnect(bridgeId: string, reason?: string): void {
    this.log({
      action: 'BRIDGE_DISCONNECT',
      entity: 'bridge',
      entityId: bridgeId,
      details: { reason },
    });
  }

  logSecurityViolation(type: string, details: Record<string, unknown>): void {
    this.log({
      action: 'SECURITY_VIOLATION',
      entity: 'security',
      details: { type, ...details },
    });
  }

  logConfigChange(key: string, oldValue: unknown, newValue: unknown): void {
    this.log({
      action: 'CONFIG_CHANGE',
      entity: 'config',
      details: { key, oldValue, newValue },
    });
  }
}

let auditLogger: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!auditLogger) {
    auditLogger = new AuditLogger();
  }
  return auditLogger;
}

export { AuditLogger };
