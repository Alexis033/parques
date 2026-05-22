import { type PlayerColor, type BoardPosition, CIRCUIT_SIZE } from '@parchis/shared';
import {
  EXIT_POSITIONS,
  CIELO_ENTRANCES,
  CIELO_START,
  CIELO_END,
  isSafeZone,
} from './board';
import {
  type EngineState,
  type EngineToken,
  type ValidAction,
  type TurnPhase,
  LAST_TOKEN_MODE_THRESHOLD,
} from './engine-types';
import {
  calculateCircuitAdvance,
  validateMove,
  getExitableTokens,
  isCapturePosition,
} from './movement';

export function isLastTokenMode(tokens: EngineToken[], color: PlayerColor): boolean {
  const crowned = tokens.filter((t) => t.color === color && t.state === 'CROWNED').length;
  const active = tokens.filter(
    (t) => t.color === color && (t.state === 'IN_TRANSIT' || t.state === 'IN_SKY'),
  ).length;
  return crowned >= LAST_TOKEN_MODE_THRESHOLD && active === 1;
}

export function canExitJail(state: EngineState): boolean {
  const color = state.turnOrder[state.currentPlayerIndex];
  const roll = state.currentRoll;
  if (!roll) return false;
  if (!roll.isPair) return false;

  const jailTokens = state.tokens.filter(
    (t) => t.color === color && t.state === 'JAIL',
  );
  if (jailTokens.length === 0) return false;

  switch (state.houseRules.exitRule) {
    case 'ALL':
      return true;
    case 'TWO':
      return jailTokens.length >= 2;
    case 'CONDITIONAL':
      return roll.die1 === 1 || roll.die1 === 6;
    default:
      return true;
  }
}

export function canPatearOnExit(state: EngineState): boolean {
  if (!state.houseRules.patearSeguroSalida) return false;
  const color = state.turnOrder[state.currentPlayerIndex];
  const exitPos = EXIT_POSITIONS[color];
  const enemiesOnExit = state.tokens.filter(
    (t) => t.color !== color && t.state === 'IN_TRANSIT' && t.position === exitPos,
  );
  return enemiesOnExit.length > 0;
}

export function getExitActions(state: EngineState): ValidAction[] {
  if (!canExitJail(state)) return [];

  const color = state.turnOrder[state.currentPlayerIndex];
  const jailTokens = state.tokens.filter(
    (t) => t.color === color && t.state === 'JAIL',
  );

  if (jailTokens.length === state.tokens.filter((t) => t.color === color).length) {
    return jailTokens.map((t) => ({
      type: 'EXIT_TOKEN' as const,
      tokenIndex: t.index,
      description: `Exit token ${t.id} (${t.color}) from jail`,
    }));
  }

  if (state.houseRules.exitRule === 'ALL' || jailTokens.length >= 2) {
    return jailTokens.map((t) => ({
      type: 'EXIT_TOKEN' as const,
      tokenIndex: t.index,
      description: `Exit token ${t.id} (${t.color}) from jail`,
    }));
  }

  return [];
}

