import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

const all = (text: string) =>
  [...text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]!));
/** The page's own data: the site graph (WebSite + Person) comes first on every page. */
const ld = (text: string) => all(text).filter(o => !o['@graph']);

describe('a piece', () => {
  it('priced work: title, facts, price, contact links with title and URL, JSON-LD offer', async () => {
    const {text} = await get('/works/work-1');
    expect(text).toContain('<title>Strata — Test Studio</title>');
    expect(text).toMatch(/<h1>Strata<\/h1>/);
    expect(text).toContain('36 × 24 in (91.4 × 61 cm)');
    expect(text).toContain('Cement, plaster');
    expect(text).toContain('$4,800');
    expect(text).not.toContain('sms:');
    expect(text).toContain(
      '<a class="btn" href="/contact?w=work-1" data-contact="sms" data-title="Strata" data-url="https://site.test/works/work-1">Text</a>',
    );
    expect(text).toMatch(/<a\s+class="btn alt"\s+href="\/ask\?piece=work-1"\s+data-ask\s+data-piece="work-1"/);
    expect(text).toMatch(/<button[^>]*hidden[^>]*data-hold/);
    expect(text).toMatch(/href="mailto:studio@example.com\?subject=About%20Strata/);
    expect(text).toMatch(/<button[^>]*hidden[^>]*data-inquiry/);
    expect(text).toContain('/site/lightbox.js');
    expect(text).toMatch(/<a href="[^"]*W1B[^"]*\/1600\.webp" data-lb/);
    const [art] = ld(text);
    expect(art['@type']).toBe('VisualArtwork');
    expect(art['@id']).toBe('https://site.test/works/work-1#artwork');
    expect(art.image).toHaveLength(2);
    expect(art.image[0]).toMatchObject({
      '@type': 'ImageObject',
      caption: 'Alt for w1a',
      width: 1600,
      height: 2133,
      creator: {'@id': 'https://site.test/#artist'},
    });
    expect(art.image[0].contentUrl).toMatch(/^https:\/\/site\.test\/.*\/1600\.webp$/);
    // The creator is the one Person every page carries, by @id.
    expect(art.creator).toEqual({'@id': 'https://site.test/#artist'});
    const person = all(text)
      .find(o => o['@graph'])
      ['@graph'].find((n: {'@type': string}) => n['@type'] === 'Person');
    expect(person).toMatchObject({'@id': 'https://site.test/#artist', name: 'Test Studio', jobTitle: 'Artist'});
    expect(art.keywords).toBe('texture');
    expect(art.genre).toBe('Figurative');
    expect(art.offers).toMatchObject({
      price: '4800.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    });
    expect(art.height).toMatchObject({value: 36, unitCode: 'INH', unitText: 'in'});
    const crumbs = ld(text).find(o => o['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((i: {name: string}) => i.name)).toEqual([
      'Home',
      'Works',
      'Figurative',
      'Strata',
    ]);
    expect(crumbs.itemListElement[3].item).toBe('https://site.test/works/work-1');
    // Who made it, in words a visitor (and an answer engine) can read; the collection links to its works.
    expect(text).toMatch(/<dt>Artist<\/dt>\s*<dd><a href="\/about">Test Studio<\/a><\/dd>/);
    expect(text).toContain('<a href="/works?collection=Figurative">Figurative</a>');
    expect(text).toContain(
      '<meta name="description" content="Strata by Test Studio, cement, plaster, 36 × 24 in. The description of work 1.',
    );
    expect(text).toContain('<meta property="og:image:width" content="960" />');
    expect(text).toContain('<meta property="og:image:alt" content="Alt for w1a" />');
    expect(text).toContain('<meta property="og:image" content="https://site.test/');
    expect(text).toMatch(/rel="preload"\s+as="image"/);
  });
  it('sold work: no price, "commission one like this", SoldOut', async () => {
    const {text} = await get('/works/work-2');
    expect(text).not.toMatch(/\$\d/);
    expect(text).toContain('<a href="/commissions">Sold — commission one like this</a>');
    expect(ld(text)[0].offers).toEqual({'@type': 'Offer', availability: 'https://schema.org/SoldOut'});
  });
  it('unpriced available: Price on request, no offer', async () => {
    const {text} = await get('/works/work-3');
    expect(text).toContain('Price on request');
    expect(text).not.toMatch(/\$\d/);
    expect(ld(text)[0].offers).toBeUndefined();
  });
  it('escapes the title everywhere, JSON-LD included; no pictures is fine', async () => {
    const {text, status} = await get('/works/work-5');
    expect(status).toBe(200);
    expect(text).not.toContain('<script>alert');
    expect(ld(text)[0].name).toBe('Tiny <script>alert(1)</script> & "quotes"');
    expect(text).toContain('<meta name="description" content="Tiny &lt;script&gt;');
  });
  it('previous / next in newest-first order', async () => {
    const {text} = await get('/works/work-2');
    expect(text).toContain('href="/works/work-1" rel="prev"');
    expect(text).toContain('href="/works/work-3" rel="next"');
  });
  it('unknown slug is the 404 page', async () => {
    const r = await get('/works/no-such-work');
    expect(r.status).toBe(404);
    expect(r.text).toContain('<h1>Not found</h1>');
    expect(r.text).toContain('noindex');
  });
  it('description falls back to title, medium and size', async () => {
    fixture.works[0]!.description = null;
    const {text} = await get('/works/work-1');
    expect(text).toContain('<meta name="description" content="Strata by Test Studio, cement, plaster, 36 × 24 in." />');
  });

  it('see it on your wall (stage 5): a hidden, scripts-only button with the size and the 1600 picture', async () => {
    const {text} = await get('/works/work-1');
    const b = /<button[^>]*data-wall[^>]*>/s.exec(text)?.[0] ?? '';
    expect(b).toMatch(/hidden/);
    expect(b).toMatch(/data-js/);
    expect(b).toContain('data-w="24"');
    expect(b).toContain('data-h="36"');
    expect(b).toContain('data-d=""');
    expect(b).toContain('data-unit="in"');
    expect(b).toMatch(/data-img="[^"]*W1A[^"]*\/1600\.webp"/);
    // The wall code loads only on the tap: not one of the page's scripts.
    expect(text).not.toContain('/site/wall');
  });
  it('no wall button without a size or a picture', async () => {
    fixture.works[0]!.width = null;
    expect((await get('/works/work-1')).text).not.toContain('data-wall');
    expect((await get('/works/work-5')).text).not.toContain('data-wall');
  });
});
