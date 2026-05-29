import { describe, it, expect } from 'vitest';
import { createInitialState, handleHeartbeat, handleDisconnect, handleRematch, handleEndTurn, type HouseRules, type Player, type EngineState, type EngineToken, type BoardPosition } from './game-handler';

const defaultHouseRules: HouseRules = {
  soplarCorrespondiente: true,
  patearSeguroSalida: false,
  exitRule: 'ALL',
};

function makePlayers(): Player[] {
  return [
    { id: 'p1', color: 'RED', name: 'Alice', isHost: true, isConnected: true },
    { id: 'p2', color: 'BLUE', name: 'Bob', isHost: false, isConnected: true },
    { id: 'p3', color: 'GREEN', name: 'Charlie', isHost: false, isConnected: true },
    { id: 'p4', color: 'YELLOW', name: 'Diana', isHost: false, isConnected: true },
  ];
}

describe('handleHeartbeat', () => {
  it('should set player isConnected to true', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    // Manually set player as disconnected
    state.players = state.players.map(p => p.id === 'p1' ? { ...p, isConnected: false } : p);

    const updated = handleHeartbeat(state, 'p1');
    const player = updated.players.find(p => p.id === 'p1');
    expect(player?.isConnected).toBe(true);
  });

  it('should update lastHeartbeat timestamp', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    const updated = handleHeartbeat(state, 'p1');
    const player = updated.players.find(p => p.id === 'p1');
    expect(player?.lastHeartbeat).toBeGreaterThan(0);
    expect(player?.lastHeartbeat).toBeLessThanOrEqual(Date.now());
  });

  it('should not affect other players', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    const updated = handleHeartbeat(state, 'p1');
    const bob = updated.players.find(p => p.id === 'p2');
    expect(bob?.isConnected).toBe(true);
  });
});

describe('handleDisconnect', () => {
  it('should set player isConnected to false', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    const updated = handleDisconnect(state, 'p1');
    const player = updated.players.find(p => p.id === 'p1');
    expect(player?.isConnected).toBe(false);
  });

  it('should preserve other players connected status', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    const updated = handleDisconnect(state, 'p1');
    const bob = updated.players.find(p => p.id === 'p2');
    expect(bob?.isConnected).toBe(true);
  });

  it('should return same state for unknown player', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    const updated = handleDisconnect(state, 'unknown');
    expect(updated).toBe(state);
  });
});

describe('handleRematch', () => {
  it('should create a new game with same players in same room', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    state.phase = 'FINISHED';
    state.winner = 'RED';

    const rematch = handleRematch(state, defaultHouseRules);
    expect(rematch.id).not.toBe('game-1'); // New game ID
    expect(rematch.roomId).toBe('room-1');
    expect(rematch.players.length).toBe(4);
    expect(rematch.players.map(p => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('should reset all tokens to jail', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    // Move some tokens out
    state.tokens[0] = { ...state.tokens[0], position: 5, state: 'IN_TRANSIT', totalSteps: 5 };

    const rematch = handleRematch(state, defaultHouseRules);
    const allInJail = rematch.tokens.every(t => t.state === 'JAIL');
    expect(allInJail).toBe(true);
  });

  it('should reset game phase to PLAYING', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    state.phase = 'FINISHED';

    const rematch = handleRematch(state, defaultHouseRules);
    expect(rematch.phase).toBe('PLAYING');
  });

  it('should reset winner to null', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    state.winner = 'RED';
    state.phase = 'FINISHED';

    const rematch = handleRematch(state, defaultHouseRules);
    expect(rematch.winner).toBeNull();
  });

  it('should reset end-turn state for starting fresh', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    state.phase = 'FINISHED';
    state.round = 42;

    const rematch = handleRematch(state, defaultHouseRules);
    expect(rematch.round).toBe(1);
    expect(rematch.currentPlayerIndex).toBe(0);
    expect(rematch.turnPhase).toBe('ROLL');
  });
});

/**
 * Helper: set all tokens of a given color to CROWNED at their cielo end position.
 */
function crownAllTokens(state: EngineState, color: string): void {
  const cieloEndMap: Record<string, BoardPosition> = {
    RED: 75, BLUE: 83, GREEN: 91, YELLOW: 99,
  };
  const endPos = cieloEndMap[color] ?? 75;
  state.tokens = state.tokens.map((t: EngineToken) =>
    t.color === color
      ? { ...t, state: 'CROWNED' as const, position: endPos, totalSteps: 100 }
      : t,
  );
}

describe('handleEndTurn — game-over / DELETE ordering condition', () => {
  it('should set phase to FINISHED when a player crowns all 4 tokens', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    state.turnPhase = 'TURN_END';
    crownAllTokens(state, 'RED');

    const result = handleEndTurn(state);
    expect(result.phase).toBe('FINISHED');
    expect(result.winner).toBe('RED');
  });

  it('should detect ANY player as winner (not just current)', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    state.turnPhase = 'TURN_END';
    // Crown BLUE tokens — not current player (RED), but should still detect
    crownAllTokens(state, 'BLUE');

    const result = handleEndTurn(state);
    expect(result.phase).toBe('FINISHED');
    expect(result.winner).toBe('BLUE');
  });

  it('should NOT finish when no player has all 4 crowned', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    state.turnPhase = 'TURN_END';
    // Only crown 2 tokens for RED
    state.tokens = state.tokens.map((t: EngineToken) =>
      t.color === 'RED' && (t.index === 0 || t.index === 1)
        ? { ...t, state: 'CROWNED' as const, position: 75 as BoardPosition, totalSteps: 100 }
        : t,
    );

    const result = handleEndTurn(state);
    expect(result.phase).toBe('PLAYING');
    expect(result.winner).toBeNull();
  });

  it('should preserve FINISHED phase (no re-trigger) on subsequent calls', () => {
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    state.turnPhase = 'TURN_END';
    crownAllTokens(state, 'RED');

    const firstCall = handleEndTurn(state);
    expect(firstCall.phase).toBe('FINISHED');

    // Second call on already FINISHED state — should return unchanged (guard: phase !== 'PLAYING')
    const secondCall = handleEndTurn(firstCall);
    expect(secondCall).toBe(firstCall);
  });

  it('should transition phase from PLAYING to FINISHED (condition for DELETE ordering)', () => {
    // This simulates the condition checked in handleGameAction:
    //   if (newState.phase === 'FINISHED' && currentState.phase !== 'FINISHED')
    // The transition triggers: DELETE messages → UPDATE room status
    const state = createInitialState('game-1', 'room-1', makePlayers(), defaultHouseRules);
    expect(state.phase).toBe('PLAYING'); // initial phase

    crownAllTokens(state, 'RED');
    const result = handleEndTurn(state);

    // Phase transition: PLAYING → FINISHED
    expect(result.phase).toBe('FINISHED');
    expect(state.phase).toBe('PLAYING'); // original unchanged (pure function)

    // The DELETE ordering condition: newState.phase === 'FINISHED' && currentState.phase !== 'FINISHED'
    const shouldDeleteMessages = result.phase === 'FINISHED' && state.phase !== 'FINISHED';
    expect(shouldDeleteMessages).toBe(true);
  });
});
