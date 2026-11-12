// Stage 4 (D-144): the piece's Buy button, /buy/{slug} and /thanks/{id}. The forms are drawn by public/site/buy.js.
import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

describe('buying pages', () => {
  it('a priced, sized, available piece has a hidden Buy link with its size in inches', async () => {
    const {text} = await get('/works/work-1');
    expect(text).toMatch(/<a class="btn" href="\/buy\/work-1" hidden data-buy data-inches="36">Buy<\/a>/);
    expect(text).toContain('/site/buy.js');
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
    expect(r.text).toMatch(/id="buy"[\s\S]*data-piece="work-1"[\s\S]*data-price="480000"[\s\S]*data-inches="36"/);
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
  it('/thanks/{id}: a shell for one order id, unlisted; a bad id is 404', async () => {
    const r = await get('/thanks/01M7877AD7SXQDW23PZHDH5YS9');
    expect(r.status).toBe(200);
    expect(r.text).toContain('data-order="01M7877AD7SXQDW23PZHDH5YS9"');
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    expect((await get('/thanks/not-an-order')).status).toBe(404);
  });
});
