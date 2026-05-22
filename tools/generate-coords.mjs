/**
 * Generate coordinates.ts with SVG-derived positions for all 104 game squares.
 * Uses the correct rect order to match the Parqués circuit path.
 */
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync('tablero.svg', 'utf-8');

// ---- Matrix helpers ----
function identity() { return [1,0,0,1,0,0]; }
function translate(tx, ty) { return [1,0,0,1,tx,ty]; }
function multiply(m1, m2) {
  const [a1,b1,c1,d1,e1,f1] = m1;
  const [a2,b2,c2,d2,e2,f2] = m2;
  return [a1*a2 + c1*b2, b1*a2 + d1*b2, a1*c2 + c1*d2, b1*c2 + d1*d2, a1*e2 + c1*f2 + e1, b1*e2 + d1*f2 + f1];
}
function applyMat(m, [x, y]) {
  const [a,b,c,d,e,f] = m;
  return [a*x + c*y + e, b*x + d*y + f];
}
function parseTransform(attr) {
  if (!attr) return identity();
  let m = identity();
  const t = attr.match(/translate\(([^)]+)\)/);
  if (t) { const p = t[1].split(',').map(parseFloat); m = multiply(m, translate(p[0], p[1]||0)); }
  const mt = attr.match(/matrix\(([^)]+)\)/);
  if (mt) { const p = mt[1].split(',').map(parseFloat); m = multiply(m, [p[0],p[1],p[2],p[3],p[4],p[5]]); }
  return m;
}

// ---- Parse rects from group ----
function parseRectPath(d) {
  const rects = [];
  const subpaths = [];
  let i = 0;
  while (i < d.length) {
    const mIdx = d.indexOf('m', i);
    if (mIdx === -1) break;
    const zIdx = d.indexOf('z', mIdx);
    if (zIdx === -1) break;
    subpaths.push(d.substring(mIdx, zIdx + 1));
    i = zIdx + 1;
  }
  let penX = 0, penY = 0, first = true;
  for (const sp of subpaths) {
    const afterM = sp.substring(1, sp.indexOf('z')).trim();
    const tokens = afterM.split(/[\s,]+/).filter(t => t.length > 0);
    if (tokens.length < 6) continue;
    const mdx = parseFloat(tokens[0]), mdy = parseFloat(tokens[1]);
    const startX = first ? mdx : penX + mdx;
    const startY = first ? mdy : penY + mdy;
    let cx = startX, cy = startY;
    const pts = [[cx, cy]];
    for (let j = 2; j + 1 < tokens.length; j += 2) {
      cx += parseFloat(tokens[j]); cy += parseFloat(tokens[j+1]);
      pts.push([cx, cy]);
    }
    penX = startX; penY = startY;
    if (pts.length >= 4) {
      let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
      for (const [px,py] of pts) { if(px<mnX)mnX=px;if(py<mnY)mnY=py;if(px>mxX)mxX=px;if(py>mxY)mxY=py; }
      if (mxX-mnX > 0 && mxY-mnY > 0) {
        rects.push({ x:mnX, y:mnY, w:mxX-mnX, h:mxY-mnY, cx:(mnX+mxX)/2, cy:(mnY+mxY)/2 });
      }
    }
    first = false;
  }
  return rects;
}

