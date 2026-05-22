import {
  type BoardPosition,
  type PlayerColor,
  type DiceRoll,
  type GamePhase,
  type Player,
  type HouseRules,
  type TokenState,
} from '@parchis/shared';

export type TurnPhase = 'ROLL' | 'SELECT_TOKEN' | 'MOVE' | 'CAPTURE_RESOLVE' | 'TURN_END';

export interface EngineToken {
  id: string;
  color: PlayerColor;
  index: number;
  position: BoardPosition;
  state: TokenState;
  totalSteps: number;
}

export interface MissedCapture {
  playerId: string;
  tokenId: string;
  capturedTokenId: string;
  position: BoardPosition;
  turnNumber: number;
}

export interface EngineState {
  id: string;
  roomId: string;
  phase: GamePhase;
  players: Player[];
  tokens: EngineToken[];
  currentPlayerIndex: number;
  turnOrder: PlayerColor[];
  turnPhase: TurnPhase;
  round: number;
  currentRoll: DiceRoll | null;
  consecutivePairs: number;
  extraTurnsRemaining: number;
  isLastTokenMode: boolean;
  missedCaptures: MissedCapture[];
  rollAttempts: number;
  actions: GameActionRecord[];
  winner: PlayerColor | null;
  houseRules: HouseRules;
}

export interface RollAction {
  type: 'ROLL';
  playerId: string;
  timestamp: number;
  roll: DiceRoll;
}

export interface ExitTokenAction {
  type: 'EXIT_TOKEN';
  playerId: string;
  timestamp: number;
  tokenIndex: number;
}

export interface MoveTokenAction {
  type: 'MOVE_TOKEN';
  playerId: string;
  timestamp: number;
  tokenId: string;
  squares: number;
  from: BoardPosition;
  to: BoardPosition;
}

export interface SplitMoveAction {
  type: 'SPLIT_MOVE';
  playerId: string;
  timestamp: number;
  tokenA: string;
  squaresA: number;
  tokenB: string;
  squaresB: number;
}

export interface CaptureAction {
  type: 'CAPTURE';
  playerId: string;
  timestamp: number;
  tokenId: string;
  capturedTokenId: string;
  position: BoardPosition;
}

export interface CrownAction {
  type: 'CROWN';
  playerId: string;
  timestamp: number;
  tokenId: string;
}

export interface ParquesCrownAction {
  type: 'PARQUES_CROWN';
  playerId: string;
  timestamp: number;
  tokenId: string;
}

export interface SoplarAction {
  type: 'SOPLAR';
  playerId: string;
  timestamp: number;
  targetTokenId: string;
  reportedBy: string;
}

export interface ReturnToJailAction {
  type: 'RETURN_TO_JAIL';
  playerId: string;
  timestamp: number;
  tokenId: string;
}

export interface TurnEndAction {
  type: 'TURN_END';
  playerId: string;
  timestamp: number;
}

export type GameActionRecord =
  | RollAction
  | ExitTokenAction
  | MoveTokenAction
  | SplitMoveAction
  | CaptureAction
  | CrownAction
  | ParquesCrownAction
  | SoplarAction
  | ReturnToJailAction
  | TurnEndAction;

export interface ValidExitOption {
  type: 'EXIT_TOKEN';
  tokenIndex: number;
  description: string;
}

export interface ValidMoveCombined {
  type: 'MOVE_COMBINED';
  tokenId: string;
  squares: number;
  description: string;
}

export interface ValidMoveSplit {
  type: 'MOVE_SPLIT';
  tokenA: string;
  squaresA: number;
  tokenB: string;
  squaresB: number;
  description: string;
}

export interface ValidSoplar {
  type: 'SOPLAR';
  targetTokenId: string;
  targetColor: PlayerColor;
  description: string;
}

export interface ValidSkip {
  type: 'SKIP';
  description: string;
}

export type ValidAction =
  | { type: 'ROLL'; description: string }
  | ValidExitOption
  | ValidMoveCombined
  | ValidMoveSplit
  | ValidSoplar
  | ValidSkip;

export interface PlayerProgress {
  color: PlayerColor;
  tokensCrowned: number;
  cieloProgress: number;
  circuitProgress: number;
  rank: number;
}

export const LAST_TOKEN_MODE_THRESHOLD = 3;
