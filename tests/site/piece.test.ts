import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

const ld = (text: string) =>
  [...text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]!));

describe('a piece', () => {
  it('priced work: title, facts, price, contact links with title and URL, JSON-LD offer', async () => {
    const {text} = await get('/works/work-1');
    expect(text).toContain('<title>Strata — Test Studio</title>');
    expect(text).toMatch(/<h1>Strata<\/h1>/);
    expect(text).toContain('36 × 24 in (91.4 × 61 cm)');
    expect(text).toContain('Cement, plaster');
    expect(text).toContain('$4,800');
    const sms = /href="(sms:[^"]+)"/.exec(text)![1]!.replace(/&amp;/g, '&');
    expect(sms.startsWith('sms:+15551234567?&body=')).toBe(true);
    const msg = decodeURIComponent(sms.split('body=')[1]!);
    expect(msg).toContain('Strata');
    expect(msg).toContain('https://site.test/works/work-1');
    expect(text).toMatch(/href="mailto:studio@example.com\?subject=About%20Strata/);
    expect(text).toMatch(/<button[^>]*hidden[^>]*data-inquiry/);
    expect(text).toContain('/site/lightbox.js');
    expect(text).toMatch(/<a href="[^"]*W1B[^"]*\/1600\.webp" data-lb/);
    const [art] = ld(text);
    expect(art['@type']).toBe('VisualArtwork');
    expect(art.image).toMatch(/^https:\/\/site\.test\/.*\/960\.webp$/);
    expect(art.creator).toEqual({'@type': 'Person', name: 'Test Studio'});
    expect(art.offers).toMatchObject({
      price: '4800.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    });
    expect(art.height).toMatchObject({value: 36, unitText: 'in'});
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
    expect(text).toContain('<meta name="description" content="Strata — Cement, plaster, 36 × 24 in (91.4 × 61 cm)"');
  });
});
