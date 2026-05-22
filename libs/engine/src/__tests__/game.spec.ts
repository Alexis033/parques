import { describe, it, expect } from 'vitest';
import { Game } from '../game';
import { CIELO_END } from '../board';
import { COLORS } from '@parchis/shared';

function createTestPlayers(): { id: string; name: string }[] {
  return [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
    { id: 'p3', name: 'Charlie' },
    { id: 'p4', name: 'Diana' },
  ];
}

describe('Game', () => {
  it('should create game with 4 players', () => {
    const game = new Game('room-1', createTestPlayers());
    const state = game.getState();
    expect(state.players.length).toBe(4);
    expect(state.turnOrder).toEqual(['RED', 'BLUE', 'GREEN', 'YELLOW']);
  });

  it('should initialize all tokens in jail', () => {
    const game = new Game('room-1', createTestPlayers());
    const state = game.getState();
    expect(state.tokens.length).toBe(16);
    const allInJail = state.tokens.every((t) => t.state === 'JAIL');
    expect(allInJail).toBe(true);
  });

  it('should start in ROLL phase', () => {
    const game = new Game('room-1', createTestPlayers());
    expect(game.getState().turnPhase).toBe('ROLL');
    expect(game.getState().phase).toBe('PLAYING');
  });

  it('should have valid ROLL action at start', () => {
    const game = new Game('room-1', createTestPlayers());
    const actions = game.getValidActions();
    expect(actions.some((a) => a.type === 'ROLL')).toBe(true);
  });

  it('getCurrentPlayerColor should return RED first', () => {
    const game = new Game('room-1', createTestPlayers());
    expect(game.getCurrentPlayerColor()).toBe('RED');
  });

  it('should not be game over initially', () => {
    const game = new Game('room-1', createTestPlayers());
    expect(game.isGameOver()).toBe(false);
    expect(game.getWinner()).toBeNull();
  });

  it('should detect all tokens by color', () => {
    const game = new Game('room-1', createTestPlayers());
    const state = game.getState();
    for (const color of COLORS) {
      const colorTokens = state.tokens.filter((t) => t.color === color);
      expect(colorTokens.length).toBe(4);
    }
  });

  it('should have correct token IDs', () => {
    const game = new Game('room-1', createTestPlayers());
    const state = game.getState();
    const redIds = state.tokens.filter((t) => t.color === 'RED').map((t) => t.id);
    expect(redIds).toEqual(['r1', 'r2', 'r3', 'r4']);
  });
});

describe('Game — roll and exit flow', () => {
  it('should accept roll action in ROLL phase', () => {
    const game = new Game('room-1', createTestPlayers());
    const state = game.roll();
    expect(state.currentRoll).not.toBeNull();
    expect(state.actions.length).toBeGreaterThan(0);
  });

  it('should return same state if not ROLL phase', () => {
    const game = new Game('room-1', createTestPlayers());
    const s1 = game.roll();
    const s2 = game.roll();
    expect(s2).toBe(s1);
  });
});

describe('Game — full simulation', () => {
  it('should complete a full simulated game', () => {
    const game = new Game('room-1', createTestPlayers());
    const finalState = game.playFullGame();
    expect(finalState.winner).not.toBeNull();
    expect(finalState.phase).toBe('FINISHED');
    expect(finalState.round).toBeGreaterThan(0);
    expect(finalState.actions.length).toBeGreaterThan(0);
  }, 30000);

  it('should produce serializable state', () => {
    const game = new Game('room-1', createTestPlayers());
    const json = game.serialize();
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.tokens.length).toBe(16);
    expect(parsed.turnOrder).toEqual(['RED', 'BLUE', 'GREEN', 'YELLOW']);
  });

  it('should produce crowned tokens by end', () => {
    const game = new Game('room-1', createTestPlayers());
    const finalState = game.playFullGame();
    const crownedCount = finalState.tokens.filter((t) => t.state === 'CROWNED').length;
    expect(crownedCount).toBeGreaterThanOrEqual(4);
  }, 30000);
});

describe('Game — getRankings', () => {
  it('should return rankings after game', () => {
    const game = new Game('room-1', createTestPlayers());
    game.playFullGame();
    const rankings = game.getRankings();
    expect(rankings.length).toBe(4);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].tokensCrowned).toBe(4);
  }, 30000);
});

describe('Game — reset', () => {
  it('should reset to initial state', () => {
    const game = new Game('room-1', createTestPlayers());
    game.playFullGame();
    game.reset(createTestPlayers());
    expect(game.getState().winner).toBeNull();
    expect(game.getState().phase).toBe('PLAYING');
    expect(game.getState().round).toBe(1);
    expect(game.getState().tokens.every((t) => t.state === 'JAIL')).toBe(true);
  }, 30000);
});

describe('Game — house rules', () => {
  it('should accept custom house rules', () => {
    const game = new Game('room-1', createTestPlayers(), {
      soplarCorrespondiente: true,
      patearSeguroSalida: true,
      exitRule: 'TWO',
    });
    const state = game.getState();
    expect(state.houseRules.soplarCorrespondiente).toBe(true);
    expect(state.houseRules.patearSeguroSalida).toBe(true);
    expect(state.houseRules.exitRule).toBe('TWO');
  });
});
