import { describe, it, expect } from 'vitest';
import {
  rollDice,
  exitToken,
  moveToken,
  splitMove,
  soplar,
  endTurn,
  canRoll,
  canSelectToken,
  canMove,
} from '../state-machine';
import type { EngineState, EngineToken } from '../engine-types';
import type { BoardPosition, PlayerColor, DiceRoll } from '@parchis/shared';
import { EXIT_POSITIONS, CIELO_END } from '../board';

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
  const defaultTokens = [
    ...makeFullSet('RED', 0),
    ...makeFullSet('BLUE', 4),
    ...makeFullSet('GREEN', 8),
    ...makeFullSet('YELLOW', 12),
  ];

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
    tokens: defaultTokens,
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

function roll(die1: number, die2: number, isParques = false): DiceRoll {
  return { die1, die2, isPair: die1 === die2, isParques, timestamp: Date.now() };
}

describe('State Machine — rollDice', () => {
  it('should transition to MOVE on non-pair roll with active tokens', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({ tokens });
    const next = rollDice(state, roll(3, 4));
    expect(next.currentRoll).not.toBeNull();
    expect(next.turnPhase).toBe('MOVE');
    expect(next.consecutivePairs).toBe(0);
  });

  it('should end turn when all in jail and no par', () => {
    const state = makeState();
    const next = rollDice(state, roll(2, 4));
    expect(next.turnPhase).toBe('TURN_END');
    expect(next.rollAttempts).toBe(1);
  });

  it('should allow multiple roll attempts when all in jail', () => {
    let state = makeState();
    state = rollDice(state, roll(2, 3)); // 1st attempt
    state = rollDice(state, roll(4, 5)); // 2nd attempt
    expect(state.rollAttempts).toBe(2);
    expect(state.turnPhase).toBe('TURN_END');
  });

  it('should transition to SELECT_TOKEN on par roll with jailed tokens', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({ tokens });
    const next = rollDice(state, roll(3, 3));
    expect(next.turnPhase).toBe('SELECT_TOKEN');
  });

  it('should auto-coronate most advanced on Parqués', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) => {
        if (i === 0) return { ...t, position: 30 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 30 };
        if (i === 1) return { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 };
        return t;
      }),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({ consecutivePairs: 2, tokens });
    const next = rollDice(state, roll(5, 5, true));
    expect(next.turnPhase).toBe('TURN_END');
    const crowned = next.tokens.find((t) => t.id === 'r1');
    expect(crowned?.state).toBe('CROWNED');
    expect(crowned?.position).toBe(CIELO_END.RED);
  });

  it('should increment consecutive pairs on pair roll', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({ consecutivePairs: 1, tokens });
    const next = rollDice(state, roll(4, 4));
    expect(next.consecutivePairs).toBe(2);
  });

  it('should reset consecutive pairs on non-pair roll', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({ consecutivePairs: 2, tokens });
    const next = rollDice(state, roll(1, 4));
    expect(next.consecutivePairs).toBe(0);
  });
});

describe('State Machine — exitToken', () => {
  it('should move token from jail to exit position', () => {
    const tokens = [
      ...makeFullSet('RED', 0),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'SELECT_TOKEN',
      currentRoll: { die1: 3, die2: 3, isPair: true, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = exitToken(state, 0);
    const exited = next.tokens.find((t) => t.color === 'RED' && t.index === 0);
    expect(exited?.state).toBe('IN_TRANSIT');
    expect(exited?.position).toBe(EXIT_POSITIONS.RED);
    expect(exited?.totalSteps).toBe(0);
  });

  it('should transition to MOVE after exit', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 3 ? { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'SELECT_TOKEN',
      currentRoll: { die1: 3, die2: 3, isPair: true, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = exitToken(state, 0);
    expect(next.turnPhase).toBe('MOVE');
  });

  it('should patear enemies on exit when rule enabled', () => {
    const tokens = [
      ...makeFullSet('RED', 0),
      ...makeFullSet('BLUE', 4).map((t, i) =>
        i === 0 ? { ...t, position: 0 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('GREEN', 8).map((t, i) =>
        i === 0 ? { ...t, position: 0 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 8 } : t,
      ),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'SELECT_TOKEN',
      currentRoll: { die1: 3, die2: 3, isPair: true, isParques: false, timestamp: 0 },
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: true, exitRule: 'ALL' },
      tokens,
    });
    const next = exitToken(state, 0);
    const blueAfter = next.tokens.find((t) => t.id === 'b1');
    const greenAfter = next.tokens.find((t) => t.id === 'g1');
    expect(blueAfter?.state).toBe('JAIL');
    expect(greenAfter?.state).toBe('JAIL');
  });
});

describe('State Machine — moveToken', () => {
  it('should advance token position on move', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = moveToken(state, 'r1', 7);
    const moved = next.tokens.find((t) => t.id === 'r1');
    expect(moved?.position).toBe(12);
    expect(moved?.totalSteps).toBe(12);
  });

  it('should capture opponent on non-safe square', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 3 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 3 } : t,
      ),
      ...makeFullSet('BLUE', 4).map((t, i) =>
        i === 0 ? { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 8 } : t,
      ),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = moveToken(state, 'r1', 7);
    const blueAfter = next.tokens.find((t) => t.id === 'b1');
    expect(blueAfter?.state).toBe('JAIL');
    expect(blueAfter?.position).toBe(-1);
  });

  it('should NOT capture on safe zone', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 0 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 0 } : t,
      ),
      ...makeFullSet('BLUE', 4).map((t, i) =>
        i === 0 ? { ...t, position: 3 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 3 } : t,
      ),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = moveToken(state, 'b1', 4);
    const redAfter = next.tokens.find((t) => t.id === 'r1');
    expect(redAfter?.state).toBe('IN_TRANSIT');
  });

  it('should crown token on reaching cielo end', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 73 as BoardPosition, state: 'IN_SKY' as const, totalSteps: 89 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 2, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = moveToken(state, 'r1', 2);
    const crowned = next.tokens.find((t) => t.id === 'r1');
    expect(crowned?.state).toBe('CROWNED');
    expect(crowned?.position).toBe(CIELO_END.RED);
  });

  it('should add missed capture on capture', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 3 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 3 } : t,
      ),
      ...makeFullSet('BLUE', 4).map((t, i) =>
        i === 0 ? { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 8 } : t,
      ),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = moveToken(state, 'r1', 7);
    expect(next.missedCaptures.length).toBeGreaterThan(0);
  });
});

