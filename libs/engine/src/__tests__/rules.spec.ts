import { describe, it, expect } from 'vitest';
import {
  canExitJail,
  isLastTokenMode,
  getValidActions,
  getMoveActions,
  getExitActions,
  getSoplarActions,
  checkParques,
  shouldHaveExtraTurn,
  isGameOver,
  getCurrentPlayerColor,
  getPlayerTokens,
  canPatearOnExit,
} from '../rules';
import type { EngineState, EngineToken } from '../engine-types';
import type { BoardPosition, PlayerColor } from '@parchis/shared';

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

function makeState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    id: 'test-game',
    roomId: 'test-room',
    phase: 'PLAYING',
    players: [
      { id: 'p1', color: 'RED', name: 'Player 1', isHost: true, isConnected: true },
      { id: 'p2', color: 'BLUE', name: 'Player 2', isHost: false, isConnected: true },
      { id: 'p3', color: 'GREEN', name: 'Player 3', isHost: false, isConnected: true },
      { id: 'p4', color: 'YELLOW', name: 'Player 4', isHost: false, isConnected: true },
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

describe('Rules — canExitJail', () => {
  it('should allow exit with a par', () => {
    const state = makeState({
      currentRoll: { die1: 3, die2: 3, isPair: true, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', -1, 'JAIL')],
    });
    expect(canExitJail(state)).toBe(true);
  });

  it('should NOT allow exit without a par', () => {
    const state = makeState({
      currentRoll: { die1: 2, die2: 5, isPair: false, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', -1, 'JAIL')],
    });
    expect(canExitJail(state)).toBe(false);
  });

  it('should NOT allow exit if no roll', () => {
    const state = makeState({
      tokens: [makeToken('r1', 'RED', -1, 'JAIL')],
    });
    expect(canExitJail(state)).toBe(false);
  });

  it('should NOT allow exit if no tokens in jail', () => {
    const state = makeState({
      currentRoll: { die1: 3, die2: 3, isPair: true, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', 5, 'IN_TRANSIT', 5)],
    });
    expect(canExitJail(state)).toBe(false);
  });

  it('should check exitRule CONDITIONAL for specific par values', () => {
    const state = makeState({
      currentRoll: { die1: 2, die2: 2, isPair: true, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', -1, 'JAIL')],
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'CONDITIONAL' },
    });
    expect(canExitJail(state)).toBe(false);
  });

  it('should allow exit with CONDITIONAL when par is 1 or 6', () => {
    const state = makeState({
      currentRoll: { die1: 6, die2: 6, isPair: true, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', -1, 'JAIL')],
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'CONDITIONAL' },
    });
    expect(canExitJail(state)).toBe(true);
  });
});

describe('Rules — isLastTokenMode', () => {
  it('should be true when 3 crowned and 1 active', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 75, 'CROWNED'),
      makeToken('r2', 'RED', 75, 'CROWNED'),
      makeToken('r3', 'RED', 75, 'CROWNED'),
      makeToken('r4', 'RED', 30, 'IN_TRANSIT', 30),
    ];
    expect(isLastTokenMode(tokens, 'RED')).toBe(true);
  });

  it('should be false when fewer than 3 crowned', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 75, 'CROWNED'),
      makeToken('r2', 'RED', 75, 'CROWNED'),
      makeToken('r3', 'RED', 10, 'IN_TRANSIT'),
      makeToken('r4', 'RED', 5, 'IN_TRANSIT'),
    ];
    expect(isLastTokenMode(tokens, 'RED')).toBe(false);
  });

  it('should be false when all crowned', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 75, 'CROWNED'),
      makeToken('r2', 'RED', 75, 'CROWNED'),
      makeToken('r3', 'RED', 75, 'CROWNED'),
      makeToken('r4', 'RED', 75, 'CROWNED'),
    ];
    expect(isLastTokenMode(tokens, 'RED')).toBe(false);
  });

  it('should be false with no active tokens', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', -1, 'JAIL'),
      makeToken('r2', 'RED', -1, 'JAIL'),
      makeToken('r3', 'RED', -1, 'JAIL'),
      makeToken('r4', 'RED', -1, 'JAIL'),
    ];
    expect(isLastTokenMode(tokens, 'RED')).toBe(false);
  });

  it('should be false with only 2 crowned', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 75, 'CROWNED'),
      makeToken('r2', 'RED', 75, 'CROWNED'),
      makeToken('r3', 'RED', 10, 'IN_TRANSIT'),
      makeToken('r4', 'RED', 5, 'IN_TRANSIT'),
    ];
    expect(isLastTokenMode(tokens, 'RED')).toBe(false);
  });
});

