import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

describe('works', () => {
  it('lists works numbered, with status chips', async () => {
    const {text} = await get('/works');
    expect(text).toContain('<title>Works — Test Studio</title>');
    expect(text).toMatch(/<h1>Works<\/h1>/);
    expect(text).toContain('No. 01');
    expect(text).toContain('No. 05');
    expect(text).toContain('$4,800');
    expect(text).toContain('>Sold<');
    expect(text).toContain('>Reserved<');
    expect(text).toContain('Price on request');
    expect(text).not.toContain('<script>alert');
    expect(text).toContain('Tiny &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;');
  });
  it('filters are links that keep the other filter', async () => {
    const {text} = await get('/works?collection=Abstract&status=sold');
    expect(text).toContain('href="/works?status=sold"'); // All collections, status kept
    expect(text).toContain('href="/works?collection=Abstract"'); // All statuses, collection kept
    expect(text).toContain('href="/works?collection=Figurative&amp;status=sold"');
    expect(text).toMatch(/href="\/works\?collection=Abstract&amp;status=sold"\s+aria-current="true"/);
    expect(text).toContain('<link rel="canonical" href="https://site.test/works?collection=Abstract&amp;status=sold"');
    expect(fixture.calls).toContain(
      `/v1/public/studios/${fixture.studio.slug}/artworks?collection=Abstract&status=sold`,
    );
  });
  it('unknown filter values are ignored', async () => {
    const {text, status} = await get('/works?collection=Nope&status=weird');
    expect(status).toBe(200);
    expect(text).toContain('<link rel="canonical" href="https://site.test/works"');
  });
  it('a More link after 48 works', async () => {
    for (let n = 6; n <= 60; n++) fixture.works.push({...fixture.works[2]!, slug: `extra-${n}`, title: `Extra ${n}`});
    const {text} = await get('/works');
    expect(text).toMatch(/href="\/works\?cursor=48" rel="next">More<\/a>/);
    const p2 = await get('/works?cursor=48');
    expect(p2.text).toContain('No. 49');
    expect(p2.text).not.toContain('>More<');
  });
  it('no works → a message, not a crash', async () => {
    fixture.works = [];
    const r = await get('/works');
    expect(r.status).toBe(200);
    expect(r.text).toContain('No works match');
  });
});
