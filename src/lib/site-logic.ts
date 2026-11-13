// Pure helpers for the Site screen: place names, time zones, phone tidying and the API's field errors.
export interface PlaceInfo {
  place: string;
  label: string;
  /** Takes several photos (in order) rather than one. */
  multi: boolean;
}

export const PLACES: PlaceInfo[] = [
  {place: 'home.hero', label: 'Home — top picture', multi: true},
  {place: 'home.rooms', label: 'Home — rooms', multi: true},
  {place: 'home.object-1', label: 'Home — close-up 1', multi: false},
  {place: 'home.object-2', label: 'Home — close-up 2', multi: false},
  {place: 'commissions.intro', label: 'Commissions — intro', multi: false},
  {place: 'process.hero', label: 'Process — top', multi: true},
  {place: 'process.surface', label: 'Process — 1 Surface', multi: false},
  {place: 'process.layering', label: 'Process — 2 Layering', multi: false},
  {place: 'process.color', label: 'Process — 3 Color', multi: false},
  {place: 'process.erosion', label: 'Process — 4 Erosion', multi: false},
  {place: 'process.finished', label: 'Process — 5 Finished', multi: false},
  {place: 'about.studio', label: 'About — studio', multi: false},
];

export const MAX_PHOTOS_PER_PLACE = 12;

export const PAGES = [
  {key: 'home', label: 'Home'},
  {key: 'commissions', label: 'Commissions'},
  {key: 'process', label: 'Process'},
  {key: 'about', label: 'About'},
  {key: 'trade', label: 'For designers and architects'},
] as const;
export type PageKey = (typeof PAGES)[number]['key'];

/** Pages that start as a draft and reach the site only once saved (D-175): the draft the Site screen offers. */
export const PAGE_DRAFTS: Partial<
  Record<PageKey, {title: string; lede: string; sections: {heading: string; body: string}[]}>
> = {
  trade: {
    title: 'For designers and architects',
    lede: 'Original work for your projects, from the studio.',
    sections: [
      {
        heading: 'Working together',
        body: 'Send the room, the size and the feel you have in mind, and I will reply with pieces that fit or a commission to size.',
      },
    ],
  },
};

export const US_ZONES: {value: string; label: string}[] = [
  {value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)'},
  {value: 'America/Denver', label: 'Mountain (Denver)'},
  {value: 'America/Phoenix', label: 'Arizona (Phoenix)'},
  {value: 'America/Chicago', label: 'Central (Chicago)'},
  {value: 'America/New_York', label: 'Eastern (New York)'},
  {value: 'America/Anchorage', label: 'Alaska (Anchorage)'},
  {value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)'},
];

/** The zones to offer: the US ones, plus the current value when it is something else. */
export function zoneOptions(current: string | undefined): {value: string; label: string}[] {
  return current && !US_ZONES.some(z => z.value === current)
    ? [{value: current, label: current}, ...US_ZONES]
    : US_ZONES;
}

/** "(949) 813-5258" -> "+19498135258". Anything else is passed through trimmed, for the API to judge. */
export function tidyPhone(input: string): string {
  const t = input.trim();
  if (!t) return '';
  const plus = t.startsWith('+');
  const digits = t.replace(/\D/g, '');
  if (!plus && digits.length === 10) return '+1' + digits;
  if (!plus && digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return (plus ? '+' : '') + digits;
}

/** Field path segments from an API issue path ("meta.site.phone", ["site","pages","home","title"], "pages[0]") */
export function issueSegments(path: unknown): string[] {
  const raw = Array.isArray(path)
    ? path.map(String)
    : String(path ?? '')
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.');
  const segs = raw.flatMap(p => String(p).split('.')).filter(Boolean);
  const at = segs.lastIndexOf('site');
  return at >= 0 ? segs.slice(at + 1) : segs[0] === 'meta' ? segs.slice(1) : segs;
}

/** The API's 400 details as {"pages.home.title": "message"}. */
export function issuesByField(e: unknown): Record<string, string> {
  const issues = (e as {details?: {issues?: {path?: unknown; message?: unknown}[]}} | null)?.details?.issues;
  const out: Record<string, string> = {};
  for (const i of issues ?? []) {
    const key = issueSegments(i.path).join('.');
    if (!(key in out)) out[key] = String(i.message ?? 'Not valid');
  }
  return out;
}

/** Drops empty strings so the API never sees them as values. */
export function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== '' && v != null) out[k] = v;
  return out as Partial<T>;
}

/** New photo selection after tapping `id`: several places keep order and a cap, single places just take it. */
export function toggleSelection(current: string[], id: string, multi: boolean): string[] {
  if (!multi) return current[0] === id ? [] : [id];
  if (current.includes(id)) return current.filter(x => x !== id);
  return current.length >= MAX_PHOTOS_PER_PLACE ? current : [...current, id];
}
