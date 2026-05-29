import { describe, it, expect, vi } from 'vitest';
import { calculateBackoff, isRetryableError, withRetry, buildGameChannelName, calculatePlayerRankings, getJailedTokens, type PlayerRanking } from './game-utils';
import type { EngineState, EngineToken } from '@parchis/engine';
import type { PlayerColor, BoardPosition } from '@parchis/shared';

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

// ---------- calculatePlayerRankings ----------

function makeToken(
  id: string,
  color: PlayerColor,
  position: BoardPosition,
  state: 'JAIL' | 'IN_TRANSIT' | 'IN_SKY' | 'CROWNED',
  totalSteps = 0,
  index = 0,
): EngineToken {
  return { id, color, index, position, state, totalSteps };
}

function makeFullSet(color: PlayerColor, baseIndex: number): EngineToken[] {
  return [
    makeToken(`${color[0].toLowerCase()}1`, color, -1, 'JAIL', 0, baseIndex),
    makeToken(`${color[0].toLowerCase()}2`, color, -1, 'JAIL', 0, baseIndex + 1),
    makeToken(`${color[0].toLowerCase()}3`, color, -1, 'JAIL', 0, baseIndex + 2),
    makeToken(`${color[0].toLowerCase()}4`, color, -1, 'JAIL', 0, baseIndex + 3),
  ];
}

function makeState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    id: 'test-game',
    roomId: 'test-room',
    phase: 'PLAYING',
    players: [
      { id: 'p1', color: 'RED', name: 'Alice', isHost: true, isConnected: true },
      { id: 'p2', color: 'BLUE', name: 'Bob', isHost: false, isConnected: true },
      { id: 'p3', color: 'GREEN', name: 'Charlie', isHost: false, isConnected: true },
      { id: 'p4', color: 'YELLOW', name: 'Diana', isHost: false, isConnected: true },
    ],
    tokens: [],
    currentPlayerIndex: 0,
    turnOrder: ['RED', 'BLUE', 'GREEN', 'YELLOW'],
    turnPhase: 'ROLL',
    round: 1,
    currentRoll: null,
    consecutivePairs: 0,
    extraTurnsRemaining: 0,
    isLastTokenMode: false,
    missedCaptures: [],
    rollAttempts: 0,
    actions: [],
    winner: null,
    houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'ALL' },
    ...overrides,
  };
}

