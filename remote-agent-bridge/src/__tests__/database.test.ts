/**
 * P1-4: Tests for database.ts listTasks/getAuditLogs parameter naming consistency.
 *
 * Validates that the SQL query builder uses object property access
 * consistently (not dictionary-style access).
 */

import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DatabaseManager } from '../database';

let db: DatabaseManager;
let dbPath: string;

beforeEach(() => {
  dbPath = join(tmpdir(), `test-bridge-${Date.now()}.db`);
  db = new DatabaseManager(dbPath);
  db.initialize();
});

afterEach(() => {
  db.close();
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }
});

describe('DatabaseManager - listTasks parameter naming', () => {
  it('returns empty array when no tasks', () => {
    const results = db.listTasks();
    expect(results).toEqual([]);
  });

  it('filters by status correctly', () => {
    db.createTask({
      id: 'task-1',
      type: 'task.submit',
      prompt: 'fix bug',
      projectPath: '/tmp',
      agentType: 'cli',
      priority: 'normal',
      status: 'pending',
      timeout: 300,
    });
    db.createTask({
      id: 'task-2',
      type: 'task.submit',
      prompt: 'add feature',
      projectPath: '/tmp',
      agentType: 'cli',
      priority: 'high',
      status: 'running',
      timeout: 600,
    });

    const pending = db.listTasks({ status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe('task-1');

    const running = db.listTasks({ status: 'running' });
    expect(running).toHaveLength(1);
    expect(running[0]?.id).toBe('task-2');

    const all = db.listTasks();
    expect(all).toHaveLength(2);
  });

  it('applies limit correctly', () => {
    for (let i = 0; i < 5; i++) {
      db.createTask({
        id: `task-limit-${i}`,
        type: 'task.submit',
        prompt: `task ${i}`,
        projectPath: '/tmp',
        agentType: 'cli',
        priority: 'normal',
        status: 'pending',
        timeout: 300,
      });
    }

    const limited = db.listTasks({ limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it('applies offset correctly', () => {
    for (let i = 0; i < 5; i++) {
      db.createTask({
        id: `task-offset-${i}`,
        type: 'task.submit',
        prompt: `task ${i}`,
        projectPath: '/tmp',
        agentType: 'cli',
        priority: 'normal',
        status: 'pending',
        timeout: 300,
      });
    }

    const page1 = db.listTasks({ limit: 2, offset: 0 });
    const page2 = db.listTasks({ limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);
    // Ensure pages don't overlap
    const ids1 = new Set(page1.map(t => t.id));
    const ids2 = new Set(page2.map(t => t.id));
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it('returns all tasks without options', () => {
    db.createTask({
      id: 'task-all',
      type: 'task.submit',
      prompt: 'test',
      projectPath: '/tmp',
      agentType: 'cli',
      priority: 'normal',
      status: 'pending',
      timeout: 300,
    });

    const results = db.listTasks({});
    expect(results).toHaveLength(1);
  });
});

describe('DatabaseManager - getAuditLogs parameter naming', () => {
  it('returns empty array when no logs', () => {
    const results = db.getAuditLogs();
    expect(results).toEqual([]);
  });

  it('filters by action correctly', () => {
    db.addAuditLog({
      id: 'audit-1',
      action: 'task_submit',
      entity: 'task',
      entityId: 'task-1',
      userId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      details: '',
    });
    db.addAuditLog({
      id: 'audit-2',
      action: 'auth',
      entity: 'bridge',
      entityId: 'bridge-1',
      userId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      details: '',
    });

    const submitLogs = db.getAuditLogs({ action: 'task_submit' });
    expect(submitLogs).toHaveLength(1);
    expect(submitLogs[0]?.id).toBe('audit-1');

    const authLogs = db.getAuditLogs({ action: 'auth' });
    expect(authLogs).toHaveLength(1);
    expect(authLogs[0]?.id).toBe('audit-2');

    const all = db.getAuditLogs();
    expect(all).toHaveLength(2);
  });

  it('applies limit correctly', () => {
    for (let i = 0; i < 5; i++) {
      db.addAuditLog({
        id: `audit-limit-${i}`,
        action: 'task_submit',
        entity: 'task',
        entityId: `task-${i}`,
        userId: 'user-1',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        details: '',
      });
    }

    const limited = db.getAuditLogs({ limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it('returns all logs without options', () => {
    db.addAuditLog({
      id: 'audit-all',
      action: 'test',
      entity: 'entity',
      entityId: 'entity-1',
      userId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      details: '',
    });

    const results = db.getAuditLogs({});
    expect(results).toHaveLength(1);
  });
});
