// Turns picture clusters plus the page text into manifest works. Pure: no file access.
import {cluster} from './group.mjs';

const PAGE_ORDER = [
  'collection-abstract.html',
  'collection-figurative.html',
  'collection-sculptural.html',
  'available.html',
];
const pageRank = p => {
  const i = PAGE_ORDER.indexOf(p);
  return i === -1 ? PAGE_ORDER.length : i;
};
export const stemOf = path =>
  path
    .replace(/^.*\//, '')
    .replace(/\.webp$/, '')
    .replace(/-(hi|full)$/, '');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * files: [{path, hash, width, height, bytes}]; slots: PageSlot[] (see parse-pages) plus library pseudo-slots
 * {id, page, title, year?, medium?}. A file belongs to the slot whose id is its name without -hi/-full.
 * Returns {works, skipped}: files with no slot are skipped, never guessed at.
 */
export function assemble({files, slots, sha, repo = 'yitzhach/IA-ART-Claude-Code'}) {
  const slotById = new Map(slots.map(s => [s.id, s]));
  const skipped = [];
  const usable = [];
  for (const f of files) {
    if (slotById.has(stemOf(f.path))) usable.push(f);
    else skipped.push({path: f.path, reason: 'not shown as a work on any collection or Available page'});
  }
  const works = [];
  for (const c of cluster(usable)) {
    const mine = [...new Set(c.members.map(m => stemOf(m.path)))]
      .map(id => slotById.get(id))
      .sort((a, b) => pageRank(a.page) - pageRank(b.page) || a.number - b.number || a.id.localeCompare(b.id));
    const first = mine[0];
    const titled = mine.find(s => s.title);
    const collections = [...new Set(mine.map(s => s.collection).filter(Boolean))];
    const sold = mine.some(s => s.sold);
    const onAvailable = mine.some(s => s.page === 'available.html');
    const pick = k => mine.find(s => s[k] != null)?.[k];
    const best = [...c.members].sort(
      (a, b) => b.width * b.height - a.width * a.height || b.bytes - a.bytes || a.path.localeCompare(b.path),
    )[0];
    const width = pick('width');
    const w = {
      key: first.id,
      title: titled ? titled.title : `${cap(first.collection ?? 'available')} No. ${first.number}`,
      titleFrom: titled ? 'page' : 'made',
      ...(collections[0] ? {collection: collections[0]} : {}),
      ...(sold ? {status: 'sold'} : onAvailable ? {status: 'available'} : {}),
      ...(width != null
        ? {width, height: pick('height'), ...(pick('sizeUnit') ? {sizeUnit: pick('sizeUnit')} : {})}
        : {}),
      ...(pick('medium') ? {medium: pick('medium')} : {}),
      ...(pick('year') ? {year: pick('year')} : {}),
      source: {
        path: best.path,
        url: `https://raw.githubusercontent.com/${repo}/${sha}/${best.path}`,
        pixels: {width: best.width, height: best.height},
        bytes: best.bytes,
      },
      alsoFrom: c.members.filter(m => m !== best).map(m => m.path),
      mergedBecause: c.reasons,
      importedFrom: `${first.page}#${first.id}`,
    };
    if (collections.length > 1) w.alsoInCollections = collections.slice(1);
    const others = mine.filter(s => s !== first);
    if (others.length) w.alsoOn = others.map(s => `${s.page}#${s.id}`);
    works.push(w);
  }
  // Two different pictures can sit in one card (a small crop and a large file that do not match): keys stay unique,
  // the bigger picture keeps the card's key and the other is kept apart, with a note.
  const taken = new Set();
  for (const w of [...works].sort(
    (a, b) => b.source.pixels.width * b.source.pixels.height - a.source.pixels.width * a.source.pixels.height,
  )) {
    const card = w.key;
    while (taken.has(w.key)) w.key += '-b';
    if (w.key !== card) {
      w.notes = [
        `Shares the card ${w.importedFrom} with another work, but the picture is different, so it is kept apart (not merged).`,
      ];
      if (w.titleFrom === 'made') w.title += ' (second picture)';
    }
    taken.add(w.key);
  }
  works.sort((a, b) => a.key.localeCompare(b.key, 'en', {numeric: true}));
  return {works, skipped};
}