describe('Rules — getExitActions', () => {
  it('should return exit actions when par rolled and tokens in jail', () => {
    const state = makeState({
      turnPhase: 'SELECT_TOKEN',
      currentRoll: { die1: 4, die2: 4, isPair: true, isParques: false, timestamp: 0 },
      tokens: [
        makeToken('r1', 'RED', -1, 'JAIL', 0, 0),
        makeToken('r2', 'RED', -1, 'JAIL', 0, 1),
      ],
    });
    const actions = getExitActions(state);
    expect(actions.length).toBe(2);
    expect(actions[0].type).toBe('EXIT_TOKEN');
  });

  it('should return empty when no tokens in jail', () => {
    const state = makeState({
      turnPhase: 'SELECT_TOKEN',
      currentRoll: { die1: 4, die2: 4, isPair: true, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', 5, 'IN_TRANSIT', 5)],
    });
    const actions = getExitActions(state);
    expect(actions.length).toBe(0);
  });

  it('should return empty when no par', () => {
    const state = makeState({
      turnPhase: 'SELECT_TOKEN',
      currentRoll: { die1: 2, die2: 5, isPair: false, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', -1, 'JAIL')],
    });
    const actions = getExitActions(state);
    expect(actions.length).toBe(0);
  });

  it('should return exit actions for all jailed tokens with exitRule TWO', () => {
    const state = makeState({
      turnPhase: 'SELECT_TOKEN',
      currentRoll: { die1: 4, die2: 4, isPair: true, isParques: false, timestamp: 0 },
      tokens: [
        makeToken('r1', 'RED', -1, 'JAIL', 0, 0),
        makeToken('r2', 'RED', -1, 'JAIL', 0, 1),
        makeToken('r3', 'RED', -1, 'JAIL', 0, 2),
        makeToken('r4', 'RED', -1, 'JAIL', 0, 3),
      ],
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'TWO' },
    });
    const actions = getExitActions(state);
    expect(actions.length).toBe(4);
  });
});

describe('Rules — getMoveActions', () => {
  it('should return combined move action for active token', () => {
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', 5, 'IN_TRANSIT', 5)],
    });
    const actions = getMoveActions(state);
    const combined = actions.filter((a) => a.type === 'MOVE_COMBINED');
    expect(combined.length).toBe(1);
    if (combined[0].type === 'MOVE_COMBINED') {
      expect(combined[0].squares).toBe(7);
    }
  });

  it('should return split move actions for 2+ active tokens with par', () => {
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 5, die2: 5, isPair: true, isParques: false, timestamp: 0 },
      tokens: [
        makeToken('r1', 'RED', 5, 'IN_TRANSIT', 5),
        makeToken('r2', 'RED', 10, 'IN_TRANSIT', 10),
      ],
    });
    const actions = getMoveActions(state);
    const splits = actions.filter((a) => a.type === 'MOVE_SPLIT');
    expect(splits.length).toBeGreaterThanOrEqual(2);
  });

  it('should return single die move in last token mode', () => {
    const state = makeState({
      turnPhase: 'MOVE',
      isLastTokenMode: true,
      currentRoll: { die1: 4, die2: 0, isPair: false, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', 5, 'IN_TRANSIT', 5)],
    });
    const actions = getMoveActions(state);
    const combined = actions.filter((a) => a.type === 'MOVE_COMBINED');
    expect(combined.length).toBe(1);
    if (combined[0].type === 'MOVE_COMBINED') {
      expect(combined[0].squares).toBe(4);
    }
  });

  it('should return empty when no valid moves (overshoot)', () => {
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 6, die2: 6, isPair: true, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', 72, 'IN_SKY', 88)],
    });
    const actions = getMoveActions(state);
    const moves = actions.filter((a) => a.type !== 'SOPLAR');
    expect(moves.length).toBe(0);
  });

  it('should include split option for non-pair with different die values', () => {
    const state = makeState({
      turnPhase: 'MOVE',
      currentRoll: { die1: 2, die2: 5, isPair: false, isParques: false, timestamp: 0 },
      tokens: [
        makeToken('r1', 'RED', 5, 'IN_TRANSIT', 5),
        makeToken('r2', 'RED', 10, 'IN_TRANSIT', 10),
      ],
    });
    const actions = getMoveActions(state);
    const splits = actions.filter((a) => a.type === 'MOVE_SPLIT');
    expect(splits.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Rules — soplar actions', () => {
  it('should return soplar actions for missed captures', () => {
    const state = makeState({
      turnPhase: 'MOVE',
      currentPlayerIndex: 1,
      houseRules: { soplarCorrespondiente: true, patearSeguroSalida: false, exitRule: 'ALL' },
      missedCaptures: [
        { playerId: 'RED', tokenId: 'r1', capturedTokenId: 'b1', position: 10, turnNumber: 1 },
      ],
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens: [
        makeToken('r1', 'RED', 10, 'IN_TRANSIT'),
        makeToken('b1', 'BLUE', -1, 'JAIL'),
      ],
    });
    const actions = getSoplarActions(state);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('SOPLAR');
  });

  it('should return empty when no missed captures', () => {
    const state = makeState({
      turnPhase: 'MOVE',
      houseRules: { soplarCorrespondiente: true, patearSeguroSalida: false, exitRule: 'ALL' },
    });
    const actions = getSoplarActions(state);
    expect(actions.length).toBe(0);
  });

  it('should return empty when soplar disabled', () => {
    const state = makeState({
      turnPhase: 'MOVE',
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'ALL' },
      missedCaptures: [
        { playerId: 'RED', tokenId: 'r1', capturedTokenId: 'b1', position: 10, turnNumber: 1 },
      ],
    });
    const actions = getSoplarActions(state);
    expect(actions.length).toBe(0);
  });

  it('should not return soplar for same player as current', () => {
    const state = makeState({
      turnPhase: 'MOVE',
      currentPlayerIndex: 0,
      houseRules: { soplarCorrespondiente: true, patearSeguroSalida: false, exitRule: 'ALL' },
      missedCaptures: [
        { playerId: 'RED', tokenId: 'r1', capturedTokenId: 'b1', position: 10, turnNumber: 1 },
      ],
      currentRoll: { die1: 3, die2: 4, isPair: false, isParques: false, timestamp: 0 },
      tokens: [makeToken('r1', 'RED', 10, 'IN_TRANSIT')],
    });
    const actions = getSoplarActions(state);
    expect(actions.length).toBe(0);
  });
});

