// A piece's colours in words (card D): each stored palette swatch (hex + share) gets the nearest named colour by
// distance in CIE Lab, and the top three by share are said once each, e.g. "rust, deep blue and cream". By code
// only: no model call, so the same palette always gives the same words.
import type {PublicArtwork} from './types';

/** Names an artist or a designer would use, each at a typical shade. Order only breaks exact ties. */
export const NAMED: [string, string][] = [
  ['black', '#141414'],
  ['charcoal', '#3a3a3a'],
  ['grey', '#8a8a8a'],
  ['silver', '#c4c4c4'],
  ['white', '#f8f8f5'],
  ['cream', '#f1e6cc'],
  ['sand', '#d8c3a0'],
  ['stone', '#a89f91'],
  ['tan', '#b88a5a'],
  ['ochre', '#c48a2e'],
  ['gold', '#d9b23c'],
  ['yellow', '#f2d33a'],
  ['orange', '#e8792f'],
  ['terracotta', '#c4623e'],
  ['rust', '#a3471f'],
  ['brown', '#6b4226'],
  ['dark brown', '#3e2a1e'],
  ['red', '#c8282d'],
  ['deep red', '#8b1e24'],
  ['burgundy', '#5e1a2a'],
  ['coral', '#ee7f6d'],
  ['pink', '#e8a0b0'],
  ['blush', '#e9c4bd'],
  ['plum', '#6e3b5c'],
  ['purple', '#7d4a9e'],
  ['lavender', '#b8a6d4'],
  ['navy', '#1c2a4a'],
  ['deep blue', '#1f3f7a'],
  ['blue', '#3b6fc2'],
  ['sky blue', '#8ec2e8'],
  ['slate blue', '#5b6f8a'],
  ['teal', '#1f7a7a'],
  ['turquoise', '#3fbfbf'],
  ['deep green', '#1f4d33'],
  ['green', '#3f8f4f'],
  ['olive', '#6f6e2f'],
  ['sage', '#a3b18a'],
  ['mint', '#b6e3c6'],
];

type Lab = [number, number, number];

function lab(hex: string): Lab | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  const lin = (v: string) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(m[1]!), lin(m[2]!), lin(m[3]!)];
  // sRGB → XYZ (D65), then XYZ → Lab.
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const TABLE = NAMED.map(([name, hex]) => ({name, lab: lab(hex)!}));

/** The nearest named colour to a hex, or null for something that isn't a #rrggbb colour. */
export function colourName(hex: string): string | null {
  const c = lab(hex);
  if (!c) return null;
  let best = TABLE[0]!;
  let bestD = Infinity;
  for (const t of TABLE) {
    const d = Math.hypot(c[0] - t.lab[0], c[1] - t.lab[1], c[2] - t.lab[2]);
    if (d < bestD) [best, bestD] = [t, d];
  }
  return best.name;
}

/** Up to three names, largest share first, each once. */
export function colourNames(palette: PublicArtwork['palette'] | null | undefined, max = 3): string[] {
  const out: string[] = [];
  const sorted = [...(palette ?? [])].filter(s => s && s.share > 0).sort((a, b) => b.share - a.share);
  for (const s of sorted) {
    const n = colourName(s.hex);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

/** "rust", "rust and cream", "rust, deep blue and cream"; null when there are no colours. */
export function colourPhrase(names: string[]): string | null {
  if (!names.length) return null;
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
