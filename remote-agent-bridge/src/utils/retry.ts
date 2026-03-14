import { getLogger } from './logger.js';

const logger = getLogger('retry');

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 60000,
    jitter = 1000,
    onRetry,
  } = options;

  let lastError: unknown;
  let currentDelay = baseDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed`, { error });

      if (attempt < maxRetries) {
        const jitterValue = Math.random() * jitter;
        const delay = Math.min(currentDelay + jitterValue, maxDelay);

        logger.debug(`Waiting ${Math.round(delay)}ms before retry`);
        await sleep(delay);

        currentDelay = Math.min(currentDelay * 2, maxDelay);
        onRetry?.(attempt + 1, error);
      }
    }
  }

  throw lastError;
}

export async function retryWithResult<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 60000,
    jitter = 1000,
    onRetry,
  } = options;

  let lastError: unknown;
  let currentDelay = baseDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn();
      return { success: true, data, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed`, { error });

      if (attempt < maxRetries) {
        const jitterValue = Math.random() * jitter;
        const delay = Math.min(currentDelay + jitterValue, maxDelay);

        logger.debug(`Waiting ${Math.round(delay)}ms before retry`);
        await sleep(delay);

        currentDelay = Math.min(currentDelay * 2, maxDelay);
        onRetry?.(attempt + 1, error);
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: maxRetries + 1,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ExponentialBackoff {
  private currentDelay: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly jitter: number;

  constructor(baseDelay = 1000, maxDelay = 60000, jitter = 1000) {
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.jitter = jitter;
    this.currentDelay = baseDelay;
  }

  next(): number {
    const jitterValue = Math.random() * this.jitter;
    const delay = Math.min(this.currentDelay + jitterValue, this.maxDelay);
    this.currentDelay = Math.min(this.currentDelay * 2, this.maxDelay);
    return delay;
  }

  reset(): void {
    this.currentDelay = this.baseDelay;
  }
}
