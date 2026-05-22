import {
  type BoardPosition,
  type PlayerColor,
  BOARD_SIZE,
  CIRCUIT_SIZE,
  CIELO_SIZE,
  JAIL_SIZE,
  COLORS,
  type SquareInfo,
} from '@parchis/shared';

export const EXIT_POSITIONS: Record<PlayerColor, BoardPosition> = {
  RED: 0,
  BLUE: 17,
  GREEN: 34,
  YELLOW: 51,
};

export const CIELO_ENTRANCES: Record<PlayerColor, BoardPosition> = {
  RED: 63,
  BLUE: 12,
  GREEN: 29,
  YELLOW: 46,
};

export const CIELO_START: Record<PlayerColor, BoardPosition> = {
  RED: 68,
  BLUE: 76,
  GREEN: 84,
  YELLOW: 92,
};

export const CIELO_END: Record<PlayerColor, BoardPosition> = {
  RED: 75,
  BLUE: 83,
  GREEN: 91,
  YELLOW: 99,
};

export const JAIL_POSITIONS: Record<PlayerColor, BoardPosition> = {
  RED: 100,
  BLUE: 101,
  GREEN: 102,
  YELLOW: 103,
};

export const SAFE_ZONES: Record<PlayerColor, BoardPosition[]> = {
  RED: [0, 7, 63],
  BLUE: [17, 24, 12],
  GREEN: [34, 41, 29],
  YELLOW: [51, 58, 46],
};

const allSafeZones = new Set<BoardPosition>();
for (const color of COLORS) {
  for (const pos of SAFE_ZONES[color]) {
    allSafeZones.add(pos);
  }
}

export const BOARD_LAYOUT: SquareInfo[] = Array.from({ length: BOARD_SIZE }, (_, i) => {
  if (i >= 100) {
    const color = COLORS[i - 100];
    return { id: i, type: 'JAIL', color };
  }
  for (const color of COLORS) {
    if (i >= CIELO_START[color] && i <= CIELO_END[color]) {
      return { id: i, type: 'CIELO', color };
    }
  }
  for (const color of COLORS) {
    if (EXIT_POSITIONS[color] === i) {
      return { id: i, type: 'EXIT', color };
    }
  }
  if (allSafeZones.has(i)) {
    const owner = COLORS.find((c) => SAFE_ZONES[c].includes(i));
    return { id: i, type: 'SAFE_ZONE', color: owner };
  }
  return { id: i, type: 'COMMON' };
});

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function getAdjacentSquares(position: BoardPosition, color: PlayerColor): BoardPosition[] {
  if (position >= 100) {
    const exitPos = EXIT_POSITIONS[color];
    return [exitPos];
  }

  const cieloStart = CIELO_START[color];
  const cieloEnd = CIELO_END[color];
  const cieloEntrance = CIELO_ENTRANCES[color];

  if (position >= cieloStart && position <= cieloEnd) {
    if (position === cieloEnd) {
      return [-1 as BoardPosition];
    }
    return [position + 1 as BoardPosition];
  }

  if (position === cieloEntrance) {
    return [cieloStart, mod(position + 1, CIRCUIT_SIZE) as BoardPosition];
  }

  const nextPos = mod(position + 1, CIRCUIT_SIZE) as BoardPosition;
  const prevPos = mod(position - 1, CIRCUIT_SIZE) as BoardPosition;
  return [prevPos, nextPos];
}

export function isSafeZone(position: BoardPosition): boolean {
  return allSafeZones.has(position);
}

export function getExitPosition(color: PlayerColor): BoardPosition {
  return EXIT_POSITIONS[color];
}

export function getCieloEntrance(color: PlayerColor): BoardPosition {
  return CIELO_ENTRANCES[color];
}

export function getJailPosition(color: PlayerColor): BoardPosition {
  return JAIL_POSITIONS[color];
}

export function getSquareInfo(position: BoardPosition): SquareInfo | undefined {
  return BOARD_LAYOUT[position];
}

export function getColorFromJailPosition(position: BoardPosition): PlayerColor | undefined {
  if (position >= 100 && position <= 103) {
    return COLORS[position - 100];
  }
  return undefined;
}

export function isInCielo(position: BoardPosition, color: PlayerColor): boolean {
  return position >= CIELO_START[color] && position <= CIELO_END[color];
}

export function isCoronation(position: BoardPosition, color: PlayerColor): boolean {
  return position === CIELO_END[color];
}
