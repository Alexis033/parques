import { describe, it, expect } from 'vitest';
import {
  calculateCircuitAdvance,
  isCapturePosition,
  getCaptureTargets,
  validateMove,
  getMostAdvancedToken,
  calculatePlayerProgress,
  getExitableTokens,
} from '../movement';
import { EXIT_POSITIONS, CIELO_ENTRANCES, CIELO_START, CIELO_END } from '../board';
import type { EngineToken, EngineState } from '../engine-types';
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

describe('Movement — circuit advance', () => {
  it('should advance RED from exit 0 by 1 step', () => {
    const result = calculateCircuitAdvance(0, 1, 0, 'RED');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(1);
    expect(result!.totalSteps).toBe(1);
    expect(result!.enteredCielo).toBe(false);
  });

  it('should advance 63 steps to cielo entrance', () => {
    const result = calculateCircuitAdvance(0, 63, 0, 'RED');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(63);
    expect(result!.enteredCielo).toBe(false);
    expect(result!.totalSteps).toBe(63);
  });

  it('should enter cielo when moving past entrance threshold', () => {
    // 67 steps from exit: enters cielo at step 64, continues 3 more in cielo
    const result = calculateCircuitAdvance(0, 67, 0, 'RED');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(71); // 68 + (67 - 64) = 71
    expect(result!.enteredCielo).toBe(true);
    expect(result!.totalSteps).toBe(67);
  });

  it('should land at CIELO_ENTRANCE after 63 steps (64 squares counting exit)', () => {
    const result = calculateCircuitAdvance(0, 63, 0, 'RED');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(63);
    expect(result!.enteredCielo).toBe(false);
    expect(result!.totalSteps).toBe(63);
  });

  it('should enter cielo at step 64 from exit (64 squares total)', () => {
    const result = calculateCircuitAdvance(0, 64, 0, 'RED');
    expect(result).not.toBeNull();
    expect(result!.enteredCielo).toBe(true);
    expect(result!.position).toBe(CIELO_START.RED);
    expect(result!.totalSteps).toBe(64);
  });

  it('should advance through cielo after entering', () => {
    const result = calculateCircuitAdvance(68, 3, 85, 'RED');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(71);
    expect(result!.crowned).toBe(false);
    expect(result!.enteredCielo).toBe(false);
  });

  it('should crown at exact cielo end', () => {
    const result = calculateCircuitAdvance(68, 7, 85, 'RED');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(CIELO_END.RED);
    expect(result!.crowned).toBe(true);
  });

  it('should return null for overshoot in cielo', () => {
    const result = calculateCircuitAdvance(68, 8, 85, 'RED');
    expect(result).toBeNull();
  });

  it('should wrap around circuit modulo 68', () => {
    const result = calculateCircuitAdvance(67, 1, 0, 'RED');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(0);
    expect(result!.totalSteps).toBe(1);
  });

  it('should advance BLUE circuit correctly', () => {
    const result = calculateCircuitAdvance(17, 5, 0, 'BLUE');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(22);
  });

  it('should advance GREEN circuit correctly', () => {
    const result = calculateCircuitAdvance(34, 10, 0, 'GREEN');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(44);
  });

  it('should advance YELLOW circuit correctly', () => {
    const result = calculateCircuitAdvance(51, 3, 0, 'YELLOW');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(54);
  });

  it('should enter BLUE cielo after 64 steps from exit', () => {
    const result = calculateCircuitAdvance(17, 64, 0, 'BLUE');
    expect(result).not.toBeNull();
    expect(result!.enteredCielo).toBe(true);
    expect(result!.position).toBe(CIELO_START.BLUE);
  });

  it('should enter GREEN cielo after 64 steps from exit', () => {
    const result = calculateCircuitAdvance(34, 64, 0, 'GREEN');
    expect(result).not.toBeNull();
    expect(result!.enteredCielo).toBe(true);
    expect(result!.position).toBe(CIELO_START.GREEN);
  });

  it('should enter YELLOW cielo after 64 steps from exit', () => {
    const result = calculateCircuitAdvance(51, 64, 0, 'YELLOW');
    expect(result).not.toBeNull();
    expect(result!.enteredCielo).toBe(true);
    expect(result!.position).toBe(CIELO_START.YELLOW);
  });

  it('should continue in cielo with remaining steps', () => {
    const result = calculateCircuitAdvance(68, 4, 85, 'RED');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(72);
    expect(result!.totalSteps).toBe(89);
  });

  it('should handle partial wrap at circuit boundary', () => {
    const result = calculateCircuitAdvance(65, 5, 0, 'RED');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(2);
    expect(result!.totalSteps).toBe(5);
  });

  it('should return null for invalid positions', () => {
    const result = calculateCircuitAdvance(-1, 5, 0, 'RED');
    expect(result).toBeNull();
  });

  it('should enter cielo from entrance with partial steps', () => {
    const result = calculateCircuitAdvance(63, 5, 63, 'RED');
    expect(result).not.toBeNull();
    expect(result!.enteredCielo).toBe(true);
    expect(result!.position).toBe(72);
    expect(result!.totalSteps).toBe(68);
  });

  it('should not enter cielo at entrance before completing 64 squares', () => {
    const result = calculateCircuitAdvance(63, 3, 60, 'RED');
    expect(result).not.toBeNull();
    expect(result!.enteredCielo).toBe(false);
    expect(result!.position).toBe(66);
  });

  it('should enter cielo from entrance at exactly step 64', () => {
    const result = calculateCircuitAdvance(63, 1, 63, 'RED');
    expect(result).not.toBeNull();
    expect(result!.enteredCielo).toBe(true);
    expect(result!.position).toBe(68);
    expect(result!.crowned).toBe(false);
  });

  it('should crown from entrance with 8 steps', () => {
    const result = calculateCircuitAdvance(63, 8, 63, 'RED');
    expect(result).not.toBeNull();
    expect(result!.enteredCielo).toBe(true);
    expect(result!.position).toBe(CIELO_END.RED);
    expect(result!.crowned).toBe(true);
  });

  it('should overshoot from entrance with 9 steps', () => {
    const result = calculateCircuitAdvance(63, 9, 63, 'RED');
    expect(result).toBeNull();
  });
});

