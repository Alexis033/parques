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

// Simple test
const g4710 = translate(0, 17.8139);
console.log('g4710:', g4710);
console.log('apply(translate(0,17.81), [960, 1389.6]):', applyMat(g4710, [960, 1389.6]));

// Now test with azul group extraction
const azulMatch = svg.match(/<g[^>]*?id="azul"[^>]*?>([\s\S]*?)<\/g>/i);
const content = azulMatch[1];

// Extract first path's d value manually
const pathMatch = content.match(/ d="([^"]*)"/);  // space before d=
console.log('First d found:', pathMatch ? pathMatch[1].substring(0, 60) + '...' : 'not found');

// Test content.split approach
const parts = content.split(/\sd="/);
console.log(`\nParts from split: ${parts.length}`);
for (let p = 1; p <= Math.min(3, parts.length-1); p++) {
  const before = parts[p-1].slice(-20);
  const quoteIdx = parts[p].indexOf('"');
  const dVal = parts[p].substring(0, Math.min(quoteIdx, 60));
  console.log(`  Part ${p}: ...${before} | d="${dVal}..."`);
}
