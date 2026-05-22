import { describe, it, expect } from 'vitest';
import {
  checkWinner,
  isGameComplete,
  getRankings,
  checkAllCrowned,
  getLeadingPlayer,
} from '../win-condition';
import type { EngineState, EngineToken } from '../engine-types';
import type { BoardPosition, PlayerColor } from '@parchis/shared';
import { CIELO_START } from '../board';

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
      { id: 'p1', color: 'RED', name: 'P1', isHost: true, isConnected: true },
      { id: 'p2', color: 'BLUE', name: 'P2', isHost: false, isConnected: true },
      { id: 'p3', color: 'GREEN', name: 'P3', isHost: false, isConnected: true },
      { id: 'p4', color: 'YELLOW', name: 'P4', isHost: false, isConnected: true },
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

describe('Win Condition — checkWinner', () => {
  it('should crown winner when all 4 tokens crowned', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t) => ({ ...t, state: 'CROWNED' as const, position: 75 as BoardPosition })),
        ...makeFullSet('BLUE', 4),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    expect(checkWinner(state)).toBe('RED');
  });

  it('should return null when no one has crowned all tokens', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t, i) =>
          i < 2
            ? { ...t, state: 'CROWNED' as const, position: 75 as BoardPosition }
            : { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 },
        ),
        ...makeFullSet('BLUE', 4).map((t, i) =>
          i < 3
            ? { ...t, state: 'CROWNED' as const, position: 75 as BoardPosition }
            : { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 },
        ),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    expect(checkWinner(state)).toBeNull();
  });

  it('should detect winner among multiple players', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t) => ({ ...t, state: 'CROWNED' as const, position: 75 as BoardPosition })),
        ...makeFullSet('BLUE', 4).map((t) => ({ ...t, state: 'CROWNED' as const, position: 75 as BoardPosition })),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    expect(checkWinner(state)).toBe('RED');
  });
});

describe('Win Condition — isGameComplete', () => {
  it('should return true when winner exists', () => {
    const state = makeState({ winner: 'RED' });
    expect(isGameComplete(state)).toBe(true);
  });

  it('should return true when phase is FINISHED', () => {
    const state = makeState({ phase: 'FINISHED' });
    expect(isGameComplete(state)).toBe(true);
  });

  it('should return false for active game', () => {
    const state = makeState();
    expect(isGameComplete(state)).toBe(false);
  });
});

describe('Win Condition — getRankings', () => {
  it('should sort by crowned tokens first', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t, i) => {
          if (i < 3) return { ...t, state: 'CROWNED' as const, position: 75 as BoardPosition };
          return { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 };
        }),
        ...makeFullSet('BLUE', 4).map((t, i) => {
          if (i < 2) return { ...t, state: 'CROWNED' as const, position: 75 as BoardPosition };
          return { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 };
        }),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    const rankings = getRankings(state);
    expect(rankings[0].color).toBe('RED');
    expect(rankings[0].tokensCrowned).toBe(3);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[1].color).toBe('BLUE');
    expect(rankings[1].rank).toBe(2);
  });

  it('should use cielo progress as tiebreaker', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t, i) => {
          if (i < 3) return { ...t, state: 'CROWNED' as const, position: 75 as BoardPosition };
          return { ...t, position: CIELO_START.RED as BoardPosition, state: 'IN_SKY' as const, totalSteps: 85 };
        }),
        ...makeFullSet('BLUE', 4).map((t, i) => {
          if (i < 3) return { ...t, state: 'CROWNED' as const, position: 83 as BoardPosition };
          return { ...t, position: (CIELO_START.BLUE + 2) as BoardPosition, state: 'IN_SKY' as const, totalSteps: 87 };
        }),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    const rankings = getRankings(state);
    expect(rankings[0].color).toBe('BLUE');
    expect(rankings[0].cieloProgress).toBe(3);
    expect(rankings[1].color).toBe('RED');
    expect(rankings[1].cieloProgress).toBe(1);
  });

  it('should handle all players with no crowned tokens', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t, i) => {
          if (i === 0) return { ...t, position: 30 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 30 };
          if (i === 1) return { ...t, position: 20 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 20 };
          return t;
        }),
        ...makeFullSet('BLUE', 4).map((t, i) => {
          if (i === 0) return { ...t, position: 50 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 50 };
          if (i === 1) return { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 };
          return t;
        }),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    const rankings = getRankings(state);
    expect(rankings[0].color).toBe('BLUE');
    expect(rankings[1].color).toBe('RED');
  });
});

describe('Win Condition — checkAllCrowned', () => {
  it('should return true when all 4 of color are crowned', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t) => ({ ...t, state: 'CROWNED' as const, position: 75 as BoardPosition })),
        ...makeFullSet('BLUE', 4),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    expect(checkAllCrowned(state, 'RED')).toBe(true);
  });

  it('should return false when not all crowned', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t, i) => {
          if (i === 0) return { ...t, state: 'CROWNED' as const, position: 75 as BoardPosition };
          return t;
        }),
        ...makeFullSet('BLUE', 4),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    expect(checkAllCrowned(state, 'RED')).toBe(false);
  });

  it('should return false when player has no tokens', () => {
    const state = makeState({ tokens: [] });
    expect(checkAllCrowned(state, 'RED')).toBe(false);
  });
});

describe('Win Condition — getLeadingPlayer', () => {
  it('should return leading player with 4 crowned', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t) => ({ ...t, state: 'CROWNED' as const, position: 75 as BoardPosition })),
        ...makeFullSet('BLUE', 4).map((t, i) =>
          i < 2
            ? { ...t, state: 'CROWNED' as const, position: 75 as BoardPosition }
            : { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 },
        ),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    const leader = getLeadingPlayer(state);
    expect(leader).toBe('RED');
  });

  it('should return null when no one has 4 crowned', () => {
    const state = makeState({
      tokens: [
        ...makeFullSet('RED', 0).map((t, i) =>
          i < 3
            ? { ...t, state: 'CROWNED' as const, position: 75 as BoardPosition }
            : { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 },
        ),
        ...makeFullSet('BLUE', 4),
        ...makeFullSet('GREEN', 8),
        ...makeFullSet('YELLOW', 12),
      ],
    });
    const leader = getLeadingPlayer(state);
    expect(leader).toBeNull();
  });
});
