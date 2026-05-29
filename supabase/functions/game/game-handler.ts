// Self-contained game logic for Supabase Edge Function.
// Mirrors the engine in libs/engine but without @parchis/shared dependency.

export type PlayerColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';
export const COLORS: PlayerColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
export type BoardPosition = number;
export type TokenState = 'JAIL' | 'IN_TRANSIT' | 'IN_SKY' | 'CROWNED';
export type TurnPhase = 'ROLL' | 'SELECT_TOKEN' | 'MOVE' | 'CAPTURE_RESOLVE' | 'TURN_END';
export type GamePhase = 'WAITING' | 'PLAYING' | 'FINISHED';
export type GameStatus = 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface DiceRoll {
  die1: number;
  die2: number;
  isPair: boolean;
  isParques: boolean;
  timestamp: number;
}

export interface HouseRules {
  soplarCorrespondiente: boolean;
  patearSeguroSalida: boolean;
  exitRule: 'ALL' | 'TWO' | 'CONDITIONAL';
}

export interface Player {
  id: string;
  color: PlayerColor;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  clientId?: string;
  lastHeartbeat?: number;
}

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

export interface GameActionRecord {
  type: string;
  playerId: string;
  timestamp: number;
  [key: string]: unknown;
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

export interface GameRow {
  id: string;
  room_id: string;
  state: EngineState;
  version: number;
}

// ---- Board constants ----
const CIRCUIT_SIZE = 68;
const CIELO_SIZE = 8;
const BOARD_SIZE = 104;
const LAST_TOKEN_MODE_THRESHOLD = 3;

const EXIT_POSITIONS: Record<PlayerColor, BoardPosition> = {
  RED: 0, BLUE: 17, GREEN: 34, YELLOW: 51,
};
const CIELO_ENTRANCES: Record<PlayerColor, BoardPosition> = {
  RED: 63, BLUE: 12, GREEN: 29, YELLOW: 46,
};
const CIELO_START: Record<PlayerColor, BoardPosition> = {
  RED: 68, BLUE: 76, GREEN: 84, YELLOW: 92,
};
const CIELO_END: Record<PlayerColor, BoardPosition> = {
  RED: 75, BLUE: 83, GREEN: 91, YELLOW: 99,
};

const SAFE_ZONES: Record<PlayerColor, BoardPosition[]> = {
  RED: [0, 7, 63],
  BLUE: [17, 24, 12],
  GREEN: [34, 41, 29],
  YELLOW: [51, 58, 46],
};

function isSafeZone(pos: BoardPosition): boolean {
  for (const c of COLORS) {
    if (SAFE_ZONES[c].includes(pos)) return true;
  }
  return false;
}

function inCielo(pos: BoardPosition, color: PlayerColor): boolean {
  return pos >= CIELO_START[color] && pos <= CIELO_END[color];
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

// ---- Dice ----
export function rollDice(ltMode: boolean): DiceRoll {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return {
    die1: ltMode ? die1 : die1 + die2,
    die2: ltMode ? 0 : die2,
    isPair: !ltMode && die1 === die2,
    isParques: false, // determined in handleRoll via consecutivePairs
    timestamp: Date.now(),
  };
}

// ---- Movement ----
function calculateSteps(from: BoardPosition, steps: number, totalSteps: number, color: PlayerColor) {
  if (from < 0) return null;
  if (inCielo(from, color)) {
    const np = from + steps;
    if (np > CIELO_END[color]) return null;
    return { position: np, totalSteps: totalSteps + steps, crowned: np === CIELO_END[color] };
  }
  const entrance = CIELO_ENTRANCES[color];
  const cieloStepThreshold = 63;
  let cur = from;
  let rem = steps;
  let ts = totalSteps;
  while (rem > 0) {
    if (cur === entrance && ts >= cieloStepThreshold) {
      const cp = CIELO_START[color] + rem - 1;
      if (cp > CIELO_END[color]) return null;
      return { position: cp, totalSteps: ts + rem, crowned: cp === CIELO_END[color] };
    }
    cur = mod(cur + 1, CIRCUIT_SIZE);
    ts++;
    rem--;
  }
  return { position: cur, totalSteps: ts, crowned: false };
}

function isCapturePosition(pos: BoardPosition, color: PlayerColor, tokens: EngineToken[]) {
  if (pos >= 68 && pos <= 103) return null;
  if (isSafeZone(pos)) return null;
  for (const t of tokens) {
    if (t.color === color) continue;
    if (t.state !== 'IN_TRANSIT') continue;
    if (t.position === pos) return t;
  }
  return null;
}

// ---- Player helpers ----
function getCurrentColor(state: EngineState): PlayerColor {
  return state.turnOrder[state.currentPlayerIndex];
}

function getPlayerTokens(state: EngineState, color: PlayerColor): EngineToken[] {
  return state.tokens.filter((t) => t.color === color);
}

function allCrowned(tokens: EngineToken[], color: PlayerColor): boolean {
  const ct = tokens.filter((t) => t.color === color);
  return ct.length === 4 && ct.every((t) => t.state === 'CROWNED');
}

function checkWinner(state: EngineState): PlayerColor | null {
  for (const c of state.turnOrder) {
    if (allCrowned(state.tokens, c)) return c;
  }
  return null;
}

function advancePlayer(state: EngineState): void {
  const total = state.turnOrder.length;
  for (let o = 1; o <= total; o++) {
    const ni = (state.currentPlayerIndex + o) % total;
    if (!allCrowned(state.tokens, state.turnOrder[ni])) {
      state.currentPlayerIndex = ni;
      return;
    }
  }
}

function isLastTokenMode(tokens: EngineToken[], color: PlayerColor): boolean {
  const crowned = tokens.filter((t) => t.color === color && t.state === 'CROWNED').length;
  const active = tokens.filter((t) => t.color === color && (t.state === 'IN_TRANSIT' || t.state === 'IN_SKY')).length;
  return crowned >= LAST_TOKEN_MODE_THRESHOLD && active === 1;
}

function canExitJail(state: EngineState): boolean {
  const color = getCurrentColor(state);
  const roll = state.currentRoll;
  if (!roll || !roll.isPair) return false;
  const inJail = state.tokens.filter((t) => t.color === color && t.state === 'JAIL');
  if (inJail.length === 0) return false;
  switch (state.houseRules.exitRule) {
    case 'ALL': return true;
    case 'TWO': return inJail.length >= 2;
    case 'CONDITIONAL': return roll.die1 === 1 || roll.die1 === 6;
    default: return true;
  }
}

function validateMove(token: EngineToken, steps: number, color: PlayerColor, state: EngineState): boolean {
  if (token.state === 'CROWNED' || token.state === 'JAIL') return false;
  const result = calculateSteps(token.position, steps, token.totalSteps, color);
  return result !== null;
}

// ---- Handlers ----
export function createInitialState(
  gameId: string,
  roomId: string,
  players: Player[],
  houseRules: HouseRules,
): EngineState {
  const turnOrder: PlayerColor[] = players.map((p) => p.color);
  const tokens: EngineToken[] = [];
  for (const p of players) {
    for (let i = 0; i < 4; i++) {
      tokens.push({
        id: `${p.color[0].toLowerCase()}${i + 1}`,
        color: p.color,
        index: i,
        position: -1 as BoardPosition,
        state: 'JAIL',
        totalSteps: 0,
      });
    }
  }
  return {
    id: gameId,
    roomId,
    phase: 'PLAYING',
    players: players.map((p) => ({ ...p, isConnected: true })),
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
}

export function handleRoll(state: EngineState): EngineState {
  if (state.phase !== 'PLAYING' || state.turnPhase !== 'ROLL') return state;
  const color = getCurrentColor(state);
  const ltMode = isLastTokenMode(state.tokens, color);
  const roll = rollDice(ltMode);
  const next = structuredClone(state);
  next.currentRoll = roll;
  next.consecutivePairs = roll.isPair ? next.consecutivePairs + 1 : 0;
  next.actions.push({ type: 'ROLL', playerId: color, timestamp: Date.now(), roll });

  // Recompute isParques based on actual consecutive pair count
  const isParques = roll.isPair && next.consecutivePairs >= 3;
  next.currentRoll = { ...roll, isParques };

  if (roll.isPair && !isParques) next.extraTurnsRemaining = 1;

  // Jail: allow up to 3 attempts when all tokens in jail
  if (getPlayerTokens(next, color).every((t) => t.state === 'JAIL')) next.rollAttempts++;
  if (getPlayerTokens(next, color).every((t) => t.state === 'JAIL') && next.rollAttempts < 3 && !(roll.isPair && canExitJail(next))) {
    next.turnPhase = 'ROLL';
    return next;
  }

  if (isParques) {
    const advanced = [...next.tokens].filter((t) => t.color === color && (t.state === 'IN_TRANSIT' || t.state === 'IN_SKY'))
      .sort((a, b) => b.totalSteps - a.totalSteps);
    if (advanced.length > 0) {
      const top = advanced[0];
      next.tokens = next.tokens.map((t) =>
        t.id === top.id ? { ...t, state: 'CROWNED' as const, position: CIELO_END[color] } : t
      );
      next.actions.push({ type: 'PARQUES_CROWN', playerId: color, timestamp: Date.now(), tokenId: top.id });
    }
    next.turnPhase = 'TURN_END';
    return next;
  }
  if (roll.isPair && canExitJail(next)) {
    next.turnPhase = 'SELECT_TOKEN';
  } else {
    const hasMoves = next.tokens.some(
      (t) => t.color === color && (t.state === 'IN_TRANSIT' || t.state === 'IN_SKY') && validateMove(t, roll.die1, color, next),
    );
    next.turnPhase = hasMoves ? 'MOVE' : 'TURN_END';
  }
  return next;
}

export function handleExit(state: EngineState, tokenId: string): EngineState {
  if (state.phase !== 'PLAYING' || state.turnPhase !== 'SELECT_TOKEN') return state;
  const color = getCurrentColor(state);
  const token = state.tokens.find((t) => t.id === tokenId && t.color === color && t.state === 'JAIL');
  if (!token) return state;
  const next = structuredClone(state);
  const exitPos = EXIT_POSITIONS[color];
  next.tokens = next.tokens.map((t) =>
    t.id === tokenId ? { ...t, position: exitPos, state: 'IN_TRANSIT' as const, totalSteps: 0 } : t
  );
  if (next.houseRules.patearSeguroSalida) {
    next.tokens = next.tokens.map((t) => {
      if (t.color !== color && t.state === 'IN_TRANSIT' && t.position === exitPos) {
        return { ...t, position: -1 as BoardPosition, state: 'JAIL' as const, totalSteps: 0 };
      }
      return t;
    });
  }
  next.actions.push({ type: 'EXIT_TOKEN', playerId: color, timestamp: Date.now(), tokenIndex: token.index });
  next.rollAttempts = 0;
  const hasMoves = next.tokens.some(
    (t) => t.color === color && (t.state === 'IN_TRANSIT' || t.state === 'IN_SKY'),
  );
  next.turnPhase = hasMoves ? 'MOVE' : 'TURN_END';
  return next;
}

export function handleMove(state: EngineState, tokenId: string, squares: number): EngineState {
  if (state.phase !== 'PLAYING' || state.turnPhase !== 'MOVE') return state;
  const color = getCurrentColor(state);
  const token = state.tokens.find((t) => t.id === tokenId && t.color === color);
  if (!token || token.state === 'JAIL' || token.state === 'CROWNED') return state;
  const movement = calculateSteps(token.position, squares, token.totalSteps, color);
  if (!movement) return state;
  const next = structuredClone(state);
  const captureTarget = isCapturePosition(movement.position, color, next.tokens);
  next.tokens = next.tokens.map((t) => {
    if (t.id === tokenId) {
      const newState = movement.crowned ? 'CROWNED' as const
        : inCielo(movement.position, color) ? 'IN_SKY' as const
        : 'IN_TRANSIT' as const;
      return { ...t, position: movement.position, state: newState, totalSteps: movement.totalSteps };
    }
    return t;
  });
  next.actions.push({ type: 'MOVE_TOKEN', playerId: color, timestamp: Date.now(), tokenId, squares, from: token.position, to: movement.position });
  if (captureTarget) {
    next.tokens = next.tokens.map((t) =>
      t.id === captureTarget.id
        ? { ...t, position: -1 as BoardPosition, state: 'JAIL' as const, totalSteps: 0 }
        : t
    );
    next.actions.push({ type: 'CAPTURE', playerId: color, timestamp: Date.now(), tokenId, capturedTokenId: captureTarget.id, position: movement.position });
    next.missedCaptures = [...next.missedCaptures, {
      playerId: captureTarget.color, tokenId: captureTarget.id, capturedTokenId: tokenId,
      position: movement.position, turnNumber: next.round,
    }];
  }
  if (movement.crowned) {
    next.actions.push({ type: 'CROWN', playerId: color, timestamp: Date.now(), tokenId });
  }
  const hasMoves = next.tokens.some(
    (t) => t.color === color && (t.state === 'IN_TRANSIT' || t.state === 'IN_SKY') && validateMove(t, squares, color, next),
  );
  next.turnPhase = hasMoves ? 'MOVE' : 'TURN_END';
  return next;
}

export function handleEndTurn(state: EngineState): EngineState {
  if (state.phase !== 'PLAYING') return state;
  const color = getCurrentColor(state);
  const roll = state.currentRoll;
  const hadExtra = roll?.isPair === true && roll?.isParques !== true;
  const wasParques = roll?.isParques === true;
  const next = structuredClone(state);
  next.currentRoll = null;
  next.rollAttempts = 0;
  next.actions.push({ type: 'TURN_END', playerId: color, timestamp: Date.now() });
  if (wasParques) next.consecutivePairs = 0;
  // Check winner
  const winner = checkWinner(next);
  if (winner) {
    next.winner = winner;
    next.phase = 'FINISHED';
    next.turnPhase = 'TURN_END';
    return next;
  }
  if (hadExtra && next.extraTurnsRemaining > 0 && !wasParques) {
    next.extraTurnsRemaining--;
    next.turnPhase = 'ROLL';
    return next;
  }
  advancePlayer(next);
  next.turnPhase = 'ROLL';
  next.round++;
  next.extraTurnsRemaining = 0;
  return next;
}

export function handleSoplar(state: EngineState, targetTokenId: string): EngineState {
  if (state.phase !== 'PLAYING' || state.turnPhase !== 'MOVE') return state;
  const color = getCurrentColor(state);
  const target = state.tokens.find((t) => t.id === targetTokenId);
  if (!target || target.color === color) return state;
  if (!state.houseRules.soplarCorrespondiente) return state;
  const hasMissed = state.missedCaptures.some((mc) => mc.tokenId === targetTokenId);
  if (!hasMissed) return state;
  const next = structuredClone(state);
  next.tokens = next.tokens.map((t) =>
    t.id === targetTokenId
      ? { ...t, position: -1 as BoardPosition, state: 'JAIL' as const, totalSteps: 0 }
      : t
  );
  next.missedCaptures = next.missedCaptures.filter((mc) => mc.tokenId !== targetTokenId);
  next.actions.push({ type: 'SOPLAR', playerId: color, timestamp: Date.now(), targetTokenId, reportedBy: color });
  next.turnPhase = 'MOVE';
  return next;
}

// ---- Connection management ----

export function handleHeartbeat(state: EngineState, playerId: string): EngineState {
  const idx = state.players.findIndex(p => p.id === playerId);
  if (idx === -1) return state;
  const next = structuredClone(state);
  next.players = next.players.map((p, i) =>
    i === idx ? { ...p, isConnected: true, lastHeartbeat: Date.now() } : p
  );
  return next;
}

export function handleDisconnect(state: EngineState, playerId: string): EngineState {
  const idx = state.players.findIndex(p => p.id === playerId);
  if (idx === -1) return state;
  const next = structuredClone(state);
  next.players = next.players.map((p, i) =>
    i === idx ? { ...p, isConnected: false } : p
  );
  return next;
}

// ---- Rematch ----

export function handleRematch(state: EngineState, houseRules: HouseRules): EngineState {
  const newGameId = crypto.randomUUID();
  return createInitialState(newGameId, state.roomId, state.players, houseRules);
}