describe('Rules — getValidActions', () => {
  it('should allow roll when phase is ROLL', () => {
    const state = makeState({
      turnPhase: 'ROLL',
      tokens: [makeToken('r1', 'RED', 5, 'IN_TRANSIT', 5)],
    });
    const actions = getValidActions(state);
    expect(actions.some((a) => a.type === 'ROLL')).toBe(true);
  });

  it('should allow up to 3 roll attempts when all in jail', () => {
    const state = makeState({
      turnPhase: 'ROLL',
      rollAttempts: 0,
      tokens: [
        makeToken('r1', 'RED', -1, 'JAIL'),
        makeToken('r2', 'RED', -1, 'JAIL'),
        makeToken('r3', 'RED', -1, 'JAIL'),
        makeToken('r4', 'RED', -1, 'JAIL'),
      ],
    });
    const actions = getValidActions(state);
    expect(actions.some((a) => a.type === 'ROLL')).toBe(true);
  });

  it('should NOT allow roll after 3 attempts all in jail', () => {
    const state = makeState({
      turnPhase: 'ROLL',
      rollAttempts: 3,
      tokens: [
        makeToken('r1', 'RED', -1, 'JAIL'),
        makeToken('r2', 'RED', -1, 'JAIL'),
        makeToken('r3', 'RED', -1, 'JAIL'),
        makeToken('r4', 'RED', -1, 'JAIL'),
      ],
    });
    const actions = getValidActions(state);
    expect(actions.some((a) => a.type === 'ROLL')).toBe(false);
  });

  it('should return empty actions for finished game', () => {
    const state = makeState({
      phase: 'FINISHED',
      winner: 'RED',
    });
    const actions = getValidActions(state);
    expect(actions.length).toBe(0);
  });
});

