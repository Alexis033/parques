import { type BoardPosition, type PlayerColor, CIRCUIT_SIZE } from '@parchis/shared';
import {
  EXIT_POSITIONS,
  CIELO_ENTRANCES,
  CIELO_START,
  CIELO_END,
  isInCielo,
  isSafeZone,
} from './board';
import { type EngineToken, type EngineState, type PlayerProgress } from './engine-types';

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export interface MovementResult {
  position: BoardPosition;
  totalSteps: number;
  enteredCielo: boolean;
  crowned: boolean;
}

export interface MoveValidation {
  valid: boolean;
  reason?: string;
}

export function calculateCircuitAdvance(
  from: BoardPosition,
  steps: number,
  startingTotalSteps: number,
  color: PlayerColor,
): MovementResult | null {
  const entrance = CIELO_ENTRANCES[color];
  const cieloStart = CIELO_START[color];
  const cieloEnd = CIELO_END[color];
  const circuitSize = CIRCUIT_SIZE;

  if (from < 0) return null;

  if (isInCielo(from, color)) {
    const newPos = from + steps;
    if (newPos > cieloEnd) return null;
    return {
      position: newPos as BoardPosition,
      totalSteps: startingTotalSteps + steps,
      enteredCielo: false,
      crowned: newPos === cieloEnd,
    };
  }

  let current = from;
  let remaining = steps;
  let totalSteps = startingTotalSteps;

  // Token enters cielo after 64 squares from exit (63 steps 0-indexed).
  // This is 5 squares before completing the full 68-square circuit.
  const cieloEntrySteps = 63;

  while (remaining > 0) {
    if (current === entrance && totalSteps >= cieloEntrySteps) {
      const cieloPos = cieloStart + remaining - 1;
      if (cieloPos > cieloEnd) return null;
      return {
        position: cieloPos as BoardPosition,
        totalSteps: totalSteps + remaining,
        enteredCielo: true,
        crowned: cieloPos === cieloEnd,
      };
    }

    current = mod(current + 1, circuitSize) as BoardPosition;
    totalSteps++;
    remaining--;
  }

  return {
    position: current,
    totalSteps,
    enteredCielo: false,
    crowned: false,
  };
}

export function isCapturePosition(
  position: BoardPosition,
  movingColor: PlayerColor,
  tokens: EngineToken[],
): EngineToken | null {
  if (position >= 68 && position <= 103) return null;
  if (isSafeZone(position)) return null;

  for (const token of tokens) {
    if (token.color === movingColor) continue;
    if (token.state !== 'IN_TRANSIT') continue;
    if (token.position === position) {
      return token;
    }
  }

  return null;
}

export function getCaptureTargets(
  tokenId: string,
  newPosition: BoardPosition,
  state: EngineState,
): EngineToken[] {
  const targets: EngineToken[] = [];
  const movingToken = state.tokens.find((t) => t.id === tokenId);
  if (!movingToken) return targets;

  if (newPosition >= 68 && newPosition <= 103) return targets;
  if (isSafeZone(newPosition)) return targets;

  for (const token of state.tokens) {
    if (token.color === movingToken.color) continue;
    if (token.state !== 'IN_TRANSIT') continue;
    if (token.position === newPosition) {
      targets.push(token);
    }
  }

  return targets;
}

export function checkCoronation(
  token: EngineToken,
  steps: number,
  color: PlayerColor,
  state: EngineState,
): boolean {
  const result = calculateCircuitAdvance(token.position, steps, token.totalSteps, color);
  if (!result) return false;
  return result.crowned;
}

export function validateMove(
  token: EngineToken,
  steps: number,
  color: PlayerColor,
  state: EngineState,
): MoveValidation {
  if (token.state === 'CROWNED') {
    return { valid: false, reason: 'Token already crowned' };
  }
  if (token.state === 'JAIL') {
    return { valid: false, reason: 'Token in jail, cannot move' };
  }

  const result = calculateCircuitAdvance(token.position, steps, token.totalSteps, color);
  if (!result) {
    return { valid: false, reason: 'Move overshoots coronation' };
  }

  return { valid: true };
}

export function getMostAdvancedToken(tokens: EngineToken[], color: PlayerColor): EngineToken | null {
  const playerTokens = tokens
    .filter((t) => t.color === color && (t.state === 'IN_TRANSIT' || t.state === 'IN_SKY'))
    .sort((a, b) => b.totalSteps - a.totalSteps);

  return playerTokens.length > 0 ? playerTokens[0] : null;
}

export function calculatePlayerProgress(
  tokens: EngineToken[],
  color: PlayerColor,
): PlayerProgress {
  const playerTokens = tokens.filter((t) => t.color === color);
  const crowned = playerTokens.filter((t) => t.state === 'CROWNED').length;
  const inSky = playerTokens.filter((t) => t.state === 'IN_SKY');
  const inTransit = playerTokens.filter((t) => t.state === 'IN_TRANSIT');

  let cieloProgress = 0;
  for (const t of inSky) {
    const progress = t.position - CIELO_START[color] + 1;
    if (progress > cieloProgress) cieloProgress = progress;
  }

  let circuitProgress = 0;
  for (const t of inTransit) {
    if (t.totalSteps > circuitProgress) circuitProgress = t.totalSteps;
  }

  return { color, tokensCrowned: crowned, cieloProgress, circuitProgress, rank: 0 };
}

export function getExitableTokens(state: EngineState): EngineToken[] {
  const playerColor = state.turnOrder[state.currentPlayerIndex];
  return state.tokens.filter(
    (t) => t.color === playerColor && t.state === 'JAIL',
  );
}
