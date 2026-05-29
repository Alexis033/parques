import type { DiceRoll } from '@parchis/shared';

/**
 * Recover individual dice values from the server-encoded DiceRoll.
 *
 * The Edge Function stores die1 as the COMBINED SUM (die1 + die2)
 * and die2 as the individual second die value.
 *
 * This function reverses that encoding:
 * - When die2 > 0: first die = die1 - die2, second die = die2
 * - When die2 === 0: only one die was rolled, return [die1, 0]
 * - When roll is null: return default [1, 1]
 */
export function computeDiceValues(roll: DiceRoll | null): [number, number] {
  if (!roll) return [1, 1];
  if (roll.die2 > 0) {
    return [roll.die1 - roll.die2, roll.die2];
  }
  return [roll.die1, 0];
}
