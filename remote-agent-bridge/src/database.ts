import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getDataDir } from './platform/paths.js';
import { getLogger } from './utils/logger.js';

const logger = getLogger('database');

interface TaskRecord {
  id: string;
  type: string;
  prompt: string;
  projectPath: string;
  agentType: string;
  priority: string;
  status: string;
  timeout: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  exitCode?: number;
  output?: string;
  error?: string;
}

interface TaskOutputRecord {
  taskId: string;
  line: string;
  timestamp: number;
  source: 'stdout' | 'stderr';
}

interface TaskLogRecord {
  id: string;
  taskId: string;
  level: string;
  message: string;
  metadata?: string;
  timestamp: number;
}

interface AuditLogRecord {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  timestamp: number;
}

interface CheckpointRecord {
  id: string;
  type: string;
  data: string;
  timestamp: number;
}

interface Stats {
  tasks: {
    total: number;
    byStatus: Record<string, number>;
  };
  outputs: number;
  logs: number;
  auditLogs: number;
}

class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || join(getDataDir(), 'bridge.db');
  }

  initialize(): void {
    const dir = this.dbPath.substring(0, this.dbPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');

    this.createTables();
    this.createIndexes();

    logger.info('Database initialized', { path: this.dbPath });
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        projectPath TEXT NOT NULL,
        agentType TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        timeout INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        startedAt INTEGER,
        completedAt INTEGER,
        exitCode INTEGER,
        output TEXT,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS task_outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId TEXT NOT NULL,
        line TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        source TEXT NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_logs (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entityId TEXT,
        userId TEXT,
        ipAddress TEXT,
        userAgent TEXT,
        details TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  private createIndexes(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority, createdAt);
      CREATE INDEX IF NOT EXISTS idx_tasks_agentType ON tasks(agentType);
      CREATE INDEX IF NOT EXISTS idx_task_outputs_taskId ON task_outputs(taskId);
      CREATE INDEX IF NOT EXISTS idx_task_outputs_timestamp ON task_outputs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_task_logs_taskId ON task_logs(taskId);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_type ON checkpoints(type);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_timestamp ON checkpoints(timestamp);
    `);
  }

  private prepare(sql: string): Database.Statement {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare(sql);
  }

  private prepareAll(sql: string): Database.Statement {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare(sql);
  }

  createTask(task: Omit<TaskRecord, 'createdAt'>): TaskRecord {
    const record: TaskRecord = {
      ...task,
      createdAt: Date.now(),
    };

    const stmt = this.prepare(`
      INSERT INTO tasks (id, type, prompt, projectPath, agentType, priority, status, timeout, createdAt)
      VALUES (@id, @type, @prompt, @projectPath, @agentType, @priority, @status, @timeout, @createdAt)
    `);

    stmt.run(record);
    logger.debug('Task created', { taskId: task.id });
    return record;
  }

  getTask(id: string): TaskRecord | undefined {
    const stmt = this.prepare('SELECT * FROM tasks WHERE id = @id');
    return stmt.get({ id }) as TaskRecord | undefined;
  }

  updateTaskStatus(id: string, status: string): void {
    const stmt = this.prepare('UPDATE tasks SET status = @status WHERE id = @id');
    stmt.run({ ['status']: status, ['id']: id });
    logger.debug('Task status updated', { taskId: id, status });
  }

  updateTaskStarted(id: string): void {
    const stmt = this.prepare('UPDATE tasks SET status = @status, startedAt = @startedAt WHERE id = @id');
    stmt.run({ ['status']: 'running', ['startedAt']: Date.now(), ['id']: id });
  }

  updateTaskCompleted(id: string, result: Pick<TaskRecord, 'exitCode' | 'output' | 'error'>): void {
    const stmt = this.prepare(`
      UPDATE tasks
      SET status = @status, completedAt = @completedAt, exitCode = @exitCode, output = @output, error = @error
      WHERE id = @id
    `);

    stmt.run({
      ['status']: result.exitCode === 0 ? 'completed' : 'failed',
      ['completedAt']: Date.now(),
      ...result,
      ['id']: id,
    });
    logger.debug('Task completed', { taskId: id, exitCode: result.exitCode });
  }

  listTasks(options: { status?: string; limit?: number; offset?: number } = {}): TaskRecord[] {
    let sql = 'SELECT * FROM tasks';
    const params: Record<string, unknown> = {};

    if (options['status']) {
      sql += ' WHERE status = @status';
      params['status'] = options['status'];
    }

    sql += ' ORDER BY createdAt DESC';

    if (options.limit) {
      sql += ' LIMIT @limit';
      params['limit'] = options.limit;
    }

    if (options.offset) {
      sql += ' OFFSET @offset';
      params['offset'] = options.offset;
    }

    const stmt = this.prepareAll(sql);
    return stmt.all(params) as TaskRecord[];
  }

  deleteTask(id: string): boolean {
    const stmt = this.prepare('DELETE FROM tasks WHERE id = @id');
    const result = stmt.run({ ['id']: id });
    const changes = result.changes as number | undefined;
    logger.debug('Task deleted', { taskId: id, changes });
    return (changes ?? 0) > 0;
  }

  addTaskOutput(taskId: string, line: string, source: 'stdout' | 'stderr'): void {
    const stmt = this.prepare(`
      INSERT INTO task_outputs (taskId, line, timestamp, source)
      VALUES (@taskId, @line, @timestamp, @source)
    `);

    stmt.run({ ['taskId']: taskId, line, ['timestamp']: Date.now(), source });
  }

  getTaskOutputs(taskId: string, limit = 1000): TaskOutputRecord[] {
    const stmt = this.prepareAll(`
      SELECT * FROM task_outputs
      WHERE taskId = @taskId
      ORDER BY timestamp ASC
      LIMIT @limit
    `);

    return stmt.all({ ['taskId']: taskId, limit }) as TaskOutputRecord[];
  }

  addTaskLog(log: Omit<TaskLogRecord, 'timestamp'>): void {
    const record: TaskLogRecord = { ...log, timestamp: Date.now() };
    const stmt = this.prepare(`
      INSERT INTO task_logs (id, taskId, level, message, metadata, timestamp)
      VALUES (@id, @taskId, @level, @message, @metadata, @timestamp)
    `);

    stmt.run(record);
  }

  getTaskLogs(taskId: string): TaskLogRecord[] {
    const stmt = this.prepareAll(`
      SELECT * FROM task_logs WHERE taskId = @taskId ORDER BY timestamp ASC
    `);

    return stmt.all({ ['taskId']: taskId }) as TaskLogRecord[];
  }

  addAuditLog(log: Omit<AuditLogRecord, 'timestamp'>): void {
    const record: AuditLogRecord = { ...log, timestamp: Date.now() };
    const stmt = this.prepare(`
      INSERT INTO audit_logs (id, action, entity, entityId, userId, ipAddress, userAgent, details, timestamp)
      VALUES (@id, @action, @entity, @entityId, @userId, @ipAddress, @userAgent, @details, @timestamp)
    `);

    stmt.run(record);
  }

  getAuditLogs(options: { action?: string; limit?: number } = {}): AuditLogRecord[] {
    let sql = 'SELECT * FROM audit_logs';
    const params: Record<string, unknown> = {};

    if (options.action) {
      sql += ' WHERE action = @action';
      params['action'] = options.action;
    }

    sql += ' ORDER BY timestamp DESC';

    if (options.limit) {
      sql += ' LIMIT @limit';
      params['limit'] = options.limit;
    }

    const stmt = this.prepareAll(sql);
    return stmt.all(params) as AuditLogRecord[];
  }

  saveCheckpoint(type: string, data: string): void {
    const id = `cp-${type}-${Date.now()}`;
    const stmt = this.prepare('INSERT INTO checkpoints (id, type, data, timestamp) VALUES (@id, @type, @data, @timestamp)');
    stmt.run({ id, type, data, ['timestamp']: Date.now() });
    logger.debug('Checkpoint saved', { type, id });
  }

  getLatestCheckpoint(type: string): CheckpointRecord | undefined {
    const stmt = this.prepareAll(`
      SELECT * FROM checkpoints WHERE type = @type ORDER BY timestamp DESC LIMIT 1
    `);

    const results = stmt.all({ ['type']: type }) as CheckpointRecord[];
    return results.length > 0 ? results[0] : undefined;
  }

  deleteCheckpoints(type: string, maxAge: number): number {
    const stmt = this.prepare('DELETE FROM checkpoints WHERE type = @type AND timestamp < @maxAge');
    const result = stmt.run({ ['type']: type, ['maxAge']: Date.now() - maxAge });
    const changes = result.changes as number | undefined;
    logger.debug('Checkpoints deleted', { type, count: changes });
    return changes ?? 0;
  }

  getStats(): Stats {
    const tasksStmt = this.prepare(`
      SELECT status, COUNT(*) as count FROM tasks GROUP BY status
    `);

    const byStatus = Object.fromEntries(
      tasksStmt.all().map((row: unknown) => {
        const r = row as { status: string; count: number };
        return [r.status, r.count];
      })
    );

    const totalStmt = this.prepare('SELECT COUNT(*) as count FROM tasks');
    const total = (totalStmt.get() as { count: number } | undefined)?.count ?? 0;

    const outputsStmt = this.prepare('SELECT COUNT(*) as count FROM task_outputs');
    const outputs = (outputsStmt.get() as { count: number } | undefined)?.count ?? 0;

    const logsStmt = this.prepare('SELECT COUNT(*) as count FROM task_logs');
    const logs = (logsStmt.get() as { count: number } | undefined)?.count ?? 0;

    const auditStmt = this.prepare('SELECT COUNT(*) as count FROM audit_logs');
    const auditLogs = (auditStmt.get() as { count: number } | undefined)?.count ?? 0;

    return {
      tasks: { total, byStatus },
      outputs,
      logs,
      auditLogs,
    };
  }

  close(): void {
    this.db?.close();
    this.db = null;
    logger.info('Database closed');
  }

  getPath(): string {
    return this.dbPath;
  }
}

let dbManager: DatabaseManager | null = null;

export function getDatabase(dbPath?: string): DatabaseManager {
  if (!dbManager) {
    dbManager = new DatabaseManager(dbPath);
  }
  return dbManager;
}

export function closeDatabase(): void {
  dbManager?.close();
  dbManager = null;
}

export type { TaskRecord, TaskOutputRecord, TaskLogRecord, AuditLogRecord, CheckpointRecord };
export { DatabaseManager };
