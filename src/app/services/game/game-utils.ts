// Pure utility functions for game service logic.
// Kept separate for testability — zero dependencies.

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
}

const DEFAULT_RETRY: RetryConfig = { maxAttempts: 5, baseDelayMs: 100 };

/**
 * Calculate exponential backoff delay for a given attempt (0-indexed).
 * Returns: baseDelayMs * 2^attempt (capped at reasonable max).
 */
export function calculateBackoff(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * Math.pow(2, attempt);
}

/**
 * Check if an error indicates a retryable 409 Conflict.
 */
export function isRetryableError(error: unknown): boolean {
  if (typeof error === 'string') return error.includes('Conflict') || error.includes('409');
  if (error instanceof Error) return error.message.includes('Conflict') || error.message.includes('409');
  return false;
}

/**
 * Wrap an async call with automatic retry on 409 Conflict.
 * Uses exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) throw err;
      if (attempt < config.maxAttempts - 1) {
        const delay = calculateBackoff(attempt, config.baseDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Build a Realtime channel name for a game room.
 * Format: game:{roomId}
 */
export function buildGameChannelName(roomId: string): string {
  return `game:${roomId}`;
}
