// Templates (D-180, cards T1–T3): the registry, the `?look=` preview, and "Gallery". Fake data only.
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {CSS as GALLERY_CSS, TOKENS} from '../../worker/site/templates/gallery';
import {pick, TEMPLATES} from '../../worker/site/templates';
import {CSS as PLASTER_CSS} from '../../worker/site/plaster';
import {site} from '../../worker/site/index';
import {env, get, reset} from './fake-api';

beforeEach(reset);

const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

const hrefs = (text: string) =>
  [...text.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(m =>
    m[1]!.replace(/(\?|&amp;)look=gallery/, '').replace(/\?$/, ''),
  );
const headings = (text: string) =>
  [...text.matchAll(/<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map(m => m[2]!.replace(/<[^>]+>/g, '').trim());
const main = (text: string) => text.slice(text.indexOf('<main'), text.indexOf('</main>'));

describe('the registry (T1)', () => {
  it('pick falls back to Plaster', () => {
    expect(pick('gallery').id).toBe('gallery');
    expect(pick('nope').id).toBe('plaster');
    expect(pick(null).id).toBe('plaster');
    expect(pick('plaster').css).toBe(PLASTER_CSS);
    expect(TEMPLATES.map(t => t.id)).toEqual(['plaster', 'gallery']);
  });
  it('Plaster has every option off', () => {
    expect(pick('plaster').options).toEqual({});
  });
});

describe('the preview, ?look= (T1)', () => {
  const pages = ['/', '/works', '/works?status=available', '/works/work-1', '/about', '/process', '/nope'];

  it("Plaster's pages are identical with ?look=plaster or an unknown look", async () => {
    for (const p of pages) {
      const plain = await get(p);
      const sep = p.includes('?') ? '&' : '?';
      for (const q of ['look=plaster', 'look=nonsense', 'look=']) {
        const r = await get(`${p}${sep}${q}`);
        expect(r.text, `${p} ${q}`).toBe(plain.text);
        expect(r.status).toBe(plain.status);
        expect(r.res.headers.get('x-robots-tag')).toBeNull();
      }
    }
  });

  it('a preview is noindex, keeps the canonical on the plain address and carries the look', async () => {
    const r = await get('/works?status=available&look=gallery');
    expect(r.status).toBe(200);
    expect(r.res.headers.get('x-robots-tag')).toBe('noindex');
    expect(r.text).toContain('<meta name="robots" content="noindex">');
    expect(r.text).toContain('<link rel="canonical" href="https://site.test/works?status=available" />');
    expect(r.text).not.toMatch(/rel="canonical"[^>]*look=/);
    const links = [...r.text.matchAll(/<a\b[^>]*\shref="(\/[^"]*)"/g)].map(m => m[1]!);
    expect(links.length).toBeGreaterThan(10);
    for (const h of links) expect(h, h).toMatch(/(\?|&amp;)look=gallery(#|$)/);
    expect(r.text).toContain('href="/works?collection=Abstract&amp;status=available&amp;look=gallery"');
    // Files are not pages: fonts, scripts, icons keep their plain addresses.
    expect(r.text).toContain('href="/fonts/newsreader-400.woff2"');
    expect(r.text).toContain('<script src="/site/site.js" defer></script>');
    expect(r.text).toContain('href="/favicon-32.png"');
  });

  it('GET forms carry the look in a hidden field', async () => {
    const r = await get('/ask?look=gallery');
    expect(r.text).toMatch(
      /<form class="search" method="get" action="\/ask"[^>]*><input type="hidden" name="look" value="gallery" \/>/,
    );
  });

  describe('with the edge cache', () => {
    const store = new Map<string, Response>();
    beforeEach(() => {
      store.clear();
      (globalThis as {caches?: unknown}).caches = {
        default: {
          match: async (k: Request) => store.get(k.url)?.clone(),
          put: async (k: Request, v: Response) => void store.set(k.url, v.clone()),
        },
      };
    });
    afterEach(() => delete (globalThis as {caches?: unknown}).caches);

    it('the plain address is never answered with a preview', async () => {
      const preview = await site(new Request('https://site.test/?look=gallery'), env);
      expect(await preview.text()).toContain('class="pane"');
      const plain = await site(new Request('https://site.test/'), env);
      const text = await plain.text();
      expect(text).not.toContain('look=gallery');
      expect(text).not.toContain('class="pane"');
      expect(plain.headers.get('x-robots-tag')).toBeNull();
      const again = await site(new Request('https://site.test/?look=gallery'), env);
      expect(again.headers.get('x-site-cache')).toBe('hit');
      expect(again.headers.get('x-robots-tag')).toBe('noindex');
    });
  });
});

describe('Gallery CSS (T2)', () => {
  const root = Object.fromEntries(
    [...GALLERY_CSS.slice(0, GALLERY_CSS.indexOf('}')).matchAll(/--([\w-]+):(#[0-9a-fA-F]{6})/g)].map(m => [
      m[1]!,
      m[2]!,
    ]),
  );

  it('has the brief’s tokens, exactly', () => {
    expect(root).toEqual(TOKENS);
  });

  // [foreground, background, what it is]
  const pairs: [string, string, string][] = [
    ['ink', 'bg', 'text on the page'],
    ['ink', 'card', 'text on a chip or card'],
    ['ink', 'mat', 'text over a mat (empty picture)'],
    ['soft', 'bg', 'running text, the description, the note'],
    ['soft', 'card', '"Seen in" chips'],
    ['muted', 'bg', 'labels, counts, sizes, footer hours'],
    ['muted', 'card', 'quiet text on a card'],
    ['accent', 'bg', 'links, numbers in labels'],
    ['accent', 'card', 'rust on a card'],
    ['on-accent', 'accent', 'text on the filled button'],
    ['bg', 'ink', 'button hover, the inquiry bar, the skip link'],
    ['pane-ink', 'pane', 'headings and names on the pane'],
    ['pane-muted', 'pane', 'paragraph and counts on the pane'],
    ['pane-accent', 'pane', 'accent on the pane'],
    ['pane', 'pane-accent', 'text on the pane’s filled button'],
    ['pane-ink', 'pane-line', 'lightbox buttons'],
  ];
  it.each(pairs)('%s on %s (%s): WCAG AA 4.5:1', (fg, bg) => {
    expect(ratio(root[fg]!, root[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('no italics, light only, no outside fonts', () => {
    expect(GALLERY_CSS).not.toMatch(/italic/i);
    expect(GALLERY_CSS).not.toContain('prefers-color-scheme:dark');
    expect(GALLERY_CSS).not.toContain('data-theme');
    expect(GALLERY_CSS).toContain('color-scheme:light}');
    expect(GALLERY_CSS).not.toContain('fonts.googleapis');
    expect(GALLERY_CSS).toContain("font-family:'Newsreader';font-style:normal;font-weight:400");
    expect(GALLERY_CSS).not.toContain('newsreader-400i');
  });

  it('frames have fixed shapes and works sit whole on the mat', () => {
    expect(GALLERY_CSS).toMatch(/\.ph\{[^}]*aspect-ratio:4\/5/);
    expect(GALLERY_CSS).toMatch(/\.ph img,\.ph \.blank\{[^}]*position:absolute[^}]*height:100%;object-fit:cover/);
    expect(GALLERY_CSS).toMatch(/\.r-43\{aspect-ratio:4\/3\}/);
    expect(GALLERY_CSS).toMatch(/\.ph\.mat img\{[^}]*width:82%;height:82%;object-fit:contain/);
  });
});

describe('Gallery home (T3)', () => {
  it('same links, sections and order as Plaster, with an h1', async () => {
    const plaster = (await get('/')).text;
    const gallery = (await get('/?look=gallery')).text;
    expect(gallery.match(/<h1[\s>]/g)?.length).toBe(1);
    expect(gallery).toContain('<h1 class="sr">Test Studio</h1>');
    expect(new Set(hrefs(main(gallery)))).toEqual(new Set(hrefs(main(plaster))));
    expect(hrefs(gallery.slice(gallery.indexOf('</main>')))).toEqual(hrefs(plaster.slice(plaster.indexOf('</main>'))));
    const h2 = (t: string) => [...main(t).matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(m => m[1]!.trim());
    expect(h2(gallery)).toEqual(h2(plaster));
    expect(headings(main(gallery))).toEqual(headings(main(plaster)));
    for (const words of [
      'Revelation in the midst of decay.',
      'Typical lead 8–12 weeks · to-the-trade inquiries welcome',
      'A custom art piece for a lobby in Beverly Hills.',
      'Residential + commercial',
      'Private Collection',
      'Studio — Southern California / Southern Kentucky',
    ])
      expect(gallery, words).toContain(words);
  });

  it('" Art" in the bar only; no theme switch; light colour scheme', async () => {
    const {text} = await get('/?look=gallery');
    expect(text).toContain('<a class="site-name" href="/?look=gallery">Test Studio Art</a>');
    expect(text).toContain('<p class="ftr-name">Test Studio</p>');
    expect(text).toContain('<title>Test Studio — ');
    expect(text).not.toContain('<button class="theme-switch"');
    expect(text).toContain('<meta name="color-scheme" content="light" />');
  });

  it('the photograph first, full-bleed and preloaded at the window width; the bodies of work in the pane', async () => {
    const {text} = await get('/?look=gallery');
    const m = main(text);
    expect(m.indexOf('class="ph r-hero"')).toBeLessThan(m.indexOf('class="note"'));
    expect(m.indexOf('class="note"')).toBeLessThan(m.indexOf('class="tag"'));
    expect(m).toMatch(/^<main id="main"><div class="hero">/);
    expect(text).toMatch(/imagesizes="100vw"/);
    expect(m).toMatch(/<section class="pane" aria-labelledby="gallery-h">\s*<div class="wrap">/);
  });

  it('every picture in a tile row sits in a fixed-shape frame', async () => {
    const m = main((await get('/?look=gallery')).text);
    const rows = [...m.matchAll(/<ul class="grid(?: tiles)?">([\s\S]*?)<\/ul>/g)].map(r => r[1]!);
    expect(rows.length).toBe(3); // the bodies of work, available works, the rooms
    for (const row of rows) {
      const items = row.split(/<li>/).slice(1);
      expect(items.length).toBeGreaterThan(0);
      const shapes = items.map(li => /class="(ph[^"]*)"/.exec(li)?.[1]);
      expect(
        shapes.every(s => s && s === shapes[0]),
        shapes.join(),
      ).toBe(true);
      // the picture (or the blank) sits inside the frame
      for (const li of items)
        expect(li).toMatch(/class="ph[^"]*">(<img\b[^>]*\/>|<span class="blank"><\/span>)<\/span>/);
    }
    expect(rows[1]).toContain('class="ph mat"');
    expect(rows[2]).toContain('class="ph r-43"');
  });

  it('"The work, closely": label, sentence and rows; "Seen in" as chips', async () => {
    const m = main((await get('/?look=gallery')).text);
    expect(m).toContain('<h3 class="lab"><b>No. 014</b> — LOBBY COMMISSION - STRATA · FRAMED</h3>');
    expect(m).toContain('<p class="it">A custom art piece for a lobby in Beverly Hills.</p>');
    expect(m).toMatch(/<ul class="spec">\s*<li>Cement, plaster<\/li>/);
    expect(m).toMatch(/<h2 class="seen-h" id="proof-h">Seen in \/ installed for<\/h2>\s*<ul class="seen-l">/);
  });
});
