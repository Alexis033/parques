import { describe, it, expect } from 'vitest';
import { Game } from '../game';
import { type ValidAction } from '../engine-types';

function createPlayers(): { id: string; name: string }[] {
  return [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
    { id: 'p3', name: 'Charlie' },
    { id: 'p4', name: 'Diana' },
  ];
}

describe('Scenarios — full game dynamics', () => {
  it('should always produce a winner after full simulation', () => {
    for (let i = 0; i < 5; i++) {
      const game = new Game(`game-${i}`, createPlayers());
      const result = game.playFullGame();
      expect(result.winner).not.toBeNull();
      expect(result.phase).toBe('FINISHED');
    }
  }, 60000);

  it('should have all 4 corners of tokens crowned by winner', () => {
    const game = new Game('test', createPlayers());
    const result = game.playFullGame();
    const winner = result.winner!;
    const winnerTokens = result.tokens.filter((t) => t.color === winner);
    expect(winnerTokens.every((t) => t.state === 'CROWNED')).toBe(true);
  }, 30000);

  it('should never have negative round count', () => {
    const game = new Game('test', createPlayers());
    game.playFullGame();
    expect(game.getState().round).toBeGreaterThan(0);
  }, 30000);

  it('should never lose tokens (always 16)', () => {
    const game = new Game('test', createPlayers());
    game.playFullGame();
    expect(game.getState().tokens.length).toBe(16);
  }, 30000);
});

describe('Scenarios — turn flow', () => {
  it('should cycle through all 4 players', () => {
    const game = new Game('test', createPlayers());
    expect(game.getCurrentPlayerColor()).toBe('RED');

    const colors: string[] = [];
    // Run enough iterations to see all 4 players at least once
    for (let i = 0; i < 20; i++) {
      const color = game.getCurrentPlayerColor();
      if (colors.length === 0 || colors[colors.length - 1] !== color) {
        colors.push(color);
      }
      game.roll();
      const actions = game.getValidActions();
      const skip = actions.find((a) => a.type === 'SKIP');
      if (skip) {
        game.skip();
      } else {
        const exitActions = actions.filter((a) => a.type === 'EXIT_TOKEN');
        if (exitActions.length > 0 && game.getState().turnPhase === 'SELECT_TOKEN') {
          game.exit((exitActions[0] as any).tokenIndex);
        }
        const moveAction = actions.find((a) => a.type === 'MOVE_COMBINED');
        if (moveAction && game.getState().turnPhase === 'MOVE') {
          game.moveCombined((moveAction as any).tokenId);
        }
        if (game.getState().turnPhase !== 'TURN_END' && game.getState().turnPhase !== 'GAME_OVER') {
          game.skip();
        }
      }
      if (colors.length >= 4) break;
    }

    // Should have seen all 4 colors in order
    expect(colors).toContain('RED');
    expect(colors).toContain('BLUE');
    expect(colors).toContain('GREEN');
    expect(colors).toContain('YELLOW');
    expect(colors[0]).toBe('RED');
  }, 30000);
});

describe('Scenarios — house rules', () => {
  it('should respect soplarCorrespondiente rule', () => {
    const game = new Game('test', createPlayers(), {
      soplarCorrespondiente: true,
      patearSeguroSalida: false,
      exitRule: 'ALL',
    });
    const state = game.getState();
    expect(state.houseRules.soplarCorrespondiente).toBe(true);
  });

  it('should respect patearSeguroSalida rule', () => {
    const game = new Game('test', createPlayers(), {
      soplarCorrespondiente: false,
      patearSeguroSalida: true,
      exitRule: 'ALL',
    });
    const state = game.getState();
    expect(state.houseRules.patearSeguroSalida).toBe(true);
  });

  it('should respect exitRule TWO', () => {
    const game = new Game('test', createPlayers(), {
      soplarCorrespondiente: false,
      patearSeguroSalida: false,
      exitRule: 'TWO',
    });
    const state = game.getState();
    expect(state.houseRules.exitRule).toBe('TWO');
  });
});

describe('Scenarios — valid action types', () => {
  it('should only produce ROLL action in ROLL phase', () => {
    const game = new Game('test', createPlayers());
    const actions = game.getValidActions();
    expect(actions.every((a) => a.type === 'ROLL')).toBe(true);
  });

  it('should include SKIP when no moves available', () => {
    const game = new Game('test', createPlayers());
    game.roll();
    const actions = game.getValidActions();
    if (actions.length > 0) {
      const hasSkip = actions.some((a) => a.type === 'SKIP');
      if (actions.every((a) => a.type === 'SKIP' || a.type === 'SOPLAR')) {
        expect(hasSkip).toBe(true);
      }
    }
  });
});

describe('Scenarios — token management', () => {
  it('should have unique IDs for all tokens', () => {
    const game = new Game('test', createPlayers());
    const ids = game.getState().tokens.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(16);
  });

  it('should assign correct colors to tokens', () => {
    const game = new Game('test', createPlayers());
    const state = game.getState();
    const colors = ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const;
    for (const color of colors) {
      const count = state.tokens.filter((t) => t.color === color).length;
      expect(count).toBe(4);
    }
  });

  it('should assign correct indices 0-3 per color', () => {
    const game = new Game('test', createPlayers());
    const state = game.getState();
    for (const color of ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const) {
      const indices = state.tokens.filter((t) => t.color === color).map((t) => t.index);
      expect(indices.sort()).toEqual([0, 1, 2, 3]);
    }
  });
});
