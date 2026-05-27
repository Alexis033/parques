export type BoardPosition = number;
export const BOARD_SIZE = 104;
export const CIRCUIT_SIZE = 68;
export const CIELO_SIZE = 8;
export const JAIL_SIZE = 4;
export const PLAYER_COUNT = 4;

export type PlayerColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';
export const COLORS: PlayerColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];

export type TokenState = 'JAIL' | 'IN_TRANSIT' | 'IN_SKY' | 'CROWNED';

export interface TokenStateData {
  id: string;
  color: PlayerColor;
  position: BoardPosition;
  state: TokenState;
}

export interface DiceRoll {
  die1: number;
  die2: number;
  isPair: boolean;
  isParques: boolean;
  timestamp: number;
}

export interface GameActionBase {
  type: string;
  playerId: string;
  timestamp: number;
}

export interface RollDiceAction extends GameActionBase {
  type: 'ROLL_DICE';
  roll: DiceRoll;
}

export interface MoveTokenAction extends GameActionBase {
  type: 'MOVE_TOKEN';
  tokenId: string;
  from: BoardPosition;
  to: BoardPosition;
  steps: number;
}

export interface CaptureTokenAction extends GameActionBase {
  type: 'CAPTURE_TOKEN';
  tokenId: string;
  capturedTokenId: string;
  position: BoardPosition;
}

export interface CrownTokenAction extends GameActionBase {
  type: 'CROWN_TOKEN';
  tokenId: string;
}

export interface ParquesCrownAction extends GameActionBase {
  type: 'PARQUES_CROWN';
  tokenId: string;
}

export interface ReturnToJailAction extends GameActionBase {
  type: 'RETURN_TO_JAIL';
  tokenId: string;
}

export interface SoplarAction extends GameActionBase {
  type: 'SOPLAR';
  tokenId: string;
  reportedBy: string;
}

export type GameAction =
  | RollDiceAction
  | MoveTokenAction
  | CaptureTokenAction
  | CrownTokenAction
  | ParquesCrownAction
  | ReturnToJailAction
  | SoplarAction;

export type GamePhase = 'WAITING' | 'PLAYING' | 'FINISHED';

export type GameStatus = 'WAITING' | 'PLAYING' | 'COMPLETED' | 'CANCELLED';

export interface Player {
  id: string;
  color: PlayerColor;
  name: string;
  isHost: boolean;
  isConnected: boolean;
}

export interface Room {
  id: string;
  code: string;
  players: Player[];
  maxPlayers: number;
  status: GameStatus;
  houseRules: HouseRules;
  createdAt: string;
}

export interface HouseRules {
  soplarCorrespondiente: boolean;
  patearSeguroSalida: boolean;
  exitRule: 'ALL' | 'TWO' | 'CONDITIONAL';
}

export const DEFAULT_HOUSE_RULES: HouseRules = {
  soplarCorrespondiente: true,
  patearSeguroSalida: false,
  exitRule: 'ALL',
};

export interface GameState {
  id: string;
  roomId: string;
  phase: GamePhase;
  players: Player[];
  tokens: TokenStateData[];
  currentPlayerIndex: number;
  turnOrder: PlayerColor[];
  round: number;
  actions: GameAction[];
  winner: PlayerColor | null;
  houseRules: HouseRules;
}

export interface TurnState {
  playerId: string;
  rollsRemaining: number;
  isLastTokenMode: boolean;
  consecutivePairs: number;
  rolls: DiceRoll[];
}

export type ExitRule = 'ALL' | 'TWO' | 'CONDITIONAL';

export interface PairRollResult {
  diceValue: number;
  totalRolls: number;
  tokensToExit: number;
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface SquareInfo {
  id: BoardPosition;
  type: 'COMMON' | 'SAFE_ZONE' | 'EXIT' | 'CIELO' | 'JAIL';
  color?: PlayerColor;
}