describe('Movement — capture logic', () => {
  it('should detect capture on common square', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 10, 'IN_TRANSIT'),
      makeToken('b1', 'BLUE', 10, 'IN_TRANSIT'),
    ];
    const target = isCapturePosition(10, 'RED', tokens);
    expect(target).not.toBeNull();
    expect(target!.id).toBe('b1');
  });

  it('should NOT detect capture on safe square', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 0, 'IN_TRANSIT'),
      makeToken('b1', 'BLUE', 0, 'IN_TRANSIT'),
    ];
    const target = isCapturePosition(0, 'RED', tokens);
    expect(target).toBeNull();
  });

  it('should NOT detect capture of own tokens', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 10, 'IN_TRANSIT'),
      makeToken('r2', 'RED', 10, 'IN_TRANSIT'),
    ];
    const target = isCapturePosition(10, 'RED', tokens);
    expect(target).toBeNull();
  });

  it('should NOT detect capture of jailed tokens', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 10, 'IN_TRANSIT'),
      makeToken('b1', 'BLUE', -1, 'JAIL'),
    ];
    const target = isCapturePosition(10, 'RED', tokens);
    expect(target).toBeNull();
  });

  it('should NOT detect capture of crowned tokens', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 10, 'IN_TRANSIT'),
      makeToken('b1', 'BLUE', 75, 'CROWNED'),
    ];
    const target = isCapturePosition(10, 'RED', tokens);
    expect(target).toBeNull();
  });

  it('should NOT detect capture on safe zone square', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 7, 'IN_TRANSIT'),
      makeToken('b1', 'BLUE', 7, 'IN_TRANSIT'),
    ];
    const target = isCapturePosition(7, 'RED', tokens);
    expect(target).toBeNull();
  });

  it('should NOT capture on any cielo lane position', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 68, 'IN_SKY'),
      makeToken('b1', 'BLUE', 68, 'IN_TRANSIT'),
    ];
    const target = isCapturePosition(68, 'RED', tokens);
    expect(target).toBeNull();
  });

  it('should NOT capture on BLUE cielo position 76', () => {
    const tokens: EngineToken[] = [
      makeToken('b1', 'BLUE', 76, 'IN_SKY'),
      makeToken('r1', 'RED', 76, 'IN_TRANSIT'),
    ];
    const target = isCapturePosition(76, 'RED', tokens);
    expect(target).toBeNull();
  });

  it('should NOT capture on jail positions', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 100, 'IN_TRANSIT'),
      makeToken('b1', 'BLUE', 100, 'IN_TRANSIT'),
    ];
    const target = isCapturePosition(100, 'RED', tokens);
    expect(target).toBeNull();
  });

  it('getCaptureTargets should detect enemy tokens on non-safe square', () => {
    const state = {
      tokens: [
        makeToken('r1', 'RED', 10, 'IN_TRANSIT'),
        makeToken('g1', 'GREEN', 10, 'IN_TRANSIT'),
        makeToken('b1', 'BLUE', 10, 'IN_TRANSIT'),
      ],
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'ALL' },
    } as unknown as EngineState;
    const targets = getCaptureTargets('r1', 10, state);
    expect(targets.length).toBe(2);
    expect(targets.map((t) => t.id)).toContain('g1');
    expect(targets.map((t) => t.id)).toContain('b1');
  });

  it('getCaptureTargets should return empty on safe zone', () => {
    const state = {
      tokens: [
        makeToken('r1', 'RED', 0, 'IN_TRANSIT'),
        makeToken('g1', 'GREEN', 0, 'IN_TRANSIT'),
      ],
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'ALL' },
    } as unknown as EngineState;
    const targets = getCaptureTargets('r1', 0, state);
    expect(targets).toEqual([]);
  });

  it('getCaptureTargets should return empty on cielo position', () => {
    const state = {
      tokens: [
        makeToken('r1', 'RED', 68, 'IN_SKY'),
        makeToken('g1', 'GREEN', 68, 'IN_TRANSIT'),
      ],
      houseRules: { soplarCorrespondiente: false, patearSeguroSalida: false, exitRule: 'ALL' },
    } as unknown as EngineState;
    const targets = getCaptureTargets('r1', 68, state);
    expect(targets).toEqual([]);
  });
});

