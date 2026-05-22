import { describe, it, expect } from 'vitest';
import {
  getCoordinates,
  getSquareAtPoint,
  VIEWBOX_SIZE,
} from './coordinates';
import { EXIT_POSITIONS, CIELO_START, CIELO_END, JAIL_POSITIONS } from './board';

describe('Coordinate map', () => {
  it('should define VIEWBOX_SIZE as 1920', () => {
    expect(VIEWBOX_SIZE).toBe(1920);
  });

  it('should return coordinates for exit positions', () => {
    const redExit = getCoordinates(EXIT_POSITIONS.RED);
    expect(redExit.x).toBeGreaterThan(0);
    expect(redExit.y).toBeGreaterThan(0);
    expect(redExit.x).toBeLessThan(VIEWBOX_SIZE);
    expect(redExit.y).toBeLessThan(VIEWBOX_SIZE);
  });

  it('should return coordinates for cielo positions', () => {
    const cieloStart = getCoordinates(CIELO_START.RED);
    expect(cieloStart.x).toBeGreaterThan(0);
    expect(cieloStart.y).toBeGreaterThan(0);
  });

  it('should return coordinates for jail positions', () => {
    const jail = getCoordinates(JAIL_POSITIONS.RED);
    expect(jail.x).toBeGreaterThan(0);
    expect(jail.y).toBeGreaterThan(0);
  });

  it('should return coordinates for all 104 positions', () => {
    for (let i = 0; i < 104; i++) {
      const coord = getCoordinates(i);
      expect(coord.x).toBeGreaterThanOrEqual(0);
      expect(coord.y).toBeGreaterThanOrEqual(0);
      expect(coord.x).toBeLessThanOrEqual(VIEWBOX_SIZE);
      expect(coord.y).toBeLessThanOrEqual(VIEWBOX_SIZE);
    }
  });

  it('reverse lookup should find closest position', () => {
    const coord = getCoordinates(0);
    const found = getSquareAtPoint(coord.x, coord.y);
    expect(found).toBe(0);
  });

  it('reverse lookup should work for any position', () => {
    for (let i = 0; i < 104; i++) {
      const coord = getCoordinates(i);
      const found = getSquareAtPoint(coord.x, coord.y);
      expect(found).toBe(i);
    }
  });

  it('should have different coordinates for different positions', () => {
    const c0 = getCoordinates(0);
    const c1 = getCoordinates(1);
    const same = c0.x === c1.x && c0.y === c1.y;
    expect(same).toBe(false);
  });

  it('should have coordinates within SVG viewBox', () => {
    for (let i = 0; i < 104; i++) {
      const { x, y } = getCoordinates(i);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1920);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1920);
    }
  });
});