export function getMoveActions(state: EngineState): ValidAction[] {
  const roll = state.currentRoll;
  if (!roll) return [];

  const color = state.turnOrder[state.currentPlayerIndex];
  const activeTokens = state.tokens.filter(
    (t) => t.color === color && (t.state === 'IN_TRANSIT' || t.state === 'IN_SKY'),
  );
  const actions: ValidAction[] = [];

  if (state.isLastTokenMode) {
    for (const token of activeTokens) {
      const val = validateMove(token, roll.die1, color, state);
      if (val.valid) {
        actions.push({
          type: 'MOVE_COMBINED',
          tokenId: token.id,
          squares: roll.die1,
          description: `Move ${token.id} by ${roll.die1}`,
        });
      }
    }
    return actions;
  }

  const combinedTotal = roll.die1 + roll.die2;

  for (const token of activeTokens) {
    const val = validateMove(token, combinedTotal, color, state);
    if (val.valid) {
      actions.push({
        type: 'MOVE_COMBINED',
        tokenId: token.id,
        squares: combinedTotal,
        description: `Move ${token.id} by ${combinedTotal} (combined)`,
      });
    }
  }

  for (let i = 0; i < activeTokens.length; i++) {
    const valA = validateMove(activeTokens[i], roll.die1, color, state);
    if (valA.valid) {
      actions.push({
        type: 'MOVE_SPLIT',
        tokenA: activeTokens[i].id,
        squaresA: roll.die1,
        tokenB: '',
        squaresB: 0,
        description: `Move ${activeTokens[i].id} by ${roll.die1}`,
      });
    }
  }

  if (!roll.isPair) {
    for (let i = 0; i < activeTokens.length; i++) {
      const valB = validateMove(activeTokens[i], roll.die2, color, state);
      if (valB.valid) {
        actions.push({
          type: 'MOVE_SPLIT',
          tokenA: activeTokens[i].id,
          squaresA: roll.die2,
          tokenB: '',
          squaresB: 0,
          description: `Move ${activeTokens[i].id} by ${roll.die2}`,
        });
      }
    }
  } else {
    for (let i = 0; i < activeTokens.length; i++) {
      if (validateMove(activeTokens[i], roll.die1, color, state).valid) {
        for (let j = 0; j < activeTokens.length; j++) {
          if (i === j) continue;
          if (validateMove(activeTokens[j], roll.die2, color, state).valid) {
            actions.push({
              type: 'MOVE_SPLIT',
              tokenA: activeTokens[i].id,
              squaresA: roll.die1,
              tokenB: activeTokens[j].id,
              squaresB: roll.die2,
              description: `Split: ${activeTokens[i].id} by ${roll.die1}, ${activeTokens[j].id} by ${roll.die2}`,
            });
          }
        }
      }
    }
  }

  return actions;
}

export function getSoplarActions(state: EngineState): ValidAction[] {
  if (!state.houseRules.soplarCorrespondiente) return [];
  if (state.missedCaptures.length === 0) return [];

  const currentColor = state.turnOrder[state.currentPlayerIndex];
  return state.missedCaptures
    .filter((mc) => {
      const token = state.tokens.find((t) => t.id === mc.tokenId);
      return token && token.color !== currentColor;
    })
    .map((mc) => {
      const token = state.tokens.find((t) => t.id === mc.tokenId);
      return {
        type: 'SOPLAR' as const,
        targetTokenId: mc.tokenId,
        targetColor: token?.color ?? mc.playerId as PlayerColor,
        description: `Soplar ${mc.tokenId} for missing capture of ${mc.capturedTokenId}`,
      };
    });
}

export function getValidActions(state: EngineState): ValidAction[] {
  if (state.phase === 'FINISHED' || state.winner) return [];

  const actions: ValidAction[] = [];

  if (state.turnPhase === 'ROLL') {
    const color = state.turnOrder[state.currentPlayerIndex];
    const allInJail = state.tokens
      .filter((t) => t.color === color)
      .every((t) => t.state === 'JAIL');

    if (allInJail && state.rollAttempts < 3) {
      actions.push({ type: 'ROLL', description: 'Roll dice (attempt to get par to exit jail)' });
    } else if (!allInJail) {
      actions.push({ type: 'ROLL', description: 'Roll dice' });
    }

    return actions;
  }

  if (state.turnPhase === 'SELECT_TOKEN') {
    return getExitActions(state);
  }

  if (state.turnPhase === 'MOVE') {
    const moveActions = getMoveActions(state);
    const soplarActions = getSoplarActions(state);
    actions.push(...moveActions);
    actions.push(...soplarActions);
    if (moveActions.length === 0 && soplarActions.length === 0) {
      actions.push({ type: 'SKIP', description: 'No valid moves, end turn' });
    }
    return actions;
  }

  if (state.turnPhase === 'CAPTURE_RESOLVE') {
    return [];
  }

  if (state.turnPhase === 'TURN_END') {
    actions.push({ type: 'SKIP', description: 'End turn' });
    return actions;
  }

  return actions;
}

export function checkParques(state: EngineState): boolean {
  return state.consecutivePairs >= 3;
}

export function shouldHaveExtraTurn(state: EngineState): boolean {
  return state.currentRoll?.isPair === true && !state.currentRoll?.isParques;
}

export function isGameOver(state: EngineState): boolean {
  return state.winner !== null || state.phase === 'FINISHED';
}

export function getCurrentPlayerColor(state: EngineState): PlayerColor {
  return state.turnOrder[state.currentPlayerIndex];
}

export function getPlayerTokens(state: EngineState, color: PlayerColor): EngineToken[] {
  return state.tokens.filter((t) => t.color === color);
}
