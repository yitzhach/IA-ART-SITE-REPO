// Groups pictures that are the same piece: a perceptual hash (dHash 9x8 on greyscale) plus an aspect-ratio check.

export const MAX_DISTANCE = 6;
export const ASPECT_TOLERANCE = 0.03;

/** Hamming distance between two equal-length strings of 0/1. */
export function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** dHash bits from a 9 wide, 8 tall greyscale buffer (row-major, 72 bytes): each pixel against its right neighbour. */
export function dhashFromGrey(buf) {
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += buf[y * 9 + x] < buf[y * 9 + x + 1] ? '1' : '0';
  return bits;
}

const aspectOf = f => f.width / f.height;
const aspectClose = (a, b, tol) => Math.abs(aspectOf(a) - aspectOf(b)) / Math.max(aspectOf(a), aspectOf(b)) <= tol;

/**
 * files: [{path, hash, width, height}]. Returns clusters [{members: [file...], reasons: [string]}] in stable order.
 * Conservative: two groups merge only if EVERY cross pair is within the threshold (complete linkage), closest pairs first.
 */
export function cluster(files, {maxDistance = MAX_DISTANCE, aspectTolerance = ASPECT_TOLERANCE} = {}) {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const edges = [];
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i],
        b = sorted[j];
      if (!aspectClose(a, b, aspectTolerance)) continue;
      const d = hamming(a.hash, b.hash);
      if (d <= maxDistance) edges.push({a, b, d});
    }
  edges.sort((x, y) => x.d - y.d || x.a.path.localeCompare(y.a.path) || x.b.path.localeCompare(y.b.path));
  const groupOf = new Map(sorted.map(f => [f.path, {members: [f], reasons: []}]));
  const ok = new Set(edges.map(e => e.a.path + '\0' + e.b.path));
  const linked = (a, b) => ok.has(a.path + '\0' + b.path) || ok.has(b.path + '\0' + a.path);
  for (const {a, b, d} of edges) {
    const ga = groupOf.get(a.path),
      gb = groupOf.get(b.path);
    if (ga === gb) continue;
    if (!ga.members.every(x => gb.members.every(y => linked(x, y)))) continue;
    ga.members.push(...gb.members);
    ga.reasons.push(
      ...gb.reasons,
      `${a.path} and ${b.path} look the same (picture fingerprints differ in ${d} of 64 places; shapes ${aspectOf(a).toFixed(3)} and ${aspectOf(b).toFixed(3)})`,
    );
    for (const m of gb.members) groupOf.set(m.path, ga);
  }
  return [...new Set(groupOf.values())]
    .map(g => ({members: g.members.sort((x, y) => x.path.localeCompare(y.path)), reasons: g.reasons}))
    .sort((x, y) => x.members[0].path.localeCompare(y.members[0].path));
}
