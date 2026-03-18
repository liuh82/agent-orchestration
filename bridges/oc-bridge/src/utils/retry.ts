/**
 * Exponential backoff with jitter for reconnection attempts.
 *
 * delay = min(base * 2^attempt + random(0, 1000), maxDelay)
 */
export interface RetryPolicy {
  baseDelay: number;   // initial delay in ms (1000)
  maxDelay: number;    // cap in ms (60000)
  maxAttempts: number; // give up after this many (20)
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseDelay: 1000,
  maxDelay: 60_000,
  maxAttempts: 20,
};

/** Compute delay for a given attempt number (0-indexed). */
export function getRetryDelay(policy: RetryPolicy, attempt: number): number {
  const exponential = policy.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponential + jitter, policy.maxDelay);
}

/** Format delay in seconds, e.g. "1.2s" or "34567ms". */
export function formatDelay(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}
