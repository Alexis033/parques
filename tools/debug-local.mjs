import { readFileSync } from 'fs';
const svg = readFileSync('tablero.svg', 'utf-8');

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
  const rx = a*x + c*y + e;
  const ry = b*x + d*y + f;
  return [rx, ry];
}

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
      startX = mdx;
      startY = mdy;
    } else {
      startX = penX + mdx;
      startY = penY + mdy;
    }
    
    let cx = startX, cy = startY;
    const points = [[cx, cy]];
    
    for (let j = 2; j + 1 < tokens.length; j += 2) {
      cx += parseFloat(tokens[j]);
      cy += parseFloat(tokens[j+1]);
      points.push([cx, cy]);
    }
    
    penX = startX;
    penY = startY;
    
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

// Extract azul group
const gMatch = svg.match(/<g[^>]*?id="azul"[^>]*?>([\s\S]*?)<\/g>/i);
const content = gMatch[1];
const parts = content.split(/\sd="/);
const results = [];

for (let p = 1; p < parts.length; p++) {
  const quoteIdx = parts[p].indexOf('"');
  if (quoteIdx === -1) continue;
  const dValue = parts[p].substring(0, quoteIdx);
  if (dValue.length > 0 && dValue.includes('m ')) {
    const rects = parseRectPath(dValue);
    for (const r of rects) results.push(r);
  }
}

console.log(`Found ${results.length} rects\n`);

// Test one rect
const r0 = results[0];
console.log('Rect 0:', JSON.stringify(r0));
console.log(`local cx=${r0.cx}, cy=${r0.cy}`);

const g4710 = [1,0,0,1,0,17.8139]; // translate(0, 17.81)
console.log('g4710:', JSON.stringify(g4710));

const [gx, gy] = applyMat(g4710, [r0.cx, r0.cy]);
console.log(`applyMat(g4710, [${r0.cx}, ${r0.cy}]): [${gx}, ${gy}]`);

// Check the transform function
const myMult = multiply(g4710, [1,0,0,1,0,0]);
console.log('\nmultiply(g4710, identity):', JSON.stringify(myMult));

const [gx2, gy2] = applyMat(myMult, [r0.cx, r0.cy]);
console.log(`applyMat([1,0,0,1,0,17.81], [${r0.cx}, ${r0.cy}]): [${gx2}, ${gy2}]`);

// What if somehow we have a different matrix?
const deconstructed = [1, 0, 1, 0, 0, 17.81];
const [gx3, gy3] = applyMat(deconstructed, [r0.cx, r0.cy]);
console.log(`\nShear matrix [1,0,1,0,0,17.81]: [${gx3}, ${gy3}]`);
