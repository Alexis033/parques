import { type DiceRoll } from '@parchis/shared';

export interface DiceEngineOptions {
  isLastTokenMode: boolean;
}

export class DiceEngine {
  private rollHistory: DiceRoll[] = [];
  private consecutivePairs = 0;
  private isLastTokenMode: boolean;

  constructor(options?: DiceEngineOptions) {
    this.isLastTokenMode = options?.isLastTokenMode ?? false;
  }

  roll(): DiceRoll {
    let die1: number;
    let die2: number;

    if (this.isLastTokenMode) {
      die1 = this.rollSingle();
      die2 = 0;
    } else {
      die1 = this.rollSingle();
      die2 = this.rollSingle();
    }

    const isPair = !this.isLastTokenMode && die1 === die2;

    if (isPair) {
      this.consecutivePairs++;
    } else {
      this.consecutivePairs = 0;
    }

    const isParques = this.consecutivePairs >= 3;

    const roll: DiceRoll = {
      die1,
      die2,
      isPair,
      isParques,
      timestamp: Date.now(),
    };

    this.rollHistory.push(roll);
    return roll;
  }

  private rollSingle(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  getRollHistory(): readonly DiceRoll[] {
    return [...this.rollHistory];
  }

  getConsecutivePairs(): number {
    return this.consecutivePairs;
  }

  get lastRoll(): DiceRoll | null {
    return this.rollHistory.length > 0
      ? this.rollHistory[this.rollHistory.length - 1]
      : null;
  }

  get rollCount(): number {
    return this.rollHistory.length;
  }

  reset(): void {
    this.rollHistory = [];
    this.consecutivePairs = 0;
  }

  setLastTokenMode(enabled: boolean): void {
    this.isLastTokenMode = enabled;
  }
}
