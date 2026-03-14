import { getLogger } from './logger.js';

const logger = getLogger('graceful-shutdown');

export interface ShutdownHandler {
  name: string;
  handler: (signal: NodeJS.Signals) => Promise<void>;
  timeout?: number;
}

class GracefulShutdownManager {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private pendingTasks = 0;

  register(handler: ShutdownHandler): void {
    this.handlers.push(handler);
  }

  unregister(name: string): void {
    this.handlers = this.handlers.filter((h) => h.name !== name);
  }

  incrementPendingTasks(): void {
    this.pendingTasks++;
  }

  decrementPendingTasks(): void {
    this.pendingTasks = Math.max(0, this.pendingTasks - 1);
  }

  async shutdown(signal: NodeJS.Signals, timeout = 30000): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Already shutting down, ignoring signal');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, initiating graceful shutdown`);

    const startTime = Date.now();

    try {
      if (this.pendingTasks > 0) {
        logger.info(`Waiting for ${this.pendingTasks} pending tasks to complete`);
        await this.waitForPendingTasks(timeout);
      }

      const shutdownPromises = this.handlers.map(async ({ name, handler, timeout: handlerTimeout }) => {
        const handlerStartTime = Date.now();
        try {
          await Promise.race([
            handler(signal),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error(`Handler ${name} timed out`)), handlerTimeout || timeout)
            ),
          ]);
          logger.info(`Handler ${name} completed in ${Date.now() - handlerStartTime}ms`);
        } catch (error) {
          logger.error(`Handler ${name} failed`, { error });
        }
      });

      await Promise.all(shutdownPromises);
      logger.info(`Graceful shutdown completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error });
    } finally {
      process.exit(0);
    }
  }

  private async waitForPendingTasks(timeout: number): Promise<void> {
    const startTime = Date.now();

    while (this.pendingTasks > 0 && Date.now() - startTime < timeout) {
      await sleep(100);
    }

    if (this.pendingTasks > 0) {
      logger.warn(`Timeout waiting for pending tasks, ${this.pendingTasks} remaining`);
    }
  }

  isTerminating(): boolean {
    return this.isShuttingDown;
  }
}

const shutdownManager = new GracefulShutdownManager();

export function registerShutdownHandler(handler: ShutdownHandler): void {
  shutdownManager.register(handler);
}

export function unregisterShutdownHandler(name: string): void {
  shutdownManager.unregister(name);
}

export function incrementPendingTasks(): void {
  shutdownManager.incrementPendingTasks();
}

export function decrementPendingTasks(): void {
  shutdownManager.decrementPendingTasks();
}

export function isTerminating(): boolean {
  return shutdownManager.isTerminating();
}

export function setupGracefulShutdown(timeout = 30000): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, () => {
      shutdownManager.shutdown(signal, timeout);
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    shutdownManager.shutdown('SIGTERM', timeout);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    shutdownManager.shutdown('SIGTERM', timeout);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { shutdownManager };
