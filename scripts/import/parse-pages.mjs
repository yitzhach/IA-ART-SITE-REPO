// Reads what the current site's pages type about each work. Pure functions on HTML text, no file access.

const NAMED = {nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", times: '×', ndash: '–', mdash: '—'};

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

const clean = s => decodeEntities(s).replace(/\s+/g, ' ').trim();

export function parseAttrs(tagBody) {
  const attrs = {};
  for (const m of tagBody.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[m[1]] = m[2] ?? '';
  return attrs;
}

/**
 * A card caption such as "Green Horizon, 34 × 48 in" or "Embedded Brass Bar, 16 x 28".
 * Bracketed text ("[Title, size, year]") is the page's own placeholder and counts as nothing.
 * Returns {title?, width?, height?, sizeUnit?, year?} or null.
 */
export function parseCaption(raw) {
  const text = clean(raw ?? '');
  if (!text || /^\[.*\]$/.test(text)) return null;
  const out = {};
  let rest = text;
  const year = rest.match(/(?:^|[,\s])((?:19|20)\d\d)\s*$/);
  if (year && !/[×x]\s*(?:19|20)\d\d\s*$/i.test(rest)) {
    out.year = Number(year[1]);
    rest = rest.slice(0, year.index).replace(/[,\s]+$/, '');
  }
  const size = rest.match(/(?:^|[,\s])(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*(in\b|inches\b|"|cm\b)?\s*$/);
  if (size) {
    out.width = Number(size[1]);
    out.height = Number(size[2]);
    if (size[3]) out.sizeUnit = size[3].toLowerCase() === 'cm' ? 'cm' : 'in';
    rest = rest.slice(0, size.index).replace(/[,\s]+$/, '');
  }
  if (rest) out.title = rest;
  return Object.keys(out).length ? out : null;
}

const CARD_ID = /^(abstract|figurative|sculptural|available)-(\d+)$/;

/**
 * Finds the work cards on a collection or Available page. A card is an `<image-slot>` whose label reads "No. 001";
 * its text is the spans that follow, up to the next card. Returns one object per card, in page order.
 */
export function parsePage(html, page) {
  const tags = [];
  for (const m of html.matchAll(/<image-slot\b([^>]*)>/gi)) {
    const attrs = parseAttrs(m[1]);
    if (!attrs.id || !CARD_ID.test(attrs.id) || !/^No\.\s*\d+/i.test(attrs.label ?? '')) continue;
    tags.push({attrs, start: m.index, end: m.index + m[0].length});
  }
  return tags.map((t, i) => {
    let end = tags[i + 1]?.start ?? html.length;
    const section = html.indexOf('</section>', t.end);
    if (section !== -1 && section < end) end = section;
    const segment = html.slice(t.end, end);
    const spans = [...segment.matchAll(/<span\b[^>]*>([^<]*)<\/span>/gi)].map(m => clean(m[1]));
    const sold = spans.some(s => /^sold$/i.test(s));
    const label = clean(t.attrs.label);
    const texts = spans.filter(s => s.length > 1 && !/^sold$/i.test(s) && s !== label);
    const caption = texts[0] ?? null;
    const [, collection, number] = CARD_ID.exec(t.attrs.id);
    return {
      page,
      id: t.attrs.id,
      collection: collection === 'available' ? null : collection,
      number: Number(number),
      label,
      placeholder: t.attrs.placeholder ? clean(t.attrs.placeholder) : null,
      src: t.attrs.src ?? null,
      hiresTarget: t.attrs['hires-target'] ?? null,
      sold,
      caption,
      ...(parseCaption(caption) ?? {}),
    };
  });
}

/** Visible text of a page, one string per block, with scripts, styles and tags removed. */
export function visibleBlocks(html) {
  const s = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<head\b[\s\S]*?<\/head>/i, '')
    .replace(/<\/?(br|p|h\d|div|li|section|header|footer|ul|ol|form|label|button)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(s)
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
