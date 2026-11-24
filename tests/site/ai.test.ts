// Card E (D-176): AI search welcomed by name, /llms.txt, and the artist as a Person on About.
import {beforeEach, describe, expect, it} from 'vitest';
import {AI_CRAWLERS, robots} from '../../worker/site/extras';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

const ld = (text: string): Record<string, unknown>[] =>
  [...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(m => JSON.parse(m[1]!))
    // The site graph's nodes (WebSite, Person) count as the page's too.
    .flatMap(o => (o['@graph'] ? o['@graph'] : [o]));

describe('robots.txt names the AI crawlers', () => {
  it('each in one group with the same rules as everyone else', async () => {
    const t = await robots('https://a.test').text();
    const groups = t.trim().split(/\n\n+/);
    const named = groups.find(g => g.includes('User-agent: GPTBot'))!;
    for (const a of AI_CRAWLERS) expect(named, a).toContain(`User-agent: ${a}\n`);
    for (const g of [groups[0]!, named])
      for (const l of ['Allow: /', 'Disallow: /studio', 'Disallow: /v1/', 'Disallow: /assistant/'])
        expect(g).toContain(l);
    expect(t.match(/^Sitemap: https:\/\/a\.test\/sitemap\.xml$/m)).not.toBeNull();
    for (const a of ['OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Bingbot'])
      expect(AI_CRAWLERS).toContain(a);
    expect(t).not.toMatch(/Disallow: \/\n/);
  });
});

describe('/llms.txt', () => {
  it('says who, what is for sale, the main pages and how to ask, from public things only', async () => {
    fixture.studio.links = [{label: 'Instagram', url: 'https://www.instagram.com/test'}];
    const r = await get('/llms.txt');
    expect(r.status).toBe(200);
    expect(r.res.headers.get('content-type')).toContain('text/plain');
    const t = r.text;
    expect(t.startsWith('# Test Studio\n\n> ')).toBe(true);
    for (const p of ['/works)', '/commissions)', '/process)', '/about)', '/ask)']) expect(t).toContain(p);
    // For sale: available pieces only, with their price or "Price on request".
    expect(t).toMatch(/- \[Strata\]\(https:\/\/[^)]+\/works\/work-1\): [^\n]*\$4,800/);
    expect(t).toMatch(/- \[Green Horizon\]\([^)]+\/works\/work-3\): [^\n]*Price on request/);
    expect(t).not.toContain('Upper Limit');
    expect(t).not.toContain('Reserved One');
    expect(t).toContain('- [Instagram](https://www.instagram.com/test)');
    // Private stays out: no phone number in any form; the email is already on every page.
    expect(t).not.toContain('5551234567');
    expect(t).not.toContain('555-123');
    expect(t).toContain('studio@example.com');
    expect(t).not.toContain('<script');
  });

  it('a title cannot break the Markdown', async () => {
    fixture.works[0]!.title = 'Bad] (x) [link\nnew line';
    const t = (await get('/llms.txt')).text;
    expect(t).toContain('- [Bad (x) link new line](');
  });

  it('nothing available: says so, and links nowhere else', async () => {
    for (const w of fixture.works) w.status = 'sold';
    const t = (await get('/llms.txt')).text;
    expect(t).toContain('Nothing is listed as available right now');
    expect(t).not.toContain('## Elsewhere');
  });
});

describe('About carries the artist as a Person', () => {
  it('with sameAs from the saved links', async () => {
    fixture.studio.links = [
      {label: 'Instagram', url: 'https://www.instagram.com/test'},
      {label: 'Gallery', url: 'https://gallery.example/a'},
    ];
    const person = ld((await get('/about')).text).find(o => o['@type'] === 'Person')!;
    expect(person.name).toBe('Test Studio');
    expect(person.url).toMatch(/^https?:\/\/[^/]+\/$/);
    expect(person.sameAs).toEqual(['https://www.instagram.com/test', 'https://gallery.example/a']);
    expect(JSON.stringify(person)).not.toContain('5551234567');
  });

  it('no links: no sameAs', async () => {
    const person = ld((await get('/about')).text).find(o => o['@type'] === 'Person')!;
    expect(person.sameAs).toBeUndefined();
  });

  it('as the subject of a ProfilePage', async () => {
    const page = ld((await get('/about')).text).find(o => o['@type'] === 'ProfilePage')!;
    expect(page.mainEntity).toEqual({'@id': 'https://site.test/#artist'});
  });
});

