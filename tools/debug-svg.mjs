import { readFileSync } from 'fs';
const svg = readFileSync('tablero.svg', 'utf-8');

// Find azul group content and count paths
const match = svg.match(/<g[^>]*?id="azul"[^>]*?>([\s\S]*?)<\/g>/i);
if (match) {
  const content = match[1];
  // Count path elements
  const paths = content.match(/<path[\s\S]*?\/>/g);
  console.log(`Found ${paths ? paths.length : 0} path elements in azul group`);
  
  if (paths) {
    paths.forEach((p, i) => {
      const dMatch = p.match(/d="([^"]*)"/);
      const idMatch = p.match(/id="([^"]*)"/);
      console.log(`\nPath ${i} (id=${idMatch ? idMatch[1] : 'unknown'}):`);
      if (dMatch) {
        const d = dMatch[1];
        console.log(`  d length: ${d.length} chars`);
        // Count subpaths
        const subpaths = d.match(/m\s/gi);
        console.log(`  subpaths: ${subpaths ? subpaths.length : 0}`);
        // Show first 100 chars
        console.log(`  starts with: ${d.substring(0, 100)}...`);
      }
    });
  }
} else {
  console.log('azul group not found');
}
