// Stage 4 (D-144…D-154): Add to cart, the shipping line, /buy/{slug}, /cart and /thanks/{id}. public/site/buy.js draws them.
import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

describe('buying pages', () => {
  it('a priced, available piece with shipping set has a hidden Add to cart and says how it ships', async () => {
    const {text} = await get('/works/work-1');
    expect(text).toMatch(/<a class="btn" href="\/buy\/work-1" hidden data-buy data-piece="work-1">Add to cart<\/a>/);
    expect(text).toContain('Worked out from your ZIP code in the cart (US)');
    expect(text).toContain('/site/buy.js');
  });
  it('shipping lines: free, flat, and quote (a quote piece has no Add to cart)', async () => {
    fixture.works[0]!.shipping = {tier: 1, cents: 0, estimate: false, quote: false};
    expect((await get('/works/work-1')).text).toContain('Free in the US');
    reset();
    fixture.works[0]!.shipping = {tier: 2, cents: 2200, estimate: false, quote: false};
    expect((await get('/works/work-1')).text).toContain('$22 in the US');
    reset();
    fixture.works[0]!.shipping = {tier: 4, cents: null, estimate: false, quote: true};
    const q = (await get('/works/work-1')).text;
    expect(q).toContain('By quote');
    expect(q).not.toContain('data-buy');
    reset();
    fixture.works[0]!.shipping = null;
    expect((await get('/works/work-1')).text).not.toContain('data-buy');
  });
  it('no Buy link for a sold, reserved or unpriced piece', async () => {
    fixture.works[0]!.status = 'sold';
    expect((await get('/works/work-1')).text).not.toContain('data-buy');
    reset();
    fixture.works[0]!.priceCents = null;
    expect((await get('/works/work-1')).text).not.toContain('data-buy');
  });
  it('/buy/{slug}: the piece, the form shell with its price, never cached or indexed', async () => {
    const r = await get('/buy/work-1');
    expect(r.status).toBe(200);
    expect(r.text).toContain('<h1>Buy Strata</h1>');
    expect(r.text).toMatch(/id="buy"[\s\S]*data-piece="work-1"/);
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    expect(r.res.headers.get('x-robots-tag')).toBe('noindex');
  });
  it('/buy/{slug} for a sold piece says so and shows the contact buttons; unknown piece is 404', async () => {
    fixture.works[0]!.status = 'sold';
    const r = await get('/buy/work-1');
    expect(r.text).not.toContain('id="buy"');
    expect(r.text).toContain('This piece is sold');
    expect(r.text).toContain('data-contact="sms"');
    expect((await get('/buy/no-such-piece')).status).toBe(404);
  });
  it('/cart: a shell for the cart, never cached or indexed', async () => {
    const r = await get('/cart');
    expect(r.status).toBe(200);
    expect(r.text).toContain('<h1>Your cart</h1>');
    expect(r.text).toContain('id="cart"');
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    expect(r.res.headers.get('x-robots-tag')).toBe('noindex');
  });
  it('/thanks/{id}: a shell for one order id, unlisted; a bad id is 404', async () => {
    const r = await get('/thanks/01M7877AD7SXQDW23PZHDH5YS9');
    expect(r.status).toBe(200);
    expect(r.text).toContain('data-order="01M7877AD7SXQDW23PZHDH5YS9"');
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    expect((await get('/thanks/not-an-order')).status).toBe(404);
  });
});
