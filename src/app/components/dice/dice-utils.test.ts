import { describe, it, expect } from 'vitest';
import type { DiceRoll } from '@parchis/shared';
import { computeDiceValues } from './dice-utils';

describe('computeDiceValues', () => {
  it('should return [1, 1] when roll is null', () => {
    expect(computeDiceValues(null)).toEqual([1, 1]);
  });

  it('should recover individual values when die2 > 0', () => {
    // Server stores die1 as combined sum (3+4=7), die2 as individual (4)
    const roll: DiceRoll = { die1: 7, die2: 4, isPair: false, isParques: false, timestamp: 1 };
    expect(computeDiceValues(roll)).toEqual([3, 4]);
  });

  it('should handle doubles (both dice equal)', () => {
    // Server stores die1 as combined (3+3=6), die2 as individual (3)
    const roll: DiceRoll = { die1: 6, die2: 3, isPair: true, isParques: false, timestamp: 1 };
    expect(computeDiceValues(roll)).toEqual([3, 3]);
  });

  it('should return [die1, 0] when die2 is 0 (single die roll)', () => {
    const roll: DiceRoll = { die1: 5, die2: 0, isPair: false, isParques: false, timestamp: 1 };
    expect(computeDiceValues(roll)).toEqual([5, 0]);
  });

  it('should handle parques (three consecutive pairs — all dice = 20)', () => {
    // Server stores die1 as combined (20+20=40), die2 as 20
    const roll: DiceRoll = { die1: 40, die2: 20, isPair: true, isParques: true, timestamp: 1 };
    expect(computeDiceValues(roll)).toEqual([20, 20]);
  });

  it('should handle minimum values (die1=1, die2=0)', () => {
    const roll: DiceRoll = { die1: 1, die2: 0, isPair: false, isParques: false, timestamp: 1 };
    expect(computeDiceValues(roll)).toEqual([1, 0]);
  });

  it('should handle die1=die2 when die2 > 0 (both 1 each)', () => {
    // die1=2 (combined), die2=1
    const roll: DiceRoll = { die1: 2, die2: 1, isPair: false, isParques: false, timestamp: 1 };
    expect(computeDiceValues(roll)).toEqual([1, 1]);
  });
});