function extractGlobalRects(groupName, groupTransform) {
  const gMatch = svg.match(new RegExp(`<g[^>]*?id="` + groupName + `"[^>]*?>([\\s\\S]*?)</g>`));
  if (!gMatch) return [];
  const content = gMatch[1];
  const parts = content.split(/\sd="/);
  const results = [];
  const g4710 = parseTransform('translate(0,17.8139)');
  const fullTransform = multiply(g4710, groupTransform);
  
  for (let p = 1; p < parts.length; p++) {
    const qi = parts[p].indexOf('"');
    if (qi === -1) continue;
    const dv = parts[p].substring(0, qi);
    if (!dv.includes('m ')) continue;
    const rects = parseRectPath(dv);
    for (const r of rects) {
      if (r.w * r.h > 10000) { // only large rects
        const [gx, gy] = applyMat(fullTransform, [r.cx, r.cy]);
        results.push({ x: gx, y: gy, w: r.w, h: r.h });
      }
    }
  }
  return results;
}

// ---- Get all 4 color rects ----
const groups = {
  azul:     { transform: identity(),                  color: 'RED' },
  rojo:     { transform: [-1,0,0,-1,1920,1884.3722],  color: 'BLUE' },
  verde:    { transform: [0,1,-1,0,1902.1861,-17.8139], color: 'YELLOW' },
  amarillo: { transform: [0,-1,1,0,17.8139,1902.1861], color: 'GREEN' },
};

// Circuit position order for each color (indices into the 18 rects)
// The path goes: exit column down → curve bottom → curve up → SALIDA → top row right
// rect 7 (first in exit column, above others) = CIELO entrance area
const CIRCUIT_ORDER = [0,1,2,3,4,5,6, 11, 10,9,8, 12, 17,13,14,15,16];

// CIELO path: 8 positions going from CIELO entrance (near rect 7) towards home
// For azul (RED), CIELO goes from (960, 1329) [near rect 7] towards top-left home center
// Home centers (each 584×584 quadrant):
// BLUE home: center=(292, 292)   — RED's cielo goes here
// GREEN home: center=(1627, 292)
// RED home: center=(1627, 1627)
// YELLOW home: center=(292, 1627)

const HOME_CENTERS = {
  RED:    { x: 292, y: 292 },     // BLUE quadrant (top-left) — RED cielo enters here
  BLUE:   { x: 1627, y: 292 },    // GREEN quadrant
  GREEN:  { x: 1627, y: 1627 },   // RED quadrant
  YELLOW: { x: 292, y: 1627 },    // YELLOW quadrant
};

const ALL_DATA = {};

for (const [name, def] of Object.entries(groups)) {
  const rects = extractGlobalRects(name, def.transform);
  
  if (rects.length !== 18) {
    console.error(`ERROR: ${name} has ${rects.length} rects, expected 18`);
    continue;
  }
  
  // Circuit positions (0-16)
  const circuitPositions = CIRCUIT_ORDER.map(idx => ({
    x: Math.round(rects[idx].x * 10) / 10,
    y: Math.round(rects[idx].y * 10) / 10,
  }));
  
  // CIELO entrance point (rect 7)
  const cieloEntrance = {
    x: Math.round(rects[7].x * 10) / 10,
    y: Math.round(rects[7].y * 10) / 10,
  };
  
  // Home center for this player's CIELO
  const homeCenter = HOME_CENTERS[def.color];
  
  // Generate 8 CIELO positions from entrance toward home center
  const cieloPositions = [];
  for (let i = 0; i < 8; i++) {
    const t = (i + 1) / 9; // slight offset so last is near center
    cieloPositions.push({
      x: Math.round((cieloEntrance.x + (homeCenter.x - cieloEntrance.x) * t) * 10) / 10,
      y: Math.round((cieloEntrance.y + (homeCenter.y - cieloEntrance.y) * t) * 10) / 10,
    });
  }
  
  // Jail position: center of home quadrant
  // For RED, jail is in RED's home (bottom-right)
  // Wait — each player's jail is in THEIR home, NOT in the quadrant their CIELO goes to
  // RED's home = bottom-right = (1627, 1627)
  // So RED's jail = (1627, 1627) area
  const JAIL_CENTERS = {
    RED:    { x: 1627, y: 1627 },   // RED home (bottom-right)
    BLUE:   { x: 292, y: 292 },     // BLUE home (top-left)
    GREEN:  { x: 1627, y: 292 },    // GREEN home (top-right)
    YELLOW: { x: 292, y: 1627 },    // YELLOW home (bottom-left)
  };
  
  // Offset jail slightly from exact center
  const jailCenter = JAIL_CENTERS[def.color];
  const jailPos = {
    x: Math.round((jailCenter.x + (def.color === 'RED' ? -80 : def.color === 'BLUE' ? 80 : def.color === 'GREEN' ? -80 : 80)) * 10) / 10,
    y: Math.round((jailCenter.y + (def.color === 'RED' ? -80 : def.color === 'BLUE' ? 80 : def.color === 'GREEN' ? 80 : -80)) * 10) / 10,
  };
  
  ALL_DATA[def.color] = { circuitPositions, cieloPositions, jail: jailPos, cieloEntrance };
  
  console.log(`\n=== ${def.color} (${name}) ===`);
  console.log(`Circuit (${circuitPositions.length}):`);
  circuitPositions.forEach((p, i) => console.log(`  ${i}: (${p.x}, ${p.y})`));
  console.log(`CIELO entrance: (${cieloEntrance.x}, ${cieloEntrance.y})`);
  console.log(`CIELO (${cieloPositions.length}):`);
  cieloPositions.forEach((p, i) => console.log(`  ${i}: (${p.x}, ${p.y})`));
  console.log(`JAIL: (${jailPos.x}, ${jailPos.y})`);
}

// ---- Generate TypeScript output ----
let ts = `// Auto-generated from tablero.svg — DO NOT EDIT DIRECTLY
import type { BoardPosition, Coordinate } from '@parchis/shared';
import { BOARD_SIZE, CIRCUIT_SIZE, CIELO_SIZE, JAIL_SIZE } from '@parchis/shared';

export const VIEWBOX_SIZE = 1920;

// ---- Raw pixel positions (in the SVG 1920×1920 coordinate space) ----

`;

// Circuit positions — 0 to 67
ts += `const CCT_COORDS: [number, number][] = [\n`;
const colorOrder = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
for (const color of colorOrder) {
  const data = ALL_DATA[color];
  for (const pos of data.circuitPositions) {
    ts += `  [${pos.x}, ${pos.y}],\n`;
  }
}
ts += `];\n\n`;

// CIELO positions — 68 to 99
ts += `const CIELO_COORDS: [number, number][] = [\n`;
for (const color of colorOrder) {
  const data = ALL_DATA[color];
  for (const pos of data.cieloPositions) {
    ts += `  [${pos.x}, ${pos.y}],\n`;
  }
}
ts += `];\n\n`;

// JAIL positions — 100 to 103
ts += `const JAIL_COORDS: [number, number][] = [\n`;
for (const color of colorOrder) {
  const data = ALL_DATA[color];
  ts += `  [${data.jail.x}, ${data.jail.y}],\n`;
}
ts += `];\n\n`;

// ALL_COORDS
ts += `const ALL_COORDS: [number, number][] = (() => {
  const arr: [number, number][] = [];
  for (let i = 0; i < CCT_COORDS.length; i++) arr.push(CCT_COORDS[i]);
  for (let i = 0; i < CIELO_COORDS.length; i++) arr.push(CIELO_COORDS[i]);
  for (let i = 0; i < JAIL_COORDS.length; i++) arr.push(JAIL_COORDS[i]);
  return arr;
})();\n\n`;

// getCoordinates
ts += `export function getCoordinates(pos: BoardPosition): Coordinate {
  if (pos < 0 || pos >= BOARD_SIZE) return { x: 0, y: 0 };
  const [x, y] = ALL_COORDS[pos];
  return { x, y };
}\n\n`;

// getSquareAtPoint
ts += `export function getSquareAtPoint(px: number, py: number): BoardPosition {
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
}\n`;

writeFileSync('libs/engine/src/coordinates.ts', ts);
console.log('\n\n✅ Wrote libs/engine/src/coordinates.ts');
