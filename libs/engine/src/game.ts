import {
  type PlayerColor,
  type HouseRules,
  type BoardPosition,
  DEFAULT_HOUSE_RULES,
  COLORS,
} from '@parchis/shared';
import {
  type EngineState,
  type EngineToken,
  type ValidAction,
  type PlayerProgress,
} from './engine-types';
import { DiceEngine } from './dice';
import {
  rollDice as applyRoll,
  exitToken as applyExit,
  moveToken as applyMove,
  splitMove as applySplit,
  soplar as applySoplar,
  endTurn as applyEndTurn,
} from './state-machine';
import {
  getValidActions,
  isLastTokenMode,
  getCurrentPlayerColor,
} from './rules';
import { checkWinner, getRankings, isGameComplete } from './win-condition';
import { CIELO_END } from './board';

export class Game {
  private state: EngineState;
  private diceEngine: DiceEngine;

  constructor(
    roomId: string,
    players: { id: string; name: string }[],
    houseRules: HouseRules = DEFAULT_HOUSE_RULES,
  ) {
    const turnOrder: PlayerColor[] = [COLORS[0], COLORS[1], COLORS[2], COLORS[3]];

    const tokens: EngineToken[] = [];
    for (let p = 0; p < players.length; p++) {
      const color = turnOrder[p];
      for (let i = 0; i < 4; i++) {
        const id = `${color[0].toLowerCase()}${i + 1}`;
        tokens.push({
          id,
          color,
          index: i,
          position: -1 as BoardPosition,
          state: 'JAIL',
          totalSteps: 0,
        });
      }
    }

    this.state = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      roomId,
      phase: 'PLAYING',
      players: players.map((p, i) => ({
        id: p.id,
        color: turnOrder[i],
        name: p.name,
        isHost: i === 0,
        isConnected: true,
      })),
      tokens,
      currentPlayerIndex: 0,
      turnOrder,
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
      houseRules,
    };

    this.diceEngine = new DiceEngine();
  }

  getState(): EngineState {
    return this.state;
  }

  getValidActions(): ValidAction[] {
    return getValidActions(this.state);
  }

  getCurrentPlayerColor(): PlayerColor {
    return getCurrentPlayerColor(this.state);
  }

  isGameOver(): boolean {
    return isGameComplete(this.state);
  }

  getWinner(): PlayerColor | null {
    return checkWinner(this.state);
  }

  getRankings(): PlayerProgress[] {
    return getRankings(this.state);
  }

  roll(): EngineState {
    if (this.state.turnPhase !== 'ROLL') return this.state;

    const color = getCurrentPlayerColor(this.state);
    const ltMode = isLastTokenMode(this.state.tokens, color);
    this.diceEngine.setLastTokenMode(ltMode);

    const diceRoll = this.diceEngine.roll();
    this.state = applyRoll(this.state, diceRoll);

    const winner = checkWinner(this.state);
    if (winner) {
      this.state = { ...this.state, winner, phase: 'FINISHED' };
    }

    return this.state;
  }

  exit(tokenIndex: number): EngineState {
    if (this.state.turnPhase !== 'SELECT_TOKEN') return this.state;
    this.state = applyExit(this.state, tokenIndex);
    return this.state;
  }

  moveCombined(tokenId: string): EngineState {
    if (this.state.turnPhase !== 'MOVE') return this.state;
    const roll = this.state.currentRoll;
    if (!roll) return this.state;

    const squares = this.state.isLastTokenMode ? roll.die1 : roll.die1 + roll.die2;
    this.state = applyMove(this.state, tokenId, squares);

    const winner = checkWinner(this.state);
    if (winner) {
      this.state = { ...this.state, winner, phase: 'FINISHED' };
    }

    return this.state;
  }

  moveSplit(tokenA: string, squaresA: number, tokenB: string, squaresB: number): EngineState {
    if (this.state.turnPhase !== 'MOVE') return this.state;
    this.state = applySplit(this.state, tokenA, squaresA, tokenB, squaresB);

    const winner = checkWinner(this.state);
    if (winner) {
      this.state = { ...this.state, winner, phase: 'FINISHED' };
    }

    return this.state;
  }

  soplar(targetTokenId: string): EngineState {
    if (this.state.turnPhase !== 'MOVE') return this.state;
    this.state = applySoplar(this.state, targetTokenId);
    return this.state;
  }

  endTurn(): EngineState {
    this.state = applyEndTurn(this.state);

    const color = getCurrentPlayerColor(this.state);
    const ltMode = isLastTokenMode(this.state.tokens, color);
    this.state = { ...this.state, isLastTokenMode: ltMode };
    this.diceEngine.setLastTokenMode(ltMode);

    const winner = checkWinner(this.state);
    if (winner) {
      this.state = { ...this.state, winner, phase: 'FINISHED' };
    }

    return this.state;
  }

  skip(): EngineState {
    return this.endTurn();
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  toJSON(): EngineState {
    return this.state;
  }

  playFullGame(): EngineState {
    let iterations = 0;
    const maxIterations = 5000;

    while (!this.isGameOver() && iterations < maxIterations) {
      iterations++;
      const actions = this.getValidActions();
      if (actions.length === 0) break;

      const action = actions[Math.floor(Math.random() * actions.length)];

      switch (action.type) {
        case 'ROLL':
          this.roll();
          break;
        case 'EXIT_TOKEN':
          this.exit(action.tokenIndex);
          break;
        case 'MOVE_COMBINED':
          this.moveCombined(action.tokenId);
          break;
        case 'MOVE_SPLIT':
          this.moveSplit(action.tokenA, action.squaresA, action.tokenB, action.squaresB);
          break;
        case 'SOPLAR':
          this.soplar(action.targetTokenId);
          break;
        case 'SKIP':
          this.skip();
          break;
      }
    }

    return this.state;
  }

  reset(players: { id: string; name: string }[], houseRules?: HouseRules): void {
    this.diceEngine = new DiceEngine();
    const turnOrder: PlayerColor[] = [COLORS[0], COLORS[1], COLORS[2], COLORS[3]];
    const tokens: EngineToken[] = [];
    for (let p = 0; p < players.length; p++) {
      const color = turnOrder[p];
      for (let i = 0; i < 4; i++) {
        tokens.push({
          id: `${color[0].toLowerCase()}${i + 1}`,
          color,
          index: i,
          position: -1 as BoardPosition,
          state: 'JAIL',
          totalSteps: 0,
        });
      }
    }

    this.state = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      roomId: this.state.roomId,
      phase: 'PLAYING',
      players: players.map((p, i) => ({
        id: p.id,
        color: turnOrder[i],
        name: p.name,
        isHost: i === 0,
        isConnected: true,
      })),
      tokens,
      currentPlayerIndex: 0,
      turnOrder,
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
      houseRules: houseRules || DEFAULT_HOUSE_RULES,
    };
  }
}
