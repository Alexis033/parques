import { describe, it, expect, vi } from 'vitest';
import { DiceEngine } from './dice';

describe('DiceEngine', () => {
  it('should roll two dice by default', () => {
    const dice = new DiceEngine();
    const roll = dice.roll();
    expect(roll.die1).toBeGreaterThanOrEqual(1);
    expect(roll.die1).toBeLessThanOrEqual(6);
    expect(roll.die2).toBeGreaterThanOrEqual(1);
    expect(roll.die2).toBeLessThanOrEqual(6);
    expect(roll.isPair).toBe(roll.die1 === roll.die2);
    expect(roll.timestamp).toBeGreaterThan(0);
  });

  it('should detect pairs', () => {
    const dice = new DiceEngine();
    let foundPair = false;
    for (let i = 0; i < 100; i++) {
      const roll = dice.roll();
      if (roll.isPair) {
        foundPair = true;
        break;
      }
    }
    expect(foundPair).toBe(true);
  });

  it('should detect isParques after 3 consecutive pairs', () => {
    const dice = new DiceEngine();

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)  // die1 = 1
      .mockReturnValueOnce(0)  // die2 = 1
      .mockReturnValueOnce(0)  // die1 = 1
      .mockReturnValueOnce(0)  // die2 = 1
      .mockReturnValueOnce(0)  // die1 = 1
      .mockReturnValueOnce(0); // die2 = 1

    const r1 = dice.roll();
    expect(r1.isPair).toBe(true);
    expect(r1.isParques).toBe(false);

    const r2 = dice.roll();
    expect(r2.isPair).toBe(true);
    expect(r2.isParques).toBe(false);

    const r3 = dice.roll();
    expect(r3.isPair).toBe(true);
    expect(r3.isParques).toBe(true);
  });

  it('should reset consecutive pairs on non-pair roll', () => {
    const dice = new DiceEngine();

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)   // die1 = 1
      .mockReturnValueOnce(0)   // die2 = 1 (pair)
      .mockReturnValueOnce(0)   // die1 = 1
      .mockReturnValueOnce(1/6);// die2 = 2 (not pair)

    dice.roll();
    const r2 = dice.roll();
    expect(r2.isPair).toBe(false);
    expect(dice.getConsecutivePairs()).toBe(0);
  });

  it('should roll single die in last token mode', () => {
    const dice = new DiceEngine({ isLastTokenMode: true });
    const roll = dice.roll();
    expect(roll.die1).toBeGreaterThanOrEqual(1);
    expect(roll.die1).toBeLessThanOrEqual(6);
    expect(roll.die2).toBe(0);
    expect(roll.isPair).toBe(false);
  });

  it('should track roll history', () => {
    const dice = new DiceEngine();
    dice.roll();
    dice.roll();
    dice.roll();
    expect(dice.rollCount).toBe(3);
    expect(dice.getRollHistory().length).toBe(3);
  });

  it('should return last roll', () => {
    const dice = new DiceEngine();
    expect(dice.lastRoll).toBeNull();
    const roll = dice.roll();
    expect(dice.lastRoll).toEqual(roll);
  });

  it('should reset state', () => {
    const dice = new DiceEngine();
    dice.roll();
    dice.roll();
    expect(dice.rollCount).toBe(2);
    dice.reset();
    expect(dice.rollCount).toBe(0);
    expect(dice.lastRoll).toBeNull();
    expect(dice.getConsecutivePairs()).toBe(0);
  });

  it('should toggle last token mode', () => {
    const dice = new DiceEngine();
    expect(dice.roll().die2).toBeGreaterThan(0);
    dice.setLastTokenMode(true);
    expect(dice.roll().die2).toBe(0);
  });
});