describe('Movement — validation', () => {
  it('should validate a legal circuit move', () => {
    const token = makeToken('r1', 'RED', 3, 'IN_TRANSIT', 3);
    const state = { tokens: [token] } as EngineState;
    const result = validateMove(token, 4, 'RED', state);
    expect(result.valid).toBe(true);
  });

  it('should reject move for crowned token', () => {
    const token = makeToken('r1', 'RED', 75, 'CROWNED');
    const state = { tokens: [token] } as EngineState;
    const result = validateMove(token, 1, 'RED', state);
    expect(result.valid).toBe(false);
  });

  it('should reject move for jailed token', () => {
    const token = makeToken('r1', 'RED', -1, 'JAIL');
    const state = { tokens: [token] } as EngineState;
    const result = validateMove(token, 5, 'RED', state);
    expect(result.valid).toBe(false);
  });

  it('should reject overshoot in cielo', () => {
    const token = makeToken('r1', 'RED', 72, 'IN_SKY', 88);
    const state = { tokens: [token] } as EngineState;
    const result = validateMove(token, 5, 'RED', state);
    expect(result.valid).toBe(false);
  });

  it('should accept exact coronation from cielo', () => {
    const token = makeToken('r1', 'RED', 73, 'IN_SKY', 89);
    const state = { tokens: [token] } as EngineState;
    const result = validateMove(token, 2, 'RED', state);
    expect(result.valid).toBe(true);
  });

  it('should validate move from entrance after 64 squares completed', () => {
    const token = makeToken('r1', 'RED', 63, 'IN_TRANSIT', 63);
    const state = { tokens: [token] } as EngineState;
    const result = validateMove(token, 3, 'RED', state);
    expect(result.valid).toBe(true);
  });
});