describe('State Machine — soplar', () => {
  it('should send blown token back to jail', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens,
      missedCaptures: [
        { playerId: 'RED', tokenId: 'r1', capturedTokenId: 'b1', position: 15, turnNumber: 1 },
      ],
    });
    const next = soplar(state, 'r1');
    const blown = next.tokens.find((t) => t.id === 'r1');
    expect(blown?.state).toBe('JAIL');
    expect(blown?.position).toBe(-1);
  });

  it('should clear missed capture after soplar', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens,
      missedCaptures: [
        { playerId: 'RED', tokenId: 'r1', capturedTokenId: 'b1', position: 15, turnNumber: 1 },
      ],
    });
    const next = soplar(state, 'r1');
    expect(next.missedCaptures.length).toBe(0);
  });
});

describe('State Machine — endTurn', () => {
  it('should advance to next player', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'TURN_END',
      currentRoll: { die1: 2, die2: 5, isPair: false, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = endTurn(state);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.turnPhase).toBe('ROLL');
    expect(next.round).toBe(2);
  });

  it('should clear current roll', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'TURN_END',
      currentRoll: { die1: 3, die2: 3, isPair: true, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = endTurn(state);
    expect(next.currentRoll).toBeNull();
    expect(next.rollAttempts).toBe(0);
  });

  it('should detect winner and end game when a player has all crowned', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t) => ({ ...t, state: 'CROWNED' as const, position: CIELO_END.RED as BoardPosition })),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'TURN_END',
      currentPlayerIndex: 0,
      currentRoll: { die1: 2, die2: 3, isPair: false, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = endTurn(state);
    expect(next.winner).toBe('RED');
    expect(next.phase).toBe('FINISHED');
    expect(next.turnPhase).toBe('TURN_END');
  });
});

describe('State Machine — guard functions', () => {
  it('canRoll returns true when phase is ROLL', () => {
    const state = makeState({ turnPhase: 'ROLL' });
    expect(canRoll(state)).toBe(true);
  });

  it('canRoll returns false when phase is other', () => {
    const state = makeState({ turnPhase: 'MOVE' });
    expect(canRoll(state)).toBe(false);
  });

  it('canSelectToken returns true when phase is SELECT_TOKEN', () => {
    const state = makeState({ turnPhase: 'SELECT_TOKEN' });
    expect(canSelectToken(state)).toBe(true);
  });

  it('canMove returns true when phase is MOVE', () => {
    const state = makeState({ turnPhase: 'MOVE' });
    expect(canMove(state)).toBe(true);
  });
});

describe('State Machine — splitMove', () => {
  it('should handle split move with two tokens', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) => {
        if (i === 0) return { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 };
        if (i === 1) return { ...t, position: 10 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 10 };
        return t;
      }),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = splitMove(state, 'r1', 3, 'r2', 4);
    const tokA = next.tokens.find((t) => t.id === 'r1');
    const tokB = next.tokens.find((t) => t.id === 'r2');
    expect(tokA?.position).toBe(8);
    expect(tokB?.position).toBe(14);
  });
});

describe('State Machine — advanced flows', () => {
  it('should auto-end turn when all in jail roll non-par', () => {
    const state = makeState();
    const next = rollDice(state, roll(2, 5));
    expect(next.turnPhase).toBe('TURN_END');
  });

  it('should allow exit par on first roll when all in jail', () => {
    const state = makeState();
    const next = rollDice(state, roll(6, 6));
    expect(next.turnPhase).toBe('SELECT_TOKEN');
  });

  it('should record action history', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    let state = makeState({ tokens });
    state = rollDice(state, roll(2, 3));
    state = moveToken(state, 'r1', 5);
    expect(state.actions.length).toBeGreaterThanOrEqual(2);
    expect(state.actions.some((a) => a.type === 'ROLL')).toBe(true);
    expect(state.actions.some((a) => a.type === 'MOVE_TOKEN')).toBe(true);
  });

  it('should enter cielo from entrance on second lap', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 63 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 63 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 2, die2: 3, isPair: false, isParques: false, timestamp: 0 },
      tokens,
    });
    const next = moveToken(state, 'r1', 5);
    const moved = next.tokens.find((t) => t.id === 'r1');
    expect(moved?.state).toBe('IN_SKY');
    expect(moved?.position).toBe(72);
  });

  it('should give extra turn on pair roll', () => {
    const tokens = [
      ...makeFullSet('RED', 0).map((t, i) =>
        i === 0 ? { ...t, position: 5 as BoardPosition, state: 'IN_TRANSIT' as const, totalSteps: 5 } : t,
      ),
      ...makeFullSet('BLUE', 4),
      ...makeFullSet('GREEN', 8),
      ...makeFullSet('YELLOW', 12),
    ];
    let state = makeState({ tokens });
    state = rollDice(state, roll(4, 4));
    expect(state.extraTurnsRemaining).toBeGreaterThan(0);
  });
});
