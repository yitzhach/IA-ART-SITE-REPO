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
  {key: 'privacy', label: 'Privacy'},
  {key: 'terms', label: 'Terms'},
] as const;
export type PageKey = (typeof PAGES)[number]['key'];

export interface PageDraft {
  title: string;
  lede: string;
  sections: {heading: string; body: string}[];
}

/** Pages that start as a draft and reach the site only once saved (D-175): the draft the Site screen offers. */
export const PAGE_DRAFTS: Partial<Record<PageKey, PageDraft>> = {
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

/** One of the artist's links elsewhere (D-176). */
export interface SiteLink {
  label: string;
  url: string;
}

export const MAX_LINKS = 12;

/** The links as the Links box shows them: one a line, the name, then the address. */
export function formatLinks(links: SiteLink[] | undefined): string {
  return (links ?? []).map(l => `${l.label} ${l.url}`).join('\n');
}

/**
 * The Links box read back (card E): one link a line, a name and then an address ("Instagram instagram.com/me").
 * The address may come without https:// or with http://; it is saved as https. A line with no name takes the
 * address's site name. Blank lines are skipped. Returns the links, or the first line's problem in plain words.
 */
export function parseLinks(text: string): {links: SiteLink[]} | {error: string} {
  const links: SiteLink[] = [];
  const lines = text.split('\n').map(l => l.trim());
  for (const [i, line] of lines.entries()) {
    if (!line) continue;
    const words = line.split(/\s+/);
    const last = words[words.length - 1]!;
    const bare = last.replace(/^https?:\/\//i, '');
    if (!/^[^\s/?#]+\.[^\s/?#]+/.test(bare))
      return {error: `Line ${i + 1} needs an address at the end, like instagram.com/yourname.`};
    let url: URL;
    try {
      url = new URL(`https://${bare}`);
    } catch {
      return {error: `Line ${i + 1}: that address doesn't look right.`};
    }
    const label =
      words
        .slice(0, -1)
        .join(' ')
        .replace(/[:\-–—]+$/, '')
        .trim() || url.hostname.replace(/^www\./, '');
    links.push({label: label.slice(0, 60), url: url.toString()});
  }
  if (links.length > MAX_LINKS) return {error: `At most ${MAX_LINKS} links.`};
  return {links};
}

/** Privacy and terms drafts are a starting point the artist reads and changes; the screen says so once. */
export const LEGAL_PAGES: PageKey[] = ['privacy', 'terms'];

/** What the drafts read from the saved settings. */
export interface DraftSource {
  email?: string;
  checkout?: {returns?: string; manualHoldHours?: number};
  assistant?: {answers?: Record<string, string>};
}

const said = (v: string | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : '');

/**
 * The draft for a page that starts as one (D-175). Privacy (card F) says only what the platform really keeps: the
 * `sv` cookie (one year), the assistant chats, inquiries, holds, follows and orders, kept until someone asks, with no
 * other number. Terms takes the return terms shown before paying and the saved shipping and deposit answers.
 */
export function pageDraft(key: PageKey, site: DraftSource): PageDraft | undefined {
  const email = said(site.email);
  const ask = email ? `email me at ${email}` : 'write to me from the contact details on this site';
  const answers = site.assistant?.answers ?? {};
  if (key === 'privacy')
    return {
      title: 'Privacy',
      lede: 'What this site keeps about you, and how to have it deleted.',
      sections: [
        {
          heading: 'What this site keeps',
          body: [
            '• A small cookie named sv, so this site knows your browser again: the assistant carries on your conversation, and your inquiries and orders stay together. It holds a random number, not your name, and lasts one year.',
            '• With your questions and inquiries, a scrambled form of your internet address, so the site can stop anyone flooding them.',
            '• Counts of how often each piece is viewed and the site’s tools are used, with nothing about who did it.',
            '• What you ask the assistant here and its answers, so I can see what visitors want to know.',
            '• Your name, email or phone and your note when you send an inquiry, ask me to hold a piece, follow the studio or buy a piece.',
            '• Your order: the piece, the price and where it ships. If you pay by card, you pay on Square’s own page, and this site never sees your card number.',
          ].join('\n'),
        },
        {
          heading: 'Who else sees it',
          body: 'The assistant’s answers are written by an AI model, Claude by Anthropic, which receives your question to answer it. I don’t sell your details.',
        },
        {
          heading: 'How long I keep it',
          body: 'I keep these until you ask me to delete them. The cookie ends after a year, or sooner if you clear it in your browser. If you follow the studio, every email has a link to stop them.',
        },
        {
          heading: 'Seeing or deleting what I hold',
          body: `To see what I hold about you or to have it deleted, ${ask}.`,
        },
      ],
    };
  if (key === 'terms') {
    const hold = site.checkout?.manualHoldHours ?? 48;
    const returns =
      said(site.checkout?.returns) ||
      said(answers.returns) ||
      'Returns within 7 days of delivery for pieces bought here, in their original condition. Commissions are final.';
    const shipping =
      said(answers.shipping) ||
      'Small pieces ship at the flat rate shown before you pay. For large pieces I send a quote within two working days.';
    const deposit = said(answers.deposit);
    return {
      title: 'Terms',
      lede: 'Buying, returns and shipping, in plain words.',
      sections: [
        {
          heading: 'Buying a piece',
          body: `The price is shown on each piece, in US dollars. If you pay by Venmo or Zelle, the piece is held for you for ${hold} hours while I check the payment; it is yours once the payment arrives.`,
        },
        {heading: 'Returns', body: returns},
        {heading: 'Shipping', body: shipping},
        ...(deposit ? [{heading: 'Commissions', body: deposit}] : []),
        {
          heading: 'The pictures and words',
          body: `The pictures and words on this site are mine. To use them, ${ask} first.`,
        },
      ],
    };
  }
  return PAGE_DRAFTS[key];
}

// ---- Visitors (card G): the studio's counts from GET /v1/site/counts, in words.
export interface SiteCounts {
  days: number;
  from: string;
  totals: Record<'view' | 'ask' | 'wall' | 'inquiry' | 'question' | 'lead' | 'order', number>;
  topWorks: {
    id: string;
    title: string;
    slug: string | null;
    view: number;
    ask: number;
    wall: number;
    inquiry: number;
  }[];
}
const COUNT_LINES: [keyof SiteCounts['totals'], string][] = [
  ['view', 'Pieces viewed'],
  ['ask', 'Ask opened'],
  ['question', 'Questions asked'],
  ['wall', 'Tried on a wall'],
  ['inquiry', 'Added to an inquiry'],
  ['lead', 'Inquiries and holds sent'],
  ['order', 'Orders started'],
];
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** The card's lines: every total (zeros too, so the list reads the same each time) and the pieces seen most. */
export function visitorSummary(c: SiteCounts): {empty: boolean; totals: {label: string; n: string}[]; top: string[]} {
  const empty = Object.values(c.totals).every(n => !n);
  const totals = COUNT_LINES.map(([k, label]) => ({label, n: (c.totals[k] ?? 0).toLocaleString('en-US')}));
  const top = c.topWorks
    .filter(w => w.view || w.ask || w.wall || w.inquiry)
    .map(w => {
      const bits = [plural(w.view, 'view', 'views')];
      if (w.inquiry) bits.push(plural(w.inquiry, 'inquiry', 'inquiries'));
      if (w.wall) bits.push(plural(w.wall, 'wall try', 'wall tries'));
      if (w.ask) bits.push(plural(w.ask, 'question opened', 'questions opened'));
      return `${w.title}: ${bits.join(', ')}`;
    });
  return {empty, totals, top};
}