// Search and AI readiness (D-181).
describe('every page carries one WebSite and one Person', () => {
  for (const path of ['/', '/works', '/works/work-1', '/commissions', '/process', '/about'])
    it(path, async () => {
      const nodes = ld((await get(path)).text);
      expect(nodes.filter(o => o['@type'] === 'Person')).toHaveLength(1);
      const site = nodes.find(o => o['@type'] === 'WebSite')!;
      expect(site).toMatchObject({
        '@id': 'https://site.test/#website',
        publisher: {'@id': 'https://site.test/#artist'},
      });
      const person = nodes.find(o => o['@type'] === 'Person')!;
      expect(person['@id']).toBe('https://site.test/#artist');
      expect(JSON.stringify(nodes)).not.toContain('5551234567');
    });

  it('every listed page but home has a breadcrumb trail; noindex pages none', async () => {
    for (const path of ['/works', '/works/work-1', '/commissions', '/process', '/about']) {
      const crumbs = ld((await get(path)).text).filter(o => o['@type'] === 'BreadcrumbList');
      expect(crumbs, path).toHaveLength(1);
    }
    expect(ld((await get('/')).text).some(o => o['@type'] === 'BreadcrumbList')).toBe(false);
    expect(ld((await get('/cart')).text).some(o => o['@type'] === 'BreadcrumbList')).toBe(false);
  });

  it('Works lists its pieces; Commissions is a service by the artist', async () => {
    const list = ld((await get('/works')).text).find(o => o['@type'] === 'CollectionPage')!;
    const items = (list.mainEntity as {itemListElement: {url: string; position: number}[]}).itemListElement;
    expect(items[0]).toMatchObject({position: 1, url: 'https://site.test/works/work-1'});
    const svc = ld((await get('/commissions')).text).find(o => o['@type'] === 'Service')!;
    expect(svc.provider).toEqual({'@id': 'https://site.test/#artist'});
  });
});

describe('the sitemap lists each piece with its pictures', () => {
  it('as image:image entries at the largest size', async () => {
    const t = (await get('/sitemap.xml')).text;
    expect(t).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(t).toMatch(
      /<loc>https:\/\/site\.test\/works\/work-1<\/loc><lastmod>[^<]+<\/lastmod><image:image><image:loc>https:\/\/site\.test\/v1\/[^<]+\/1600\.webp<\/image:loc><\/image:image>/,
    );
  });
});

describe('/llms-full.txt', () => {
  it("the pages in the artist's words and every piece with its facts, never the phone", async () => {
    const r = await get('/llms-full.txt');
    expect(r.status).toBe(200);
    expect(r.res.headers.get('content-type')).toContain('text/plain');
    const t = r.text;
    expect(t.startsWith('# Test Studio\n')).toBe(true);
    expect(t).toContain('## Works');
    expect(t).toMatch(/### Strata\n\nhttps:\/\/site\.test\/works\/work-1\n\n- Artist: Test Studio\n- Size: 36 × 24 in/);
    expect(t).toContain('Upper Limit'); // sold work: listed, as sold
    expect(t).toContain('The description of work 1.');
    expect(t).not.toContain('5551234567');
    expect(t).not.toContain('555-123');
    expect(t).not.toContain('<script');
    expect((await get('/llms.txt')).text).toContain('/llms-full.txt)');
  });
});

describe('the own domain (SITE_ORIGIN)', () => {
  it('names it in canonical links, data and the sitemap; the workers.dev copy is noindex', async () => {
    const r = await get('/works/work-1', undefined, {SITE_ORIGIN: 'https://art.example'});
    expect(r.text).toContain('<link rel="canonical" href="https://art.example/works/work-1" />');
    expect(r.text).toContain('"@id":"https://art.example/#artist"');
    expect(r.res.headers.get('x-robots-tag')).toBe('noindex');
    expect((await get('/sitemap.xml', undefined, {SITE_ORIGIN: 'https://art.example'})).text).toContain(
      '<loc>https://art.example/works/work-1</loc>',
    );
    expect((await get('/robots.txt', undefined, {SITE_ORIGIN: 'https://art.example'})).text).toContain(
      'Sitemap: https://art.example/sitemap.xml',
    );
  });

  it('on the own domain itself: listed', async () => {
    const r = await get('/works/work-1', undefined, {SITE_ORIGIN: 'https://site.test'});
    expect(r.res.headers.get('x-robots-tag')).toBeNull();
  });

  it('not an https origin: ignored', async () => {
    const r = await get('/works/work-1', undefined, {SITE_ORIGIN: 'http://art.example/x'});
    expect(r.text).toContain('<link rel="canonical" href="https://site.test/works/work-1" />');
    expect(r.res.headers.get('x-robots-tag')).toBeNull();
  });
});
