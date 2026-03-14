import type { DatabaseManager } from './database.js';
import { getLogger } from './utils/logger.js';
import { isTerminating } from './utils/graceful-shutdown.js';

const logger = getLogger('checkpoint');

interface CheckpointData extends Record<string, unknown> {
  bridge: {
    id: string;
    status: string;
    connectedAt?: number;
  };
  tasks: {
    queued: string[];
    running: Record<string, { id: string; startedAt: number }>;
  };
  timestamp: number;
}

class CheckpointManager {
  private db: DatabaseManager;
  private interval: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private maxAge: number;

  constructor(db: DatabaseManager, intervalMs = 60000, maxAge = 86400000) {
    this.db = db;
    this.intervalMs = intervalMs;
    this.maxAge = maxAge;
  }

  start(): void {
    if (this.interval) {
      logger.warn('Checkpoint already running');
      return;
    }

    logger.info('Starting checkpoint manager', { interval: this.intervalMs });
    this.save('startup', { timestamp: Date.now(), event: 'startup' });

    this.interval = setInterval(() => {
      this.autoSave();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Checkpoint manager stopped');
    }
  }

  async save(type: string, data: Record<string, unknown>): Promise<void> {
    try {
      const dataStr = JSON.stringify(data);
      this.db.saveCheckpoint(type, dataStr);
      logger.debug('Checkpoint saved', { type });
    } catch (error) {
      logger.error('Failed to save checkpoint', { type, error });
    }
  }

  load(type: string): unknown | null {
    try {
      const record = this.db.getLatestCheckpoint(type);
      if (!record) {
        return null;
      }

      return JSON.parse(record.data);
    } catch (error) {
      logger.error('Failed to load checkpoint', { type, error });
      return null;
    }
  }

  private async autoSave(): Promise<void> {
    if (isTerminating()) {
      this.stop();
      return;
    }

    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    try {
      const deleted = this.db.deleteCheckpoints('auto', this.maxAge);
      if (deleted > 0) {
        logger.debug('Old checkpoints cleaned up', { count: deleted });
      }
    } catch (error) {
      logger.error('Failed to cleanup checkpoints', { error });
    }
  }

  async createSnapshot(data: CheckpointData): Promise<void> {
    await this.save('snapshot', data);
  }

  restoreSnapshot(): CheckpointData | null {
    const data = this.load('snapshot');
    if (!data || typeof data !== 'object') {
      return null;
    }

    return data as CheckpointData;
  }

  setIntervalMs(ms: number): void {
    this.intervalMs = ms;
    if (this.interval) {
      this.stop();
      this.start();
    }
  }
}

export { CheckpointManager };
export type { CheckpointData };
