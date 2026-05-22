import type { BoardPosition, PlayerColor } from '@parchis/shared';

export interface CellGridPos {
  col: number;
  row: number;
}

export interface ZoneGridSpan {
  col: string;
  row: string;
}

/**
 * Circuit grid positions (engine positions 0-67).
 * Derived from the original grid.config.ts mapping where grid_pos = engine_pos + 1.
 */
const CIRCUIT_GRID: Record<number, CellGridPos> = {
  // Bottom strip: row 11, cols 1→8
  64: { col: 1, row: 11 },
  65: { col: 2, row: 11 },
  66: { col: 3, row: 11 },
  67: { col: 4, row: 11 },
  0:  { col: 5, row: 11 },
  1:  { col: 6, row: 11 },
  2:  { col: 7, row: 11 },
  3:  { col: 8, row: 11 },

  // Bottom strip right half: row 11, cols 12→19
  21: { col: 12, row: 11 },
  22: { col: 13, row: 11 },
  23: { col: 14, row: 11 },
  24: { col: 15, row: 11 },
  25: { col: 16, row: 11 },
  26: { col: 17, row: 11 },
  27: { col: 18, row: 11 },
  28: { col: 19, row: 11 },

  // Left column bottom: col 9, rows 12→19
  4:  { col: 9, row: 12 },
  5:  { col: 9, row: 13 },
  6:  { col: 9, row: 14 },
  7:  { col: 9, row: 15 },
  8:  { col: 9, row: 16 },
  9:  { col: 9, row: 17 },
  10: { col: 9, row: 18 },
  11: { col: 9, row: 19 },

  // Right column bottom: col 11, rows 19→12
  13: { col: 11, row: 19 },
  14: { col: 11, row: 18 },
  15: { col: 11, row: 17 },
  16: { col: 11, row: 16 },
  17: { col: 11, row: 15 },
  18: { col: 11, row: 14 },
  19: { col: 11, row: 13 },
  20: { col: 11, row: 12 },

  // Top strip left half: row 9, cols 1→8
  62: { col: 1, row: 9 },
  61: { col: 2, row: 9 },
  60: { col: 3, row: 9 },
  59: { col: 4, row: 9 },
  58: { col: 5, row: 9 },
  57: { col: 6, row: 9 },
  56: { col: 7, row: 9 },
  55: { col: 8, row: 9 },

  // Top strip right half: row 9, cols 12→19
  37: { col: 12, row: 9 },
  36: { col: 13, row: 9 },
  35: { col: 14, row: 9 },
  34: { col: 15, row: 9 },
  33: { col: 16, row: 9 },
  32: { col: 17, row: 9 },
  31: { col: 18, row: 9 },
  30: { col: 19, row: 9 },

  // Left column top: col 9, rows 1→8
  47: { col: 9, row: 1 },
  48: { col: 9, row: 2 },
  49: { col: 9, row: 3 },
  50: { col: 9, row: 4 },
  51: { col: 9, row: 5 },
  52: { col: 9, row: 6 },
  53: { col: 9, row: 7 },
  54: { col: 9, row: 8 },

  // Right column top: col 11, rows 1→8
  45: { col: 11, row: 1 },
  44: { col: 11, row: 2 },
  43: { col: 11, row: 3 },
  42: { col: 11, row: 4 },
  41: { col: 11, row: 5 },
  40: { col: 11, row: 6 },
  39: { col: 11, row: 7 },
  38: { col: 11, row: 8 },

  // Middle-edge safe cells
  46: { col: 10, row: 1 },
  63: { col: 1,  row: 10 },
  29: { col: 19, row: 10 },
  12: { col: 10, row: 19 },
};

/**
 * Cielo (home stretch) grid positions (engine positions 68-99).
 * Coronations (75, 83, 91, 99) go to the center goal — not mapped here.
 */
const CIELO_GRID: Record<number, CellGridPos> = {
  // RED cielo: row 10, cols 2→8 (comparten la fila central con la salida roja al lado)
  68: { col: 2, row: 10 },
  69: { col: 3, row: 10 },
  70: { col: 4, row: 10 },
  71: { col: 5, row: 10 },
  72: { col: 6, row: 10 },
  73: { col: 7, row: 10 },
  74: { col: 8, row: 10 },

  // BLUE cielo: col 10, rows 2→8
  76: { col: 10, row: 2 },
  77: { col: 10, row: 3 },
  78: { col: 10, row: 4 },
  79: { col: 10, row: 5 },
  80: { col: 10, row: 6 },
  81: { col: 10, row: 7 },
  82: { col: 10, row: 8 },

  // GREEN cielo: col 10, rows 12→18
  84: { col: 10, row: 12 },
  85: { col: 10, row: 13 },
  86: { col: 10, row: 14 },
  87: { col: 10, row: 15 },
  88: { col: 10, row: 16 },
  89: { col: 10, row: 17 },
  90: { col: 10, row: 18 },

  // YELLOW cielo: row 10, cols 18→12 (reverse order)
  92: { col: 18, row: 10 },
  93: { col: 17, row: 10 },
  94: { col: 16, row: 10 },
  95: { col: 15, row: 10 },
  96: { col: 14, row: 10 },
  97: { col: 13, row: 10 },
  98: { col: 12, row: 10 },
};

const ALL_GRID = new Map<BoardPosition, CellGridPos>();
for (const [pos, grid] of Object.entries(CIRCUIT_GRID)) ALL_GRID.set(Number(pos), grid);
for (const [pos, grid] of Object.entries(CIELO_GRID)) ALL_GRID.set(Number(pos), grid);

/** Get CSS Grid position for an engine position. Undefined for jail/coronation positions. */
export function getCellGridPosition(pos: BoardPosition): CellGridPos | undefined {
  return ALL_GRID.get(pos);
}

/** Player color grid — positions for each player's home zone */
export const ZONE_GRID: Record<string, ZoneGridSpan> = {
  RED:    { col: '1 / span 8',  row: '12 / span 8' },
  BLUE:   { col: '1 / span 8',  row: '1 / span 8'  },
  GREEN:  { col: '12 / span 8', row: '12 / span 8' },
  YELLOW: { col: '12 / span 8', row: '1 / span 8'  },
};

/** Center goal grid position */
export const GOAL_GRID: ZoneGridSpan = { col: '9 / span 3', row: '9 / span 3' };
