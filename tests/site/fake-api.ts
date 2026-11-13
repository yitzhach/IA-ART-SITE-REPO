// A stand-in for studio-api's public routes, with a small made-up studio (never real client data). Every site
// test uses it: render a page with `get('/works')`, change `fixture` to test edge cases.
import siteText from '../../src/import/site-text.json';
import {site, type SiteEnv} from '../../worker/site/index';
import type {
  PublicArtwork,
  PublicCollectorPage,
  PublicFollowerPage,
  PublicImage,
  PublicShow,
  PublicSitePhoto,
  PublicStudio,
} from '../../worker/site/types';

export const SLUG = 'test-studio-abc123';
export const img = (id: string, ratio = 0.75, alt: string | null = `Alt for ${id}`): PublicImage => ({
  fileId: id.padEnd(26, '0').slice(0, 26).toUpperCase(),
  altText: alt,
  aspectRatio: ratio,
  sizes: ([480, 960, 1600] as const).map(width => ({
    width,
    url: `/v1/public/studios/${SLUG}/images/${id.padEnd(26, '0').slice(0, 26).toUpperCase()}/${width}.webp`,
  })),
});

export const work = (n: number, over: Partial<PublicArtwork> = {}): PublicArtwork => ({
  slug: `work-${n}`,
  title: `Work ${n}`,
  medium: 'Cement, plaster',
  year: 2020 + (n % 5),
  width: 24,
  height: 36,
  depth: null,
  sizeUnit: 'in',
  editionSize: null,
  collection: ['Abstract', 'Figurative', 'Sculptural'][n % 3]!,
  tags: ['texture'],
  palette: [{hex: '#a34a24', share: 6000}],
  description: `The description of work ${n}.\n\nA second paragraph.`,
  status: 'available',
  priceCents: null,
  currency: null,
  images: [img(`w${n}a`), img(`w${n}b`, 1.5)],
  publishedAt: `2026-11-${String(10 - (n % 9)).padStart(2, '0')}T00:00:00.000Z`,
  ...over,
});

const photo = (id: string, title: string, workSlug: string | null = null): PublicSitePhoto => ({
  ...img(id, 1.33),
  title,
  workSlug,
});

export function freshFixture() {
  const works: PublicArtwork[] = [
    work(1, {
      title: 'Strata',
      status: 'available',
      priceCents: 480000,
      currency: 'USD',
      shipping: {tier: 3, cents: null, estimate: true, quote: false},
    }),
    work(2, {title: 'Upper Limit', status: 'sold'}),
    work(3, {title: 'Green Horizon', status: 'available'}),
    work(4, {title: 'Reserved One', status: 'reserved'}),
    work(5, {title: 'Tiny <script>alert(1)</script> & "quotes"', description: null, images: []}),
  ];
  const studio: PublicStudio = {
    slug: SLUG,
    name: 'Test Studio',
    tagline: siteText.profile.tagline,
    description: siteText.profile.description,
    phone: '+15551234567',
    email: 'studio@example.com',
    hours: {from: '09:00', to: '18:00'},
    timezone: 'America/Los_Angeles',
    pages: siteText.pages as PublicStudio['pages'],
    links: [],
    catalogueVersion: 7,
  };
  const places: Record<string, PublicSitePhoto[]> = {
    'home.hero': [photo('hero1', 'Hero 1'), photo('hero2', 'Hero 2')],
    'home.rooms': [photo('room1', 'Room 1'), photo('room2', 'Room 2'), photo('room3', 'Room 3')],
    'home.object-1': [photo('obj1', 'Object 14', 'work-1')],
    'home.object-2': [photo('obj2', 'Object 9')],
    'commissions.intro': [photo('comm1', 'Commission')],
    'process.hero': [photo('proc0', 'Process')],
    'process.surface': [photo('proc1', 'Surface')],
    'process.layering': [photo('proc2', 'Layering')],
    'process.color': [photo('proc3', 'Color')],
    'process.erosion': [photo('proc4', 'Erosion')],
    'process.finished': [photo('proc5', 'Finished', 'work-1')],
    'about.studio': [photo('about1', 'Studio')],
  };
  return {
    studio,
    works,
    places,
    calls: [] as string[],
    assistantAvailable: true,
    /** The assistant's saved answers (Site → Assistant → Answers): /questions and /trade read them. */
    answers: {
      shipping: 'Small pieces ship flat rate in a crate.\n\nLarge pieces get a quote within two working days.',
      hanging: 'Every piece arrives ready to hang on a French cleat.',
      care: 'Dust with a soft dry brush.',
    } as Record<string, string>,
    pages: {} as Record<string, {title: string; question: string | null; works: string[]}>,
    collectors: {} as Record<string, PublicCollectorPage>,
    followers: {} as Record<string, PublicFollowerPage>,
    shows: {} as Record<string, PublicShow>,
    /** What the site counted (card G): each POST to /counts, with the headers it carried. */
    counts: [] as {body: unknown; headers: Record<string, string>}[],
  };
}

