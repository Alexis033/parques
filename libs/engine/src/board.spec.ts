import { describe, it, expect } from 'vitest';
import {
  getAdjacentSquares,
  isSafeZone,
  getExitPosition,
  getCieloEntrance,
  EXIT_POSITIONS,
  CIELO_ENTRANCES,
  SAFE_ZONES,
  CIELO_START,
  CIELO_END,
  JAIL_POSITIONS,
  isInCielo,
  isCoronation,
  getJailPosition,
  getColorFromJailPosition,
} from './board';

describe('Board topology', () => {
  describe('exit positions', () => {
    it('should define symmetric exits for all 4 colors', () => {
      expect(EXIT_POSITIONS.RED).toBe(0);
      expect(EXIT_POSITIONS.BLUE).toBe(17);
      expect(EXIT_POSITIONS.GREEN).toBe(34);
      expect(EXIT_POSITIONS.YELLOW).toBe(51);
    });

    it('should be evenly spaced by 17', () => {
      const exits = Object.values(EXIT_POSITIONS);
      for (let i = 1; i < exits.length; i++) {
        expect(exits[i] - exits[i - 1]).toBe(17);
      }
    });
  });

  describe('cielo entrances', () => {
    it('should be 5 squares before each exit (counter-clockwise)', () => {
      for (const color of ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const) {
        const expected = ((EXIT_POSITIONS[color] - 5) % 68 + 68) % 68;
        expect(CIELO_ENTRANCES[color]).toBe(expected);
      }
    });

    it('should define symmetric entrances', () => {
      expect(CIELO_ENTRANCES.RED).toBe(63);
      expect(CIELO_ENTRANCES.BLUE).toBe(12);
      expect(CIELO_ENTRANCES.GREEN).toBe(29);
      expect(CIELO_ENTRANCES.YELLOW).toBe(46);
    });
  });

  describe('safe zones', () => {
    it('should define 3 safe positions per player (exit, 7 after exit, cielo entrance)', () => {
      for (const color of ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const) {
        expect(SAFE_ZONES[color].length).toBe(3);
      }
    });

    it('should include exit, 7 squares after, and cielo entrance', () => {
      expect(SAFE_ZONES.RED).toEqual([0, 7, 63]);
      expect(SAFE_ZONES.BLUE).toEqual([17, 24, 12]);
      expect(SAFE_ZONES.GREEN).toEqual([34, 41, 29]);
      expect(SAFE_ZONES.YELLOW).toEqual([51, 58, 46]);
    });

    it('should have 12 unique safe zone positions (no overlap)', () => {
      const all = new Set<number>();
      for (const color of ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const) {
        for (const pos of SAFE_ZONES[color]) {
          all.add(pos);
        }
      }
      expect(all.size).toBe(12);
    });
  });

  describe('isSafeZone', () => {
    it('should return true for exit positions', () => {
      expect(isSafeZone(0)).toBe(true);
      expect(isSafeZone(17)).toBe(true);
      expect(isSafeZone(34)).toBe(true);
      expect(isSafeZone(51)).toBe(true);
    });

    it('should return true for safe squares after exit', () => {
      expect(isSafeZone(7)).toBe(true);
      expect(isSafeZone(24)).toBe(true);
      expect(isSafeZone(41)).toBe(true);
      expect(isSafeZone(58)).toBe(true);
    });

    it('should return true for cielo entrances', () => {
      expect(isSafeZone(63)).toBe(true);
      expect(isSafeZone(12)).toBe(true);
      expect(isSafeZone(29)).toBe(true);
      expect(isSafeZone(46)).toBe(true);
    });

    it('should return false for common squares', () => {
      expect(isSafeZone(8)).toBe(false);
      expect(isSafeZone(25)).toBe(false);
      expect(isSafeZone(42)).toBe(false);
      expect(isSafeZone(59)).toBe(false);
    });
  });

  describe('getExitPosition', () => {
    it('should return correct exit for each color', () => {
      expect(getExitPosition('RED')).toBe(0);
      expect(getExitPosition('BLUE')).toBe(17);
      expect(getExitPosition('GREEN')).toBe(34);
      expect(getExitPosition('YELLOW')).toBe(51);
    });
  });

  describe('getCieloEntrance', () => {
    it('should return correct entrance for each color', () => {
      expect(getCieloEntrance('RED')).toBe(63);
      expect(getCieloEntrance('BLUE')).toBe(12);
      expect(getCieloEntrance('GREEN')).toBe(29);
      expect(getCieloEntrance('YELLOW')).toBe(46);
    });
  });

  describe('getAdjacentSquares', () => {
    it('should return jail exit from jail', () => {
      const adj = getAdjacentSquares(100, 'RED');
      expect(adj).toEqual([0]);
    });

    it('should move clockwise on circuit for common squares', () => {
      const adj = getAdjacentSquares(8, 'RED');
      expect(adj).toContain(7);
      expect(adj).toContain(9);
    });

    it('should wrap around at circuit boundary (position 67)', () => {
      const adj = getAdjacentSquares(67, 'BLUE');
      expect(adj).toContain(66);
      expect(adj).toContain(0);
    });

    it('should include cielo square at entrance', () => {
      const adj = getAdjacentSquares(63, 'RED');
      expect(adj).toContain(68);
      expect(adj).toContain(64);
    });

    it('should progress through cielo squares', () => {
      expect(getAdjacentSquares(68, 'RED')).toEqual([69]);
      expect(getAdjacentSquares(69, 'RED')).toEqual([70]);
    });

    it('should return coronation at end of cielo', () => {
      const adj = getAdjacentSquares(75, 'RED');
      expect(adj).toEqual([-1]);
    });
  });

  describe('isInCielo / isCoronation', () => {
    it('should detect cielo positions', () => {
      expect(isInCielo(68, 'RED')).toBe(true);
      expect(isInCielo(75, 'RED')).toBe(true);
      expect(isInCielo(0, 'RED')).toBe(false);
    });

    it('should detect coronation', () => {
      expect(isCoronation(75, 'RED')).toBe(true);
      expect(isCoronation(83, 'BLUE')).toBe(true);
      expect(isCoronation(68, 'RED')).toBe(false);
    });
  });

  describe('jail positions', () => {
    it('should map colors to jail positions', () => {
      expect(getJailPosition('RED')).toBe(100);
      expect(getJailPosition('BLUE')).toBe(101);
      expect(getJailPosition('GREEN')).toBe(102);
      expect(getJailPosition('YELLOW')).toBe(103);
    });

    it('should reverse jail positions to colors', () => {
      expect(getColorFromJailPosition(100)).toBe('RED');
      expect(getColorFromJailPosition(101)).toBe('BLUE');
      expect(getColorFromJailPosition(102)).toBe('GREEN');
      expect(getColorFromJailPosition(103)).toBe('YELLOW');
    });
  });
});
