// Reads a palette from raw RGBA pixels (pure, no DOM) and turns a colour into plain words.
export interface Swatch {
  hex: string;
  /** Basis points. */
  share: number;
}

type RGB = [number, number, number];
const MAX_SAMPLE = 4096; // 64 x 64
const MIN_SHARE_BP = 300; // drop swatches under 3%
const MERGE_DIST = 28; // RGB distance under which two colours are "the same"
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');
export const toHex = (c: RGB) => '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);

/**
 * `pixels` is RGBA data, ideally already downscaled to about 64x64; larger input is strided down to <= 4096 samples.
 * Deterministic: farthest-point seeding, then k-means.
 */
export function readPalette(pixels: Uint8ClampedArray, max = 6): Swatch[] {
  const n = Math.floor(pixels.length / 4);
  const stride = Math.max(1, Math.ceil(n / MAX_SAMPLE));
  const pts: RGB[] = [];
  for (let i = 0; i < n; i += stride) {
    if ((pixels[i * 4 + 3] ?? 255) < 128) continue;
    pts.push([pixels[i * 4]!, pixels[i * 4 + 1]!, pixels[i * 4 + 2]!]);
  }
  if (!pts.length || max < 1) return [];
  const k = Math.min(Math.max(max + 4, 8), pts.length);
  // Seeding: the mean colour first, then repeatedly the point farthest from all chosen centres.
  let centres: RGB[] = [pts[0]!];
  const mean: RGB = [0, 0, 0];
  for (const p of pts) for (let c = 0; c < 3; c++) mean[c]! += p[c]! / pts.length;
  centres = [pts.reduce((best, p) => (dist(p, mean) < dist(best, mean) ? p : best), pts[0]!)];
  const near = pts.map(p => dist(p, centres[0]!));
  while (centres.length < k) {
    let bi = 0;
    for (let i = 1; i < pts.length; i++) if (near[i]! > near[bi]!) bi = i;
    if (near[bi]! === 0) break;
    const c = pts[bi]!;
    centres.push(c);
    for (let i = 0; i < pts.length; i++) near[i] = Math.min(near[i]!, dist(pts[i]!, c));
  }
  let counts: number[] = [];
  for (let iter = 0; iter < 10; iter++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0,
        bd = Infinity;
      for (let j = 0; j < centres.length; j++) {
        const d = dist(p, centres[j]!);
        if (d < bd) ((bd = d), (bi = j));
      }
      const s = sums[bi]!;
      s[0]! += p[0];
      s[1]! += p[1];
      s[2]! += p[2];
      s[3]!++;
    }
    counts = sums.map(s => s[3]!);
    centres = centres.map((c, j) => {
      const s = sums[j]!;
      return s[3]! ? ([s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!] as RGB) : c;
    });
  }
  // Merge near-identical colours (count-weighted), biggest first.
  const merged: {c: RGB; n: number}[] = [];
  const order = centres
    .map((c, j) => ({c, n: counts[j]!}))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n);
  for (const x of order) {
    const m = merged.find(y => dist(y.c, x.c) < MERGE_DIST);
    if (m) {
      const t = m.n + x.n;
      m.c = [0, 1, 2].map(i => (m.c[i]! * m.n + x.c[i]! * x.n) / t) as RGB;
      m.n = t;
    } else merged.push({c: x.c, n: x.n});
  }
  merged.sort((a, b) => b.n - a.n);
  const total = pts.length;
  return merged
    .map(m => ({hex: toHex(m.c), share: Math.floor((m.n / total) * 10000)}))
    .filter(s => s.share >= MIN_SHARE_BP)
    .slice(0, max);
}

// Copied from Studio-Wall src/colour.ts.
/** Plain-language colour words for a palette hex, so search can match "blue", "warm", "dark"… not just exact hex codes. */
export function colourWords(hex: string): string[] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [];
  const [r = 0, g = 0, b = 0] = m.slice(1).map(x => parseInt(x, 16) / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2,
    d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const tone = l < 0.3 ? ['dark'] : l > 0.7 ? ['light'] : [];
  if (l < 0.13) return ['black', 'dark', 'neutral'];
  if (l > 0.9 && s < 0.35) return ['white', 'light', 'neutral'];
  if (s < 0.15) return ['grey', 'gray', 'neutral', ...tone];
  let name: string;
  if (h < 15 || h >= 345) name = 'red';
  else if (h < 40) name = l < 0.45 ? 'brown' : 'orange';
  else if (h < 65) name = l < 0.35 ? 'brown' : 'yellow';
  else if (h < 165) name = 'green';
  else if (h < 195) name = 'teal';
  else if (h < 255) name = 'blue';
  else if (h < 290) name = 'purple';
  else name = 'pink';
  const extra: Record<string, string[]> = {
    teal: ['cyan', 'turquoise'],
    purple: ['violet'],
    pink: ['magenta'],
    brown: ['earth'],
  };
  const warm = ['red', 'orange', 'yellow', 'pink', 'brown'].includes(name);
  return [name, ...(extra[name] || []), warm ? 'warm' : 'cool', ...tone];
}
