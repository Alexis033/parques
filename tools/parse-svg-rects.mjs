/**
 * Parse SVG rectangle paths from tablero.svg — CORRECTED matrix multiply order.
 * Returns 68 circuit + 32 cielo + 4 jail positions per the game model.
 * 
 * Run: node tools/parse-svg-rects.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const svg = readFileSync(join(import.meta.dirname, 'tablero.svg'), 'utf-8');

// ---- Matrix helpers (correct order: [a,b,c,d,e,f]) ----
function identity() { return [1,0,0,1,0,0]; }
function translate(tx, ty) { return [1,0,0,1,tx,ty]; }
function multiply(m1, m2) {
  const [a1,b1,c1,d1,e1,f1] = m1;
  const [a2,b2,c2,d2,e2,f2] = m2;
  return [
    a1*a2 + c1*b2,     // a
    b1*a2 + d1*b2,     // b
    a1*c2 + c1*d2,     // c
    b1*c2 + d1*d2,     // d
    a1*e2 + c1*f2 + e1, // e
    b1*e2 + d1*f2 + f1, // f
  ];
}
function applyMat(m, [x, y]) {
  const [a,b,c,d,e,f] = m;
  return [a*x + c*y + e, b*x + d*y + f];
}
function parseTransform(attr) {
  if (!attr) return identity();
  let m = identity();
  const tMatch = attr.match(/translate\(([^)]+)\)/);
  if (tMatch) {
    const parts = tMatch[1].split(',').map(parseFloat);
    m = multiply(m, translate(parts[0], parts[1] || 0));
  }
  const matMatch = attr.match(/matrix\(([^)]+)\)/);
  if (matMatch) {
    const parts = matMatch[1].split(',').map(parseFloat);
    m = multiply(m, [parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]]);
  }
  return m;
}

// ---- Parse SVG path d attribute into rectangles ----
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
  
  let penX = 0, penY = 0;
  let firstSubpath = true;
  
  for (const sp of subpaths) {
    const afterM = sp.substring(1, sp.indexOf('z')).trim();
    const tokens = afterM.split(/[\s,]+/).filter(t => t.length > 0);
    if (tokens.length < 6) continue;
    
    const mdx = parseFloat(tokens[0]);
    const mdy = parseFloat(tokens[1]);
    
    let startX, startY;
    if (firstSubpath) {
      startX = mdx; startY = mdy;
    } else {
      startX = penX + mdx; startY = penY + mdy;
    }
    
    let cx = startX, cy = startY;
    const points = [[cx, cy]];
    
    for (let j = 2; j + 1 < tokens.length; j += 2) {
      cx += parseFloat(tokens[j]);
      cy += parseFloat(tokens[j+1]);
      points.push([cx, cy]);
    }
    
    penX = startX; penY = startY;
    
    if (points.length >= 4) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [px, py] of points) {
        if (px < minX) minX = px; if (py < minY) minY = py;
        if (px > maxX) maxX = px; if (py > maxY) maxY = py;
      }
      if (maxX - minX > 0 && maxY - minY > 0) {
        rects.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
      }
    }
    firstSubpath = false;
  }
  return rects;
}

// ---- Extract paths from group by name ----
function extractRectsFromGroup(groupName) {
  const groupRegex = new RegExp(`<g[^>]*?id="` + groupName + `"[^>]*?>([\\s\\S]*?)</g>`, 'i');
  const match = svg.match(groupRegex);
  if (!match) { return []; }
  const content = match[1];
  const parts = content.split(/\sd="/);
  const results = [];
  
  for (let p = 1; p < parts.length; p++) {
    const quoteIdx = parts[p].indexOf('"');
    if (quoteIdx === -1) continue;
    const dValue = parts[p].substring(0, quoteIdx);
    if (dValue.length > 0 && dValue.includes('m ')) {
      try {
        const rects = parseRectPath(dValue);
        for (const r of rects) results.push(r);
      } catch (e) { /* skip */ }
    }
  }
  return results;
}

// ---- Configuration ----
const g4710 = parseTransform('translate(0,17.8139)');

const groups = {
  azul:     { transform: identity(),                  color: 'RED' },
  rojo:     { transform: [-1,0,0,-1,1920,1884.3722],  color: 'BLUE' },
  verde:    { transform: [0,1,-1,0,1902.1861,-17.8139], color: 'YELLOW' },
  amarillo: { transform: [0,-1,1,0,17.8139,1902.1861], color: 'GREEN' },
};

// ---- Print all rects ----
for (const [name, def] of Object.entries(groups)) {
  console.log(`\n========== ${name} (${def.color}) ==========`);
  const rects = extractRectsFromGroup(name);
  const fullTransform = multiply(g4710, def.transform);
  console.log(`Found ${rects.length} rects. Full transform: [${fullTransform}]`);
  
  // Filter to rects > 100px² (exclude curve artifacts)
  const bigRects = rects.filter(r => r.w * r.h > 10000);
  console.log(`Large rects (area > 10000): ${bigRects.length}`);
  
  bigRects.forEach((r, i) => {
    const [gx, gy] = applyMat(fullTransform, [r.cx, r.cy]);
    const [gx1, gy1] = applyMat(fullTransform, [r.x, r.y]);
    console.log(`  ${i}: center=(${gx.toFixed(1)}, ${gy.toFixed(1)}) size=${r.w.toFixed(0)}×${r.h.toFixed(0)}`);
  });
}