describe('calculatePlayerRankings', () => {
  it('should return winner as position 1 when state.winner is set', () => {
    const state = makeState({
      winner: 'BLUE',
      phase: 'FINISHED',
      tokens: [
        ...makeFullSet('RED', 0),
        ...makeFullSet('BLUE', 4).map((t) => ({ ...t, state: 'CROWNED' as const, position: 83 as BoardPosition })),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });

    const rankings = calculatePlayerRankings(state);

    expect(rankings[0].color).toBe('BLUE');
    expect(rankings[0].position).toBe(1);
    expect(rankings[0].name).toBe('Bob');
    expect(rankings[0].crownedCount).toBe(4);
  });

  it('should include all players, even with 0 crowned tokens', () => {
    const state = makeState({
      winner: 'RED',
      phase: 'FINISHED',
      tokens: [
        ...makeFullSet('RED', 0).map((t) => ({ ...t, state: 'CROWNED' as const, position: 75 as BoardPosition })),
        ...makeFullSet('BLUE', 4),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });

    const rankings = calculatePlayerRankings(state);

    expect(rankings.length).toBe(4);
    expect(rankings.map((r) => r.color)).toContain('BLUE');
    expect(rankings.map((r) => r.color)).toContain('GREEN');
    expect(rankings.map((r) => r.color)).toContain('YELLOW');
  });

  it('should preserve isConnected flag from player data', () => {
    const state = makeState({
      winner: 'RED',
      phase: 'FINISHED',
      players: [
        { id: 'p1', color: 'RED', name: 'Alice', isHost: true, isConnected: true },
        { id: 'p2', color: 'BLUE', name: 'Bob', isHost: false, isConnected: false },
        { id: 'p3', color: 'GREEN', name: 'Charlie', isHost: false, isConnected: true },
        { id: 'p4', color: 'YELLOW', name: 'Diana', isHost: false, isConnected: false },
      ],
      tokens: [
        ...makeFullSet('RED', 0).map((t) => ({ ...t, state: 'CROWNED' as const, position: 75 as BoardPosition })),
        ...makeFullSet('BLUE', 4),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });

    const rankings = calculatePlayerRankings(state);
    const blueRanking = rankings.find((r) => r.color === 'BLUE');
    const yellowRanking = rankings.find((r) => r.color === 'YELLOW');

    expect(blueRanking?.isConnected).toBe(false);
    expect(yellowRanking?.isConnected).toBe(false);
    expect(rankings.find((r) => r.color === 'RED')?.isConnected).toBe(true);
  });

  it('should order non-winners by crowned count descending', () => {
    // RED wins (4 crowned), then GREEN (2), then BLUE (1), then YELLOW (0)
    const state = makeState({
      winner: 'RED',
      phase: 'FINISHED',
      tokens: [
        // RED: winner - all 4 crowned
        ...makeFullSet('RED', 0).map((t) => ({ ...t, state: 'CROWNED' as const, position: 75 as BoardPosition })),
        // BLUE: 1 crowned
        ...makeFullSet('BLUE', 4).map((t, i) =>
          i === 0 ? { ...t, state: 'CROWNED' as const, position: 83 as BoardPosition } : t,
        ),
        // GREEN: 2 crowned
        ...makeFullSet('GREEN', 8).map((t, i) =>
          i < 2 ? { ...t, state: 'CROWNED' as const, position: 91 as BoardPosition } : t,
        ),
        // YELLOW: 0
        ...makeFullSet('YELLOW', 12),
      ],
    });

    const rankings = calculatePlayerRankings(state);

    expect(rankings[0].color).toBe('RED');
    expect(rankings[1].color).toBe('GREEN');
    expect(rankings[1].crownedCount).toBe(2);
    expect(rankings[2].color).toBe('BLUE');
    expect(rankings[2].crownedCount).toBe(1);
    expect(rankings[3].color).toBe('YELLOW');
    expect(rankings[3].crownedCount).toBe(0);
  });

  it('should calculate totalSteps as sum of all tokens totalSteps', () => {
    const state = makeState({
      winner: 'RED',
      phase: 'FINISHED',
      tokens: [
        ...makeFullSet('RED', 0).map((t) => ({ ...t, state: 'CROWNED' as const, position: 75 as BoardPosition, totalSteps: 100 })),
        // BLUE has tokens with different totalSteps
        ...makeFullSet('BLUE', 4).map((t, i) => ({
          ...t,
          position: (i * 10) as BoardPosition,
          state: i === 0 ? 'CROWNED' as const : 'IN_TRANSIT' as const,
          totalSteps: (i + 1) * 10,
        })),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });

    const rankings = calculatePlayerRankings(state);
    const blue = rankings.find((r) => r.color === 'BLUE');

    // BLUE tokens have totalSteps: 10, 20, 30, 40 = 100
    expect(blue?.totalSteps).toBe(10 + 20 + 30 + 40);
  });
});

// ---------- getJailedTokens ----------

describe('getJailedTokens', () => {
  it('should return empty array when no tokens are in jail', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 10, 'IN_TRANSIT', 5),
      makeToken('b1', 'BLUE', 20, 'CROWNED', 100),
    ];
    expect(getJailedTokens(tokens, 'RED')).toEqual([]);
    expect(getJailedTokens(tokens, 'BLUE')).toEqual([]);
  });

  it('should return only tokens matching the requested color in JAIL state', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 0, 'JAIL', 0, 0),
      makeToken('r2', 'RED', -1, 'JAIL', 0, 1),
      makeToken('b1', 'BLUE', 10, 'IN_TRANSIT', 50),
      makeToken('r3', 'RED', 15, 'IN_TRANSIT', 30),
      makeToken('b2', 'BLUE', -1, 'JAIL', 0, 2),
    ];
    const redJailed = getJailedTokens(tokens, 'RED');
    expect(redJailed).toHaveLength(2);
    expect(redJailed.map(t => t.id)).toEqual(['r1', 'r2']);

    const blueJailed = getJailedTokens(tokens, 'BLUE');
    expect(blueJailed).toHaveLength(1);
    expect(blueJailed[0].id).toBe('b2');
  });

  it('should return empty array for color with no tokens at all', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', -1, 'JAIL'),
    ];
    expect(getJailedTokens(tokens, 'GREEN')).toEqual([]);
    expect(getJailedTokens(tokens, 'YELLOW')).toEqual([]);
  });

  it('should filter by color correctly when multiple colors have jailed tokens', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', -1, 'JAIL', 0, 0),
      makeToken('r2', 'RED', -1, 'JAIL', 0, 1),
      makeToken('b1', 'BLUE', -1, 'JAIL', 0, 0),
      makeToken('b2', 'BLUE', -1, 'JAIL', 0, 1),
      makeToken('b3', 'BLUE', -1, 'JAIL', 0, 2),
      makeToken('b4', 'BLUE', 5, 'IN_TRANSIT', 20),
    ];
    expect(getJailedTokens(tokens, 'RED')).toHaveLength(2);
    expect(getJailedTokens(tokens, 'BLUE')).toHaveLength(3);
    expect(getJailedTokens(tokens, 'GREEN')).toHaveLength(0);
  });
});
