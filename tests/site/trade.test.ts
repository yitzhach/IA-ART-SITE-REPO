import {beforeEach, describe, expect, it} from 'vitest';
import {api, fixture, get, reset, SLUG} from './fake-api';
import {siteData} from '../../worker/site/data';
import {sitemap} from '../../worker/site/extras';

beforeEach(reset);

const TRADE = {
  title: 'For designers and architects',
  lede: 'Original work for your projects.',
  sections: [{heading: 'Working together', body: 'Send the room and the size.'}],
};

describe('/trade (card C)', () => {
  it('not found, and off the footer and sitemap, until the page is saved', async () => {
    expect((await get('/trade')).status).toBe(404);
    fixture.studio.pages.trade = {title: '  ', sections: [{heading: '', body: ''}]};
    expect((await get('/trade')).status).toBe(404);
    expect((await get('/about')).text).not.toContain('href="/trade"');
    expect(await (await sitemap('https://a.test', siteData(api, SLUG))).text()).not.toContain('/trade');
  });

  it('once saved: its words, then the trade, commission, installation and shipping answers', async () => {
    fixture.studio.pages.trade = TRADE;
    fixture.answers = {
      ...fixture.answers,
      trade: 'Designers get 15% off.',
      commissionTimeline: 'Six to eight weeks.',
      materials: 'Not on this page.',
    };
    const {status, text} = await get('/trade');
    expect(status).toBe(200);
    expect(text).toContain('<title>For designers and architects — Test Studio</title>');
    expect(text).toContain('<h1>For designers and architects</h1>');
    expect(text).toContain('Original work for your projects.');
    expect(text).toContain('Send the room and the size.');
    const heads = [...text.matchAll(/<h2 id="t-([a-zA-Z]+)">([^<]+)<\/h2>/g)].map(m => m[2]);
    expect(heads).toEqual(['Trade pricing', 'Commissions to size and lead time', 'Installation', 'Shipping']);
    expect(text).toContain('Designers get 15% off.');
    expect(text).not.toContain('Not on this page.');
    expect(text).toContain('Start a conversation');
    expect((await get('/about')).text).toMatch(/<nav aria-label="Footer">[\s\S]*href="\/trade"[^>]*>For designers/);
    expect(await (await sitemap('https://a.test', siteData(api, SLUG))).text()).toContain(
      '<loc>https://a.test/trade</loc>',
    );
  });

  it('a missing answer just leaves its heading out', async () => {
    fixture.studio.pages.trade = TRADE;
    fixture.answers = {};
    const {text} = await get('/trade');
    expect(text).not.toContain('Trade pricing');
    expect(text).not.toContain('Installation');
  });
});

describe('spec sheet (card C)', () => {
  it('one printable page: picture, title, both units, medium, year, price, email, address; never the phone', async () => {
    const {status, text} = await get('/works/work-1/spec');
    expect(status).toBe(200);
    expect(text).toContain('<title>Spec sheet: Strata — Test Studio</title>');
    expect(text).toContain('<meta name="robots" content="noindex">');
    expect(text).toContain('<h1 id="spec-h">Strata</h1>');
    expect(text).toMatch(/<dt>Size<\/dt>\s*<dd>36 × 24 in \(91\.4 × 61 cm\)<\/dd>/);
    expect(text).toMatch(/<dt>Medium<\/dt>\s*<dd>Cement, plaster<\/dd>/);
    expect(text).toMatch(/<dt>Price<\/dt>\s*<dd>\$4,800<\/dd>/);
    expect(text).toMatch(/<dt>Contact<\/dt>\s*<dd>studio@example\.com<\/dd>/);
    expect(text).toContain('https://site.test/works/work-1');
    expect(text).toContain('W1A');
    expect(text).toContain('data-print');
    expect(text).not.toContain('5551234567');
  });

  it('no price: "Price on request"; sold: says so; unknown piece: not found', async () => {
    expect((await get('/works/work-3/spec')).text).toMatch(/<dt>Price<\/dt>\s*<dd>Price on request<\/dd>/);
    expect((await get('/works/work-2/spec')).text).toMatch(/<dt>Price<\/dt>\s*<dd>Sold/);
    expect((await get('/works/nope/spec')).status).toBe(404);
  });

  it('each piece page links its spec sheet', async () => {
    expect((await get('/works/work-1')).text).toContain('href="/works/work-1/spec"');
  });
});
