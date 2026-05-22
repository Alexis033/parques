import {
  type BoardPosition,
  type PlayerColor,
  type DiceRoll,
  CIRCUIT_SIZE,
} from '@parchis/shared';
import {
  EXIT_POSITIONS,
  CIELO_ENTRANCES,
  CIELO_START,
  CIELO_END,
} from './board';
import {
  type EngineState,
  type EngineToken,
  type TurnPhase,
  type GameActionRecord,
} from './engine-types';
import {
  calculateCircuitAdvance,
  isCapturePosition,
  getMostAdvancedToken,
} from './movement';
import {
  canExitJail,
  getMoveActions,
  getSoplarActions,
  checkParques,
  isLastTokenMode,
  shouldHaveExtraTurn,
  getCurrentPlayerColor,
  getPlayerTokens,
} from './rules';

function produce(state: EngineState, recipe: (draft: EngineState) => void): EngineState {
  const draft = structuredClone(state);
  recipe(draft);
  return draft;
}

function checkAllCrownedForPlayer(tokens: EngineToken[], color: PlayerColor): boolean {
  const colorTokens = tokens.filter((t) => t.color === color);
  return colorTokens.length === 4 && colorTokens.every((t) => t.state === 'CROWNED');
}

function advanceToNextPlayer(state: EngineState): void {
  const totalPlayers = state.turnOrder.length;
  for (let offset = 1; offset <= totalPlayers; offset++) {
    const nextIndex = (state.currentPlayerIndex + offset) % totalPlayers;
    const color = state.turnOrder[nextIndex];
    if (!checkAllCrownedForPlayer(state.tokens, color)) {
      state.currentPlayerIndex = nextIndex;
      return;
    }
  }
  // Fallback: if everyone is crowned (shouldn't happen, game would be over)
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % totalPlayers;
}

function roundVictoryCheck(state: EngineState): void {
  for (const color of state.turnOrder) {
    if (checkAllCrownedForPlayer(state.tokens, color)) {
      state.winner = color;
      state.phase = 'FINISHED';
      return;
    }
  }
}

export function rollDice(state: EngineState, roll: DiceRoll): EngineState {
  const color = getCurrentPlayerColor(state);

  const newState = produce(state, (draft) => {
    draft.currentRoll = roll;
    draft.consecutivePairs = roll.isPair ? draft.consecutivePairs + 1 : 0;
    draft.actions.push({
      type: 'ROLL',
      playerId: color,
      timestamp: Date.now(),
      roll,
    });

    if (roll.isPair) {
      draft.extraTurnsRemaining = 1;
    }

    if (getPlayerTokens(draft, color).every((t) => t.state === 'JAIL')) {
      draft.rollAttempts++;
    }

    if (roll.isParques) {
      const mostAdvanced = getMostAdvancedToken(draft.tokens, color);
      if (mostAdvanced) {
        draft.tokens = draft.tokens.map((t) => {
          if (t.id === mostAdvanced.id) {
            return { ...t, state: 'CROWNED' as const, position: CIELO_END[color] as BoardPosition };
          }
          return t;
        });
        draft.actions.push({
          type: 'PARQUES_CROWN',
          playerId: color,
          timestamp: Date.now(),
          tokenId: mostAdvanced.id,
        });
      }
      draft.turnPhase = 'TURN_END';
      return;
    }

    if (roll.isPair && canExitJail(draft)) {
      draft.turnPhase = 'SELECT_TOKEN';
    } else {
      const moveActions = getMoveActions(draft);
      if (moveActions.some((a) => a.type === 'MOVE_COMBINED' || a.type === 'MOVE_SPLIT')) {
        draft.turnPhase = 'MOVE';
      } else {
        draft.turnPhase = 'TURN_END';
      }
    }
  });

  return newState;
}

export function exitToken(state: EngineState, tokenIndex: number): EngineState {
  const color = getCurrentPlayerColor(state);
  const exitPos = EXIT_POSITIONS[color];

  return produce(state, (draft) => {
    draft.tokens = draft.tokens.map((t) => {
      if (t.color === color && t.index === tokenIndex && t.state === 'JAIL') {
        return {
          ...t,
          position: exitPos as BoardPosition,
          state: 'IN_TRANSIT' as const,
          totalSteps: 0,
        };
      }
      return t;
    });

    if (draft.houseRules.patearSeguroSalida) {
      const patearTargets = draft.tokens.filter(
        (t) => t.color !== color && t.state === 'IN_TRANSIT' && t.position === exitPos,
      );
      draft.tokens = draft.tokens.map((t) => {
        if (patearTargets.some((pt) => pt.id === t.id)) {
          return {
            ...t,
            position: -1 as BoardPosition,
            state: 'JAIL' as const,
            totalSteps: 0,
          };
        }
        return t;
      });
    }

    draft.actions.push({
      type: 'EXIT_TOKEN',
      playerId: color,
      timestamp: Date.now(),
      tokenIndex,
    });

    const allInJail = getPlayerTokens(draft, color).every((t) => t.state === 'JAIL');
    if (!allInJail) {
      draft.rollAttempts = 0;
    }

    const moveActions = getMoveActions(draft);
    if (moveActions.some((a) => a.type === 'MOVE_COMBINED' || a.type === 'MOVE_SPLIT')) {
      draft.turnPhase = 'MOVE';
    } else {
      draft.turnPhase = 'TURN_END';
    }
  });
}

