import { type PlayerColor } from '@parchis/shared';
import { type EngineState, type PlayerProgress } from './engine-types';
import { calculatePlayerProgress } from './movement';
import { getPlayerTokens } from './rules';

export function checkWinner(state: EngineState): PlayerColor | null {
  for (const color of state.turnOrder) {
    const tokens = getPlayerTokens(state, color);
    if (tokens.length > 0 && tokens.every((t) => t.state === 'CROWNED')) {
      return color;
    }
  }
  return null;
}

export function isGameComplete(state: EngineState): boolean {
  return state.winner !== null || state.phase === 'FINISHED';
}

export function getRankings(state: EngineState): PlayerProgress[] {
  const progressMap: PlayerProgress[] = [];

  for (const color of state.turnOrder) {
    const progress = calculatePlayerProgress(state.tokens, color);
    progressMap.push(progress);
  }

  progressMap.sort((a, b) => {
    if (a.tokensCrowned !== b.tokensCrowned) {
      return b.tokensCrowned - a.tokensCrowned;
    }
    if (a.cieloProgress !== b.cieloProgress) {
      return b.cieloProgress - a.cieloProgress;
    }
    return b.circuitProgress - a.circuitProgress;
  });

  return progressMap.map((p, i) => ({ ...p, rank: i + 1 }));
}

export function checkAllCrowned(state: EngineState, color: PlayerColor): boolean {
  const tokens = getPlayerTokens(state, color);
  return tokens.length > 0 && tokens.every((t) => t.state === 'CROWNED');
}

export function getLeadingPlayer(state: EngineState): PlayerColor | null {
  const rankings = getRankings(state);
  if (rankings.length === 0) return null;
  if (rankings[0].tokensCrowned === 4) return rankings[0].color;

  const tokens = getPlayerTokens(state, rankings[0].color);
  const allCrowned = tokens.length > 0 && tokens.every((t) => t.state === 'CROWNED');
  return allCrowned ? rankings[0].color : null;
}
