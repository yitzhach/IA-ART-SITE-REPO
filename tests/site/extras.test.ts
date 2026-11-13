import {beforeEach, describe, expect, it} from 'vitest';
import {oldAddress, robots, sitemap} from '../../worker/site/extras';
import {api, env, fixture, reset, SLUG} from './fake-api';
import {siteData} from '../../worker/site/data';
import {site} from '../../worker/site/index';

beforeEach(reset);

describe('oldAddress', () => {
  const table: [string, string][] = [
    ['/index.html', '/'],
    ['/available.html', '/works?status=available'],
    ['/gallery.html', '/works'],
    ['/collection-abstract.html', '/works?collection=Abstract'],
    ['/collection-figurative.html', '/works?collection=Figurative'],
    ['/collection-sculptural.html', '/works?collection=Sculptural'],
    ['/commissions.html', '/commissions'],
    ['/process.html', '/process'],
    ['/about.html', '/about'],
    ['/studio.html', '/studio'],
    ['/works/', '/works'],
    ['/commissions/', '/commissions'],
    ['/process/', '/process'],
    ['/about/', '/about'],
  ];
  for (const [from, to] of table) it(`${from} → ${to}`, () => expect(oldAddress(from)).toBe(to));
  it('leaves everything else alone', () => {
    for (const p of ['/', '/works', '/works/work-1', '/works/work-1/', '/studio/x', '/nothing', '/robots.txt'])
      expect(oldAddress(p), p).toBeNull();
  });
  it('redirects permanently, on the request origin', async () => {
    const r = await site(new Request('https://site.test/available.html'), env);
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://site.test/works?status=available');
  });
});

describe('robots.txt', () => {
  it('allows all, keeps the app and the APIs out, points at the sitemap', async () => {
    const t = await robots('https://a.test').text();
    for (const l of [
      'Allow: /',
      'Disallow: /studio',
      'Disallow: /v1/',
      'Disallow: /assistant/',
      'Sitemap: https://a.test/sitemap.xml',
    ])
      expect(t).toContain(l);
  });
});

describe('sitemap.xml', () => {
  it('lists the pages and every public work with lastmod, on the request origin', async () => {
    const r = await sitemap('https://a.test', siteData(api, SLUG));
    expect(r.headers.get('content-type')).toContain('application/xml');
    const x = await r.text();
    for (const p of ['/', '/works', '/commissions', '/process', '/about'])
      expect(x).toContain(`<loc>https://a.test${p}</loc>`);
    for (const w of fixture.works) expect(x).toContain(`<loc>https://a.test/works/${w.slug}</loc>`);
    expect(x).toContain(`<lastmod>${fixture.works[0]!.publishedAt}</lastmod>`);
  });
  it('escapes XML and pages through cursors', async () => {
    const w0 = fixture.works[0]!;
    fixture.works.push(...Array.from({length: 100}, (_, i) => ({...w0, slug: `m-${i}`})));
    fixture.works.push({...w0, slug: 'a&b'});
    const x = await (await sitemap('https://a.test/?x=<', siteData(api, SLUG))).text();
    expect(x).toContain('/works/m-99<');
    expect(x).toContain('/works/a%26b<');
    expect(x).toContain('https://a.test/?x=&lt;/');
    // Five pages, /questions (the fixture has saved answers), then the works.
    expect(x.match(/<url>/g)!.length).toBe(6 + fixture.works.length);
  });
  it('is served at /sitemap.xml', async () => {
    const r = await site(new Request('https://site.test/sitemap.xml'), env);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('<urlset');
  });
});