export function moveToken(state: EngineState, tokenId: string, squares: number): EngineState {
  const color = getCurrentPlayerColor(state);
  const token = state.tokens.find((t) => t.id === tokenId);
  if (!token) return state;

  const movement = calculateCircuitAdvance(token.position, squares, token.totalSteps, color);
  if (!movement) return state;

  return produce(state, (draft) => {
    const captureTarget = isCapturePosition(movement.position, color, draft.tokens);

    draft.tokens = draft.tokens.map((t) => {
      if (t.id === tokenId && t.color === color) {
        const newState = movement.crowned ? 'CROWNED' as const
          : movement.enteredCielo ? 'IN_SKY' as const
          : 'IN_TRANSIT' as const;
        return {
          ...t,
          position: movement.position,
          state: newState,
          totalSteps: movement.totalSteps,
        };
      }
      return t;
    });

    draft.actions.push({
      type: 'MOVE_TOKEN',
      playerId: color,
      timestamp: Date.now(),
      tokenId,
      squares,
      from: token.position,
      to: movement.position,
    });

    if (captureTarget) {
      draft.tokens = draft.tokens.map((t) => {
        if (t.id === captureTarget.id) {
          return {
            ...t,
            position: -1 as BoardPosition,
            state: 'JAIL' as const,
            totalSteps: 0,
          };
        }
        return t;
      });

      draft.actions.push({
        type: 'CAPTURE',
        playerId: color,
        timestamp: Date.now(),
        tokenId,
        capturedTokenId: captureTarget.id,
        position: movement.position,
      });

      draft.missedCaptures = [
        ...draft.missedCaptures,
        {
          playerId: captureTarget.color,
          tokenId: captureTarget.id,
          capturedTokenId: tokenId,
          position: movement.position,
          turnNumber: draft.round,
        },
      ];
    }

    if (movement.crowned) {
      draft.actions.push({
        type: 'CROWN',
        playerId: color,
        timestamp: Date.now(),
        tokenId,
      });
    }

    const remainingActions = getMoveActions(draft);
    const hasMovesLeft = remainingActions.some(
      (a) => a.type === 'MOVE_COMBINED' || a.type === 'MOVE_SPLIT',
    );
    const hasSoplarLeft = remainingActions.some((a) => a.type === 'SOPLAR');

    if (hasMovesLeft || hasSoplarLeft) {
      draft.turnPhase = 'MOVE';
    } else {
      draft.turnPhase = 'TURN_END';
    }
  });
}

export function splitMove(
  state: EngineState,
  tokenA: string,
  squaresA: number,
  tokenB: string,
  squaresB: number,
): EngineState {
  let current = state;

  if (tokenA) {
    current = moveToken(current, tokenA, squaresA);
  }
  if (tokenB) {
    current = moveToken(current, tokenB, squaresB);
  }

  return current;
}

export function soplar(state: EngineState, targetTokenId: string): EngineState {
  const color = getCurrentPlayerColor(state);

  return produce(state, (draft) => {
    draft.tokens = draft.tokens.map((t) => {
      if (t.id === targetTokenId) {
        return {
          ...t,
          position: -1 as BoardPosition,
          state: 'JAIL' as const,
          totalSteps: 0,
        };
      }
      return t;
    });

    draft.missedCaptures = draft.missedCaptures.filter(
      (mc) => mc.tokenId !== targetTokenId,
    );

    draft.actions.push({
      type: 'SOPLAR',
      playerId: color,
      timestamp: Date.now(),
      targetTokenId,
      reportedBy: color,
    });

    const remainingActions = getMoveActions(draft);
    const hasMovesLeft = remainingActions.some(
      (a) => a.type === 'MOVE_COMBINED' || a.type === 'MOVE_SPLIT',
    );
    const hasSoplarLeft = remainingActions.some((a) => a.type === 'SOPLAR');

    if (hasMovesLeft || hasSoplarLeft) {
      draft.turnPhase = 'MOVE';
    } else {
      draft.turnPhase = 'TURN_END';
    }
  });
}

export function endTurn(state: EngineState): EngineState {
  const color = getCurrentPlayerColor(state);
  const roll = state.currentRoll;
  const hadExtraTurn = roll?.isPair === true && roll?.isParques !== true;
  const wasParques = roll?.isParques === true;

  return produce(state, (draft) => {
    draft.currentRoll = null;
    draft.rollAttempts = 0;

    draft.actions.push({
      type: 'TURN_END',
      playerId: color,
      timestamp: Date.now(),
    });

    const colorTokens = getPlayerTokens(draft, color);
    const isLastToken = isLastTokenMode(draft.tokens, color);

    if (isLastToken) {
      draft.isLastTokenMode = true;
    }

    if (wasParques) {
      draft.consecutivePairs = 0;
    }

    roundVictoryCheck(draft);

    if (draft.winner || draft.phase === 'FINISHED') {
      draft.turnPhase = 'TURN_END';
      draft.phase = 'FINISHED';
      return;
    }

    if (hadExtraTurn && draft.extraTurnsRemaining > 0 && !wasParques) {
      draft.extraTurnsRemaining--;
      draft.turnPhase = 'ROLL';
      return;
    }

    advanceToNextPlayer(draft);
    draft.turnPhase = 'ROLL';
    draft.round++;
    draft.extraTurnsRemaining = 0;
  });
}

export function getNextTurnPhase(state: EngineState): TurnPhase {
  if (state.phase === 'FINISHED') return 'TURN_END';
  return state.turnPhase;
}

export function canRoll(state: EngineState): boolean {
  return state.turnPhase === 'ROLL';
}

export function canSelectToken(state: EngineState): boolean {
  return state.turnPhase === 'SELECT_TOKEN';
}

export function canMove(state: EngineState): boolean {
  return state.turnPhase === 'MOVE';
}
