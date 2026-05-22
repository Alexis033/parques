import { readFileSync } from 'fs';
const svg = readFileSync('tablero.svg', 'utf-8');

// ---- Matrix helpers ----
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

// ---- Extract azul group ----
const groupRegex = /<g[^>]*?id="azul"[^>]*?>([\s\S]*?)<\/g>/i;
const match = svg.match(groupRegex);
const content = match[1];

console.log("=== AZUL GROUP CONTENT (first 500 chars) ===");
console.log(content.substring(0, 500));

// Split on d="
const parts = content.split(/\sd="/);
console.log(`\n=== Found ${parts.length - 1} d=" occurrences ===`);

for (let p = 1; p < parts.length; p++) {
  const beforeD = parts[p-1];
  const quoteIdx = parts[p].indexOf('"');
  const dValue = parts[p].substring(0, quoteIdx);
  
  console.log(`\n--- Path ${p-1} (d value, first 200 chars) ---`);
  console.log(dValue.substring(0, 200));
  console.log(`  Length: ${dValue.length}`);
}
