import { readFileSync } from 'fs';
import { join } from 'path';
const svg = readFileSync(join(import.meta.dirname, 'tablero.svg'), 'utf-8');

function identity() { return [1,0,0,1,0,0]; }
function translate(tx, ty) { return [1,0,0,1,tx,ty]; }
function multiply(m1, m2) {
  const [a1,b1,c1,d1,e1,f1] = m1;
  const [a2,b2,c2,d2,e2,f2] = m2;
  return [
    a1*a2 + c1*b2,
    b1*a2 + d1*b2,
    a1*c2 + c1*d2,
    b1*c2 + d1*d2,
    a1*e2 + c1*f2 + e1,
    b1*e2 + d1*f2 + f1,
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

function parseRectPath(d) {
  const rects = [];
  let i = 0;
  while (i < d.length) {
    const mIdx = d.indexOf('m', i);
    if (mIdx === -1) break;
    const zIdx = d.indexOf('z', mIdx);
    if (zIdx === -1) break;
    const sp = d.substring(mIdx, zIdx + 1);
    i = zIdx + 1;
    
    const afterM = sp.substring(1, sp.indexOf('z')).trim();
    const tokens = afterM.split(/[\s,]+/).filter(t => t.length > 0);
    if (tokens.length < 6) continue;
    
    // rect parsing...
    let penX = 0, penY = 0;
    let firstSubpath = true;  // BUG: reset per path, but should be per d
    
    Hmm, wait — I'm resetting `firstSubpath` and `penX/penY` OUTSIDE the while loop! 
  }
}