describe('Rules — checkParques', () => {
  it('should detect 3 consecutive pairs', () => {
    const state = makeState({ consecutivePairs: 3 });
    expect(checkParques(state)).toBe(true);
  });

  it('should NOT detect with fewer than 3', () => {
    const state = makeState({ consecutivePairs: 2 });
    expect(checkParques(state)).toBe(false);
  });

  it('should NOT detect with 0 consecutive pairs', () => {
    const state = makeState({ consecutivePairs: 0 });
    expect(checkParques(state)).toBe(false);
  });
});

describe('Rules — shouldHaveExtraTurn', () => {
  it('should give extra turn on pair', () => {
    const state = makeState({
      currentRoll: { die1: 3, die2: 3, isPair: true, isParques: false, timestamp: 0 },
    });
    expect(shouldHaveExtraTurn(state)).toBe(true);
  });

  it('should NOT give extra turn on non-pair', () => {
    const state = makeState({
      currentRoll: { die1: 2, die2: 5, isPair: false, isParques: false, timestamp: 0 },
    });
    expect(shouldHaveExtraTurn(state)).toBe(false);
  });

  it('should NOT give extra turn on Parqués', () => {
    const state = makeState({
      currentRoll: { die1: 3, die2: 3, isPair: true, isParques: true, timestamp: 0 },
    });
    expect(shouldHaveExtraTurn(state)).toBe(false);
  });
});

describe('Rules — utility functions', () => {
  it('isGameOver detects winner', () => {
    const state = makeState({ winner: 'RED' });
    expect(isGameOver(state)).toBe(true);
  });

  it('isGameOver detects finished phase', () => {
    const state = makeState({ phase: 'FINISHED' });
    expect(isGameOver(state)).toBe(true);
  });

  it('isGameOver returns false for active game', () => {
    const state = makeState();
    expect(isGameOver(state)).toBe(false);
  });

  it('getCurrentPlayerColor returns correct color', () => {
    const state = makeState({ currentPlayerIndex: 0 });
    expect(getCurrentPlayerColor(state)).toBe('RED');
  });

  it('getCurrentPlayerColor returns GREEN for index 2', () => {
    const state = makeState({ currentPlayerIndex: 2 });
    expect(getCurrentPlayerColor(state)).toBe('GREEN');
  });

  it('getPlayerTokens returns correct color tokens', () => {
    const state = makeState({
      tokens: [
        makeToken('r1', 'RED', 5, 'IN_TRANSIT'),
        makeToken('b1', 'BLUE', 10, 'IN_TRANSIT'),
        makeToken('r2', 'RED', -1, 'JAIL'),
      ],
    });
    const redTokens = getPlayerTokens(state, 'RED');
    expect(redTokens.length).toBe(2);
    expect(redTokens.every((t) => t.color === 'RED')).toBe(true);
  });
});

describe('Rules — canPatearOnExit', () => {
  it('should return true when patear enabled and enemies on exit', () => {
    const state = makeState({
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: true, exitRule: 'ALL' },
      tokens: [
        makeToken('r1', 'RED', -1, 'JAIL'),
        makeToken('b1', 'BLUE', 0, 'IN_TRANSIT'),
      ],
    });
    expect(canPatearOnExit(state)).toBe(true);
  });

  it('should return false when patear disabled', () => {
    const state = makeState({
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'ALL' },
      tokens: [
        makeToken('r1', 'RED', -1, 'JAIL'),
        makeToken('b1', 'BLUE', 0, 'IN_TRANSIT'),
      ],
    });
    expect(canPatearOnExit(state)).toBe(false);
  });

  it('should return false when no enemies on exit', () => {
    const state = makeState({
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: true, exitRule: 'ALL' },
      tokens: [makeToken('r1', 'RED', -1, 'JAIL')],
    });
    expect(canPatearOnExit(state)).toBe(false);
  });
});