describe('Movement — advanced token', () => {
  it('should find most advanced token by totalSteps', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 10, 'IN_TRANSIT', 10),
      makeToken('r2', 'RED', 30, 'IN_TRANSIT', 30),
      makeToken('r3', 'RED', 5, 'IN_TRANSIT', 5),
    ];
    const most = getMostAdvancedToken(tokens, 'RED');
    expect(most).not.toBeNull();
    expect(most!.id).toBe('r2');
  });

  it('should exclude jailed tokens from most advanced', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', -1, 'JAIL', 0),
      makeToken('r2', 'RED', 30, 'IN_TRANSIT', 30),
    ];
    const most = getMostAdvancedToken(tokens, 'RED');
    expect(most).not.toBeNull();
    expect(most!.id).toBe('r2');
  });

  it('should include IN_SKY tokens in most advanced', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 68, 'IN_SKY', 85),
      makeToken('r2', 'RED', 30, 'IN_TRANSIT', 30),
    ];
    const most = getMostAdvancedToken(tokens, 'RED');
    expect(most).not.toBeNull();
    expect(most!.id).toBe('r1');
  });

  it('should return null if no active tokens', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', -1, 'JAIL'),
      makeToken('r2', 'RED', 75, 'CROWNED'),
    ];
    const most = getMostAdvancedToken(tokens, 'RED');
    expect(most).toBeNull();
  });
});

describe('Movement — player progress', () => {
  it('should track crowned tokens count', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 75, 'CROWNED'),
      makeToken('r2', 'RED', 75, 'CROWNED'),
      makeToken('r3', 'RED', -1, 'JAIL'),
      makeToken('r4', 'RED', 5, 'IN_TRANSIT', 5),
    ];
    const progress = calculatePlayerProgress(tokens, 'RED');
    expect(progress.tokensCrowned).toBe(2);
  });

  it('should track cielo progress', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 71, 'IN_SKY', 88),
      makeToken('r2', 'RED', 68, 'IN_SKY', 85),
    ];
    const progress = calculatePlayerProgress(tokens, 'RED');
    expect(progress.cieloProgress).toBe(4);
  });

  it('should track circuit progress', () => {
    const tokens: EngineToken[] = [
      makeToken('r1', 'RED', 30, 'IN_TRANSIT', 30),
      makeToken('r2', 'RED', 5, 'IN_TRANSIT', 5),
    ];
    const progress = calculatePlayerProgress(tokens, 'RED');
    expect(progress.circuitProgress).toBe(30);
  });
});

describe('Movement — exitable tokens', () => {
  it('should return jailed tokens for current player', () => {
    const state = {
      turnOrder: ['RED', 'BLUE', 'GREEN', 'YELLOW'],
      currentPlayerIndex: 0,
      tokens: [
        makeToken('r1', 'RED', -1, 'JAIL'),
        makeToken('r2', 'RED', -1, 'JAIL'),
        makeToken('r3', 'RED', 5, 'IN_TRANSIT', 5),
        makeToken('b1', 'BLUE', -1, 'JAIL'),
      ],
    } as EngineState;
    const exitable = getExitableTokens(state);
    expect(exitable.length).toBe(2);
    expect(exitable.every((t) => t.color === 'RED')).toBe(true);
    expect(exitable.every((t) => t.state === 'JAIL')).toBe(true);
  });
});
