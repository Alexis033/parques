// Pure utility functions for game service logic.
// Kept separate for testability — zero dependencies.

import type { EngineState, PlayerProgress } from '@parchis/engine';
import type { PlayerColor } from '@parchis/shared';

export interface PlayerRanking {
  color: PlayerColor;
  name: string;
  position: number; // 1st, 2nd, 3rd, 4th
  crownedCount: number;
  totalSteps: number; // sum of all tokens' totalSteps
  isConnected: boolean;
}

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

function getPlayerTokensTotalSteps(state: EngineState, color: PlayerColor): number {
  return state.tokens
    .filter((t) => t.color === color)
    .reduce((sum, t) => sum + t.totalSteps, 0);
}

function getPlayerCrownedCount(state: EngineState, color: PlayerColor): number {
  return state.tokens.filter((t) => t.color === color && t.state === 'CROWNED').length;
}

function getPlayerCieloProgress(state: EngineState, color: PlayerColor): number {
  // CIELO_START values: RED=68, BLUE=76, GREEN=84, YELLOW=92
  // CIELO_END values: RED=75, BLUE=83, GREEN=91, YELLOW=99
  // Progress = position - CIELO_START + 1 (if in cielo)
  const cieloStart: Record<PlayerColor, number> = {
    RED: 68, BLUE: 76, GREEN: 84, YELLOW: 92,
  };
  const cieloEnd: Record<PlayerColor, number> = {
    RED: 75, BLUE: 83, GREEN: 91, YELLOW: 99,
  };

  let maxProgress = 0;
  for (const t of state.tokens) {
    if (t.color === color && t.state === 'IN_SKY') {
      const progress = t.position - cieloStart[color] + 1;
      if (progress > maxProgress) maxProgress = progress;
    }
    // Crowned tokens are at max cielo progress
    if (t.color === color && t.state === 'CROWNED') {
      const maxPossible = cieloEnd[color] - cieloStart[color] + 1;
      if (maxPossible > maxProgress) maxProgress = maxPossible;
    }
  }
  return maxProgress;
}

/**
 * Calculate player rankings from final EngineState.
 *
 * Ranking rules:
 * 1. Winner (state.winner) is always position 1
 * 2. Remaining players sorted by:
 *    - crownedCount (descending)
 *    - totalSteps (descending) — tiebreaker
 *    - cieloProgress (descending) — final tiebreaker
 */
export function calculatePlayerRankings(state: EngineState): PlayerRanking[] {
  // Build player info map for quick lookup
  const playerInfo = new Map<PlayerColor, { name: string; isConnected: boolean }>();
  for (const p of state.players) {
    playerInfo.set(p.color, { name: p.name, isConnected: p.isConnected });
  }

  // Sort all players
  const sorted = [...state.turnOrder].sort((a, b) => {
    // Winner always comes first
    if (state.winner) {
      if (a === state.winner) return -1;
      if (b === state.winner) return 1;
    }

    // Primary: crowned count descending
    const crownedA = getPlayerCrownedCount(state, a);
    const crownedB = getPlayerCrownedCount(state, b);
    if (crownedA !== crownedB) return crownedB - crownedA;

    // Secondary: totalSteps descending
    const stepsA = getPlayerTokensTotalSteps(state, a);
    const stepsB = getPlayerTokensTotalSteps(state, b);
    if (stepsA !== stepsB) return stepsB - stepsA;

    // Tertiary: cielo progress descending
    const cieloA = getPlayerCieloProgress(state, a);
    const cieloB = getPlayerCieloProgress(state, b);
    return cieloB - cieloA;
  });

  // Map to PlayerRanking with positions
  return sorted.map((color, index) => {
    const info = playerInfo.get(color) ?? { name: color, isConnected: true };
    return {
      color,
      name: info.name,
      position: index + 1,
      crownedCount: getPlayerCrownedCount(state, color),
      totalSteps: getPlayerTokensTotalSteps(state, color),
      isConnected: info.isConnected,
    };
  });
}
