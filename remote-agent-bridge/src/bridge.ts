import type { BridgeConfig } from './config/types.js';
import type { BridgeStatus, TaskSubmit } from './protocol/types.js';
import { WSClient, type WSClientConfig } from './ws-client.js';
import { TaskQueue } from './task-queue.js';
import { TaskRunner } from './task-runner.js';
import { getDatabase, type DatabaseManager } from './database.js';
import { CheckpointManager } from './checkpoint.js';
import { registry } from './adapters/registry.js';
import { CLIAdapter } from './adapters/cli-adapter.js';
import { TaskSandbox } from './security/sandbox.js';
import { getAuditLogger } from './audit/logger.js';
import { getLogger } from './utils/logger.js';
import { OS, HOSTNAME, NODE_VERSION } from './platform/index.js';
import { ensureDirectories } from './platform/paths.js';
import { BRIDGE_VERSION } from './version.js';

const logger = getLogger('bridge');

export class Bridge {
  private config: BridgeConfig;
  private status: BridgeStatus = 'INITIALIZING';
  private wsClient: WSClient | null = null;
  private taskQueue: TaskQueue | null = null;
  private taskRunner: TaskRunner | null = null;
  private database: DatabaseManager | null = null;
  private checkpointManager: CheckpointManager | null = null;
  private sandbox: TaskSandbox | null = null;
  private auditLogger = getAuditLogger();
  private startTime: number = 0;