export let fixture = freshFixture();
export const reset = () => (fixture = freshFixture());

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), {status, headers: {'content-type': 'application/json'}});
const notFound = () => json({error: {code: 'not_found', message: 'Not found', details: {}}}, 404);

export const api: Fetcher = {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    fixture.calls.push(url.pathname + url.search);
    const base = `/v1/public/studios/${SLUG}`;
    const v = fixture.studio.catalogueVersion;
    const p = url.pathname;
    if (!p.startsWith(base)) return notFound();
    const rest = p.slice(base.length);
    if (rest === '') return json(fixture.studio);
    if (rest === '/counts') {
      fixture.counts.push({
        body: JSON.parse(String(init?.body ?? 'null')),
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
      });
      return new Response(null, {status: 204});
    }
    // Checkout is off in the fake studio (as on the live site until Square keys): buy.js asks on every piece page.
    if (rest === '/checkout') return json({enabled: false, methods: []});
    if (rest === '/site-photos') return json({places: fixture.places, catalogueVersion: v});
    if (rest === '/collections') {
      const counts = new Map<string, number>();
      for (const w of fixture.works) if (w.collection) counts.set(w.collection, (counts.get(w.collection) ?? 0) + 1);
      return json({items: [...counts].map(([name, count]) => ({name, count})), catalogueVersion: v});
    }
    if (rest === '/artworks') {
      const q = url.searchParams;
      let items = fixture.works.filter(
        w =>
          (!q.get('collection') || w.collection === q.get('collection')) &&
          (!q.get('status') || w.status === q.get('status')),
      );
      const from = Number(q.get('cursor') ?? 0);
      const page = items.slice(from, from + 48);
      return json({items: page, nextCursor: items.length > from + 48 ? String(from + 48) : null, catalogueVersion: v});
    }
    if (rest === '/assistant')
      return json({
        name: 'Test Studio',
        artistName: 'Isaac',
        greeting: 'Hello, I am the studio assistant, an AI. Ask me about the work.',
        suggestions: ['Is this one available?', 'Do you take commissions?', 'Show me green work'],
        replyTime: 'Isaac replies within a day.',
        answers: fixture.answers,
        available: fixture.assistantAvailable,
        catalogueVersion: v,
      });
    if (rest === '/digest')
      return json({
        works: fixture.works
          .filter(w => w.status !== 'archived')
          .map(w => ({
            slug: w.slug,
            title: w.title,
            medium: w.medium,
            year: w.year,
            width: w.width,
            height: w.height,
            depth: w.depth,
            sizeUnit: w.sizeUnit,
            status: w.status,
            priceCents: w.priceCents,
            currency: w.currency,
            collection: w.collection,
            tags: w.tags,
            palette: w.palette,
            blurb: w.description?.split('\n')[0] ?? null,
            image: w.images[0]?.sizes[0]?.url ?? null,
          })),
        catalogueVersion: v,
      });
    const made = /^\/pages\/([A-Za-z0-9_-]+)$/.exec(rest);
    if (made) {
      const pg = fixture.pages[made[1]!];
      return pg
        ? json({
            token: made[1],
            title: pg.title,
            question: pg.question,
            works: pg.works.map(sl => fixture.works.find(w => w.slug === sl)).filter(Boolean),
            createdAt: '2026-11-12T00:00:00.000Z',
            catalogueVersion: v,
          })
        : notFound();
    }
    const coll = /^\/collectors\/([A-Za-z0-9_-]+)$/.exec(rest);
    if (coll) return fixture.collectors[coll[1]!] ? json(fixture.collectors[coll[1]!]) : notFound();
    const fol = /^\/followers\/([A-Za-z0-9_-]+)$/.exec(rest);
    if (fol) return fixture.followers[fol[1]!] ? json(fixture.followers[fol[1]!]) : notFound();
    const sh = /^\/shows\/([0-9A-Z]+)$/.exec(rest);
    if (sh) return fixture.shows[sh[1]!] ? json(fixture.shows[sh[1]!]) : notFound();
    const one = /^\/artworks\/([^/]+)$/.exec(rest);
    if (one) {
      const w = fixture.works.find(x => x.slug === one[1]);
      return w ? json({...w, catalogueVersion: v}) : notFound();
    }
    return notFound();
  },
  connect: () => {
    throw new Error('no sockets');
  },
} as unknown as Fetcher;

export const env: SiteEnv = {API: api, STUDIO_SLUG: SLUG};

/** Fetch a public page as a visitor would. */
export async function get(path: string, init?: RequestInit) {
  const res = await site(new Request('https://site.test' + path, init), env);
  return {res, status: res.status, text: await res.text()};
}
