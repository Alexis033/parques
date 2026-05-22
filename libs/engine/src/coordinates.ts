// Auto-generated from tablero.svg — DO NOT EDIT DIRECTLY
import type { BoardPosition, Coordinate } from '@parchis/shared';
import { BOARD_SIZE, CIRCUIT_SIZE, CIELO_SIZE, JAIL_SIZE } from '@parchis/shared';

export const VIEWBOX_SIZE = 1920;

// ---- Raw pixel positions (in the SVG 1920×1920 coordinate space) ----

const CCT_COORDS: [number, number][] = [
  [960, 1407.4],
  [960, 1486.2],
  [960, 1564.9],
  [960, 1643.7],
  [960, 1722.4],
  [960, 1801.2],
  [960, 1879.9],
  [1210, 1879.9],
  [1210, 1801.2],
  [1210, 1722.4],
  [1210, 1643.7],
  [1210, 1564.9],
  [1564.9, 1210],
  [1643.7, 1210],
  [1722.4, 1210],
  [1801.2, 1210],
  [1879.9, 1210],
  [960, 512.6],
  [960, 433.8],
  [960, 355.1],
  [960, 276.3],
  [960, 197.6],
  [960, 118.8],
  [960, 40.1],
  [710, 40.1],
  [710, 118.8],
  [710, 197.6],
  [710, 276.3],
  [710, 355.1],
  [355.1, 710],
  [276.3, 710],
  [197.6, 710],
  [118.8, 710],
  [40.1, 710],
  [1407.4, 960],
  [1486.2, 960],
  [1564.9, 960],
  [1643.7, 960],
  [1722.4, 960],
  [1801.2, 960],
  [1879.9, 960],
  [1879.9, 710],
  [1801.2, 710],
  [1722.4, 710],
  [1643.7, 710],
  [1564.9, 710],
  [1210, 355.1],
  [1210, 276.3],
  [1210, 197.6],
  [1210, 118.8],
  [1210, 40.1],
  [512.6, 960],
  [433.8, 960],
  [355.1, 960],
  [276.3, 960],
  [197.6, 960],
  [118.8, 960],
  [40.1, 960],
  [40.1, 1210],
  [118.8, 1210],
  [197.6, 1210],
  [276.3, 1210],
  [355.1, 1210],
  [710, 1564.9],
  [710, 1643.7],
  [710, 1722.4],
  [710, 1801.2],
  [710, 1879.9],
];

const CIELO_COORDS: [number, number][] = [
  [885.8, 1213.5],
  [811.6, 1098.3],
  [737.3, 983.1],
  [663.1, 867.9],
  [588.9, 752.8],
  [514.7, 637.6],
  [440.4, 522.4],
  [366.2, 407.2],
  [1034.1, 558],
  [1108.2, 524.8],
  [1182.3, 491.5],
  [1256.4, 458.3],
  [1330.6, 425],
  [1404.7, 391.8],
  [1478.8, 358.5],
  [1552.9, 325.3],
  [1361.8, 1034.1],
  [1395, 1108.2],
  [1428.1, 1182.3],
  [1461.3, 1256.4],
  [1494.4, 1330.6],
  [1527.6, 1404.7],
  [1560.7, 1478.8],
  [1593.9, 1552.9],
  [558, 1034.1],
  [524.8, 1108.2],
  [491.5, 1182.3],
  [458.3, 1256.4],
  [425, 1330.6],
  [391.8, 1404.7],
  [358.5, 1478.8],
  [325.3, 1552.9],
];

const JAIL_COORDS: [number, number][] = [
  [1547, 1547],
  [372, 372],
  [1547, 372],
  [372, 1547],
];

const ALL_COORDS: [number, number][] = (() => {
  const arr: [number, number][] = [];
  for (let i = 0; i < CCT_COORDS.length; i++) arr.push(CCT_COORDS[i]);
  for (let i = 0; i < CIELO_COORDS.length; i++) arr.push(CIELO_COORDS[i]);
  for (let i = 0; i < JAIL_COORDS.length; i++) arr.push(JAIL_COORDS[i]);
  return arr;
})();

export function getCoordinates(pos: BoardPosition): Coordinate {
  if (pos < 0 || pos >= BOARD_SIZE) return { x: 0, y: 0 };
  const [x, y] = ALL_COORDS[pos];
  return { x, y };
}

export function getSquareAtPoint(px: number, py: number): BoardPosition {
  let bestPos: BoardPosition = 0;
  let bestDist = Infinity;
  for (let i = 0; i < ALL_COORDS.length; i++) {
    const [x, y] = ALL_COORDS[i];
    const dx = px - x;
    const dy = py - y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) { bestDist = dist; bestPos = i as BoardPosition; }
  }
  return bestPos;
}
