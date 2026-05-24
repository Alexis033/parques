import { describe, it, expect, vi } from 'vitest';
import { calculateBackoff, isRetryableError, withRetry, buildGameChannelName } from './game-utils';

describe('calculateBackoff', () => {
  it('should return base delay for attempt 0', () => {
    expect(calculateBackoff(0, 100)).toBe(100);
  });

  it('should double each attempt', () => {
    expect(calculateBackoff(1, 100)).toBe(200);
    expect(calculateBackoff(2, 100)).toBe(400);
    expect(calculateBackoff(3, 100)).toBe(800);
    expect(calculateBackoff(4, 100)).toBe(1600);
  });

  it('should work with custom base delay', () => {
    expect(calculateBackoff(0, 500)).toBe(500);
    expect(calculateBackoff(2, 500)).toBe(2000);
    expect(calculateBackoff(3, 500)).toBe(4000);
  });
});

describe('isRetryableError', () => {
  it('should return true for Error with Conflict message', () => {
    expect(isRetryableError(new Error('Conflict: stale version, retry'))).toBe(true);
  });

  it('should return true for Error with 409 in message', () => {
    expect(isRetryableError(new Error('409 Conflict'))).toBe(true);
  });

  it('should return true for string with Conflict', () => {
    expect(isRetryableError('Conflict: something')).toBe(true);
  });

  it('should return false for non-retryable errors', () => {
    expect(isRetryableError(new Error('Not found'))).toBe(false);
    expect(isRetryableError('Some other error')).toBe(false);
  });

  it('should return false for unknown error types', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError(42)).toBe(false);
  });
});

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 409 conflict and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Conflict: stale version'))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { maxAttempts: 5, baseDelayMs: 5 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  }, 10000);

  it('should retry up to max attempts then throw', async () => {
    const error = new Error('Conflict: stale version');
    const fn = vi.fn().mockRejectedValue(error);
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 5 })
    ).rejects.toThrow('Conflict: stale version');
    expect(fn).toHaveBeenCalledTimes(3);
  }, 10000);

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Not found'));
    await expect(withRetry(fn)).rejects.toThrow('Not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff delays between retries', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Conflict'))
      .mockRejectedValueOnce(new Error('Conflict'))
      .mockResolvedValueOnce('ok');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    
    const result = await withRetry(fn, { maxAttempts: 5, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    
    // Check the delay values passed to setTimeout
    const calls = setTimeoutSpy.mock.calls.filter(c => typeof c[1] === 'number');
    const delays = calls.map(c => c[1] as number);
    expect(delays).toContain(10);
    expect(delays).toContain(20);
    setTimeoutSpy.mockRestore();
  }, 10000);

  it('should reset on success (no cumulative state)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Conflict'))
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(new Error('Conflict'))
      .mockResolvedValueOnce('ok2');
    
    const result1 = await withRetry(fn, { maxAttempts: 5, baseDelayMs: 5 });
    expect(result1).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);

    const result2 = await withRetry(fn, { maxAttempts: 5, baseDelayMs: 5 });
    expect(result2).toBe('ok2');
    expect(fn).toHaveBeenCalledTimes(4);
  }, 10000);
});

describe('buildGameChannelName', () => {
  it('should format channel name correctly', () => {
    expect(buildGameChannelName('room-123')).toBe('game:room-123');
  });

  it('should handle roomId with special characters', () => {
    expect(buildGameChannelName('abc-123_def')).toBe('game:abc-123_def');
  });
});