  constructor(config: BridgeConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing Bridge', { version: BRIDGE_VERSION, platform: OS, hostname: HOSTNAME });

      ensureDirectories();

      this.database = getDatabase(this.config.database.path || undefined);
      this.database.initialize();
      this.auditLogger.setDatabase(this.database);

      this.sandbox = new TaskSandbox(this.config.security.sandbox);

      this.setupAdapters();

      this.taskQueue = new TaskQueue(this.config.tasks.maxConcurrent);
      this.taskRunner = new TaskRunner(this.taskQueue, this.config.tasks.maxConcurrent);
      this.setupTaskListeners();

      this.checkpointManager = new CheckpointManager(
        this.database,
        this.config.checkpoint.interval,
        this.config.checkpoint.maxAge
      );

      if (this.config.checkpoint.enabled) {
        this.checkpointManager.start();
      }

      this.startTime = Date.now();
      this.status = 'INITIALIZING';

      logger.info('Bridge initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Bridge', { error });
      throw error;
    }
  }

  private setupAdapters(): void {
    if (this.config.adapters.cli.enabled) {
      const cliConfig = new Map(Object.entries(this.config.adapters.cli.agents) as [string, { enabled: boolean; path?: string }][]);
      registry.register(new CLIAdapter(cliConfig));
    }

    const available = registry.list();
    logger.info('Adapters registered', { count: available.length, types: available.map((a) => a.type) });
  }

  private setupTaskListeners(): void {
    if (!this.taskQueue) return;

    this.taskQueue.on('started', (taskId) => {
      logger.info('Task started', { taskId });
      this.wsClient?.sendTaskProgress(taskId, 'running');
      this.auditLogger.logTaskStart(taskId, 'cli');
    });

    this.taskQueue.on('completed', (result) => {
      logger.info('Task completed', { taskId: result.taskId, exitCode: result.exitCode });
      this.wsClient?.sendTaskComplete(result.taskId, {
        exitCode: result.exitCode,
        output: this.sandbox?.sanitizeOutput(result.output) || result.output,
        changedFiles: result.changedFiles,
        duration: result.duration,
      });
      this.auditLogger.logTaskComplete(result.taskId, result.exitCode, result.duration);
    });

    this.taskQueue.on('failed', (error) => {
      logger.error('Task failed', { taskId: error.taskId, error: error.error });
      this.wsClient?.sendTaskProgress(error.taskId, 'failed', undefined, undefined, error.error);
      this.auditLogger.logTaskFail(error.taskId, error.error);
    });

    this.taskQueue.on('cancelled', (taskId) => {
      logger.info('Task cancelled', { taskId });
      this.wsClient?.sendTaskProgress(taskId, 'cancelled');
      this.auditLogger.logTaskCancel(taskId, 'user_request');
    });
  }

  async start(): Promise<void> {
    try {
      this.status = 'CONNECTING';

      const wsConfig: WSClientConfig = {
        url: this.config.gateway.url,
        token: this.config.gateway.token,
        bridgeId: this.config.bridge.id || `bridge-${OS}-${HOSTNAME}-${Date.now()}`,
        hostname: this.config.bridge.hostname || HOSTNAME,
        osVersion: process.release?.name || 'unknown',
        nodeVersion: NODE_VERSION,
        bridgeVersion: BRIDGE_VERSION,
        heartbeatInterval: this.config.gateway.heartbeatInterval,
        reconnect: this.config.gateway.reconnect,
      };

      this.wsClient = new WSClient(wsConfig);

      this.setupWSListeners();

      this.wsClient.connect();

      logger.info('Bridge started');
    } catch (error) {
      logger.error('Failed to start Bridge', { error });
      this.status = 'TERMINATED';
      throw error;
    }
  }

  private setupWSListeners(): void {
    if (!this.wsClient) return;

    this.wsClient.on('connected', () => {
      logger.info('Connected to gateway');
    });

    this.wsClient.on('authenticated', (bridgeId) => {
      logger.info('Authenticated with gateway', { bridgeId });
      this.auditLogger.logAuth(bridgeId, true);
    });

    this.wsClient.on('registered', () => {
      this.status = 'READY';
      logger.info('Bridge registered and ready');
      this.auditLogger.logBridgeRegister(this.config.bridge.id, registry.list().map((a) => a.type));
    });

    this.wsClient.on('taskSubmit', (task) => {
      this.handleTaskSubmit(task);
    });

    this.wsClient.on('taskCancel', (task) => {
      this.handleTaskCancel(task);
    });

    this.wsClient.on('error', (error) => {
      logger.error('WebSocket error', { error });
    });

    this.wsClient.on('disconnected', (reason) => {
      logger.warn('Disconnected from gateway', { reason });
      this.auditLogger.logBridgeDisconnect(this.config.bridge.id, reason);
    });
  }

  private handleTaskSubmit(task: TaskSubmit): void {
    if (!this.sandbox) {
      logger.warn('Sandbox not available, rejecting task');
      return;
    }

    const validation = this.sandbox.validateRequest({
      prompt: task.prompt,
      cwd: task.projectPath,
      agentType: task.agentType,
      timeout: task.timeout,
    });

    if (!validation.allowed) {
      logger.warn('Task rejected by sandbox', { taskId: task.taskId, reason: validation.reason });
      this.wsClient?.sendTaskProgress(task.taskId, 'failed', undefined, undefined, `Rejected: ${validation.reason}`);
      this.auditLogger.logSecurityViolation('task_rejection', { taskId: task.taskId, reason: validation.reason });
      return;
    }

    this.auditLogger.logTaskSubmit(task.taskId, task.agentType, task.prompt);
    this.taskRunner?.submit(task);
  }

  /** Submit a task locally via HTTP API. Goes through sandbox validation then enqueues. */
  submitLocalTask(task: TaskSubmit): void {
    this.handleTaskSubmit(task);
  }

  private handleTaskCancel(task: { taskId: string; reason: string }): void {
    logger.info('Cancelling task', { taskId: task.taskId, reason: task.reason });
    this.taskRunner?.cancel(task.taskId);
  }

  async stop(): Promise<void> {
    try {
      this.status = 'SHUTTING_DOWN';
      logger.info('Stopping Bridge');

      if (this.wsClient) {
        this.wsClient.disconnect('shutdown');
      }

      if (this.taskRunner) {
        await this.taskRunner.shutdown();
      }

      if (this.checkpointManager) {
        this.checkpointManager.stop();
      }

      if (this.database) {
        this.database.close();
      }

      await registry.disposeAll();

      this.status = 'TERMINATED';
      logger.info('Bridge stopped');
    } catch (error) {
      logger.error('Error stopping Bridge', { error });
    }
  }

  getStatus(): {
    status: BridgeStatus;
    uptime: number;
    wsStatus: string;
    queueStatus: { queued: number; running: number; maxConcurrent: number };
  } {
    const queueStatus = this.taskRunner?.getStatus() || { queued: 0, running: 0, maxConcurrent: 0 };
    const wsStatus = this.wsClient?.getStatus() || 'TERMINATED';

    return {
      status: this.status,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      wsStatus,
      queueStatus,
    };
  }

  updateConfig(partialConfig: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...partialConfig };
    logger.info('Config updated');

    if (this.sandbox && partialConfig.security?.sandbox) {
      this.sandbox.updateConfig(partialConfig.security.sandbox);
    }

    if (this.taskRunner && partialConfig.tasks?.maxConcurrent) {
      this.taskRunner.setMaxConcurrent(partialConfig.tasks.maxConcurrent);
    }
  }

  getConfig(): BridgeConfig {
    return this.config;
  }
}
