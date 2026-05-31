/**
 * SVG track path data extracted from the original board SVG.
 * All 4 player tracks share the same base paths, just rotated.
 * Base is the azul (RED track) group which has no rotation.
 */
export const BASE_TRACK_PATHS = [
  // Main exit corridor: 8 rects going down the left column
  `m 835,1428.9747 0,-78.75 250,0 0,78.75 z m 0,78.75 0,-78.75 250,0 0,78.75 z m 0,78.75 0,-78.75 250,0 0,78.75 z m 0,78.75 0,-78.75 250,0 0,78.75 z m 0,78.75 0,-78.75 250,0 0,78.75 z m 0,78.75 0,-78.75 250,0 0,78.75 z m 250,0 0,78.75 -250,0 0,-78.75 z m -250,-472.5 0,-78.75 250,0 0,78.75 z`,
  // Diamond decorative shape (bezier curves)
  `m 1305.2693,1126.2071 c 33.3413,-19.2496 69.0621,-34.0457 106.2495,-44.01 l 64.753,241.6614 c -16.0683,4.3054 -31.5029,10.6987 -45.9094,19.0162 z m 85.6699,246.9182 c 11.7628,-11.7628 25.0168,-21.933 39.4232,-30.2506 l -125.0931,-216.6676 c -33.3413,19.2496 -64.0155,42.7867 -91.2385,70.0098 z m -246.9182,-85.6699 c 19.2496,-33.3413 42.7867,-64.0155 70.0098,-91.2385 l 176.9084,176.9084 c -11.7629,11.7628 -21.933,25.0168 -30.2506,39.4232 z m 197.6513,171.0025 c 4.3055,-16.0683 10.6988,-31.5029 19.0163,-45.9094 L 1144.021,1287.4554 c -19.2496,33.3413 -34.0457,69.0621 -44.01,106.2495 z m -6.4861,49.2668 c 0,-16.6351 2.1807,-33.1985 6.4861,-49.2668 l -241.6613,-64.753 c -9.9644,37.1874 -15.011,75.5206 -15.011,114.0198 z m 76.3326,-425.5276 c 37.1874,-9.9643 75.5206,-15.011 114.0198,-15.011 l 0,250.1863 c -16.6351,0 -33.1985,2.1806 -49.2668,6.4861 z`,
  // Cielito return path: 4 rects on the right
  `m 1085,1665.2247 0,-78.75 250,0 0,78.75 z m 0,78.75 0,-78.75 250,0 0,78.75 z m 0,78.75 0,-78.75 250,0 0,78.75 z m 250,0 0,78.75 -250,0 0,-78.75 z`,
  // SALIDA rect
  `m 1085,1586.4747 0,-78.75 250,0 0,78.75 z`,
  // Top side return path: 4 rects going right
  `m 1683.0386,1317.1861 -78.75,0 0,-250 78.75,0 z m 78.75,0 -78.75,0 0,-250 78.75,0 z m 78.75,0 -78.75,0 0,-250 78.75,0 z m 0,-250 78.75,0 0,250 -78.75,0 z`,
  // Top side single rect
  `m 1604.2886,1317.1861 -78.75,0 0,-250 78.75,0 z`,
];

/**
 * SVG transforms for each player color's track.
 * Base is RED (azul group, no rotation).
 */
export const TRACK_TRANSFORMS: Record<string, string> = {
  RED:    '',                                                              // identity
  BLUE:   'matrix(-1,0,0,-1,1920,1884.3722)',                              // 180° rotation
  YELLOW: 'matrix(0,1,-1,0,1902.1861,-17.8139)',                           // 90° CW
  GREEN:  'matrix(0,-1,1,0,17.8139,1902.1861)',                            // 90° CCW
};

/**
 * Track colors: fill and stroke for each player's track segment.
 */
export const TRACK_COLORS: Record<string, { fill: string; light: string; stroke: string }> = {
  RED:    { fill: '#e74c3c', light: '#fadbd8', stroke: '#c0392b' },
  BLUE:   { fill: '#3498db', light: '#d6eaf8', stroke: '#2980b9' },
  GREEN:  { fill: '#2ecc71', light: '#d5f5e3', stroke: '#27ae60' },
  YELLOW: { fill: '#f1c40f', light: '#fef9e7', stroke: '#d4a017' },
};

/**
 * Home quadrant positions in the 1920×1920 SVG space.
 */
export const HOME_QUADRANTS = [
  { color: 'BLUE',   x: 0.5,    y: 0.5,    w: 584, h: 584 },
  { color: 'GREEN',  x: 1335.2, y: 0.5,    w: 584, h: 584 },
  { color: 'YELLOW', x: 0.5,    y: 1335.2, w: 584, h: 584 },
  { color: 'RED',    x: 1335.2, y: 1335.2, w: 584, h: 584 },
];

/**
 * Text labels for each player's track (positions in base/local coords).
 */
export const TRACK_LABELS: Record<string, { salida: [number, number]; llegada: [number, number]; seguro: [number, number][] }> = {
  RED: {
    salida: [1126, 1604],
    llegada: [855, 1290],
    seguro: [[866, 1918], [-1285, 1619]], // second is in rotated space
  },
};
