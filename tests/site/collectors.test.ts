// Stage 6 pages (D-163…D-168): a collector's private page and certificate, the follow pages and a follower's page.
// Made-up people only.
import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset, SLUG, work} from './fake-api';

const TOKEN = 'colTok_ABCdef123456789xyz';
const FTOKEN = 'folTok_ABCdef123456789xyz';
const SHOW = '01JC0000000000000000000ABC';

beforeEach(() => {
  reset();
  const owned = work(2, {title: 'Upper Limit', status: 'sold'});
  // Owned pictures come through the page's own token.
  owned.images = owned.images.map(i => ({
    ...i,
    sizes: i.sizes.map(s => ({...s, url: s.url.replace('/images/', `/collectors/${TOKEN}/images/`)})),
  }));
  const fl = {
    ...work(9, {title: 'New Ridge', priceCents: 90000, currency: 'USD'}),
    publicFrom: '2026-11-19T17:00:00.000Z',
  };
  fixture.collectors[TOKEN] = {
    firstName: 'Pat',
    studioName: 'Test Studio',
    works: [{...owned, certificate: 'TS-2022-7Q2K9D', soldOn: '2026-11-12'}],
    care: 'Keep it out of direct sun.\n\nDust with a soft dry brush.',
    firstLook: [fl],
    commissions: [
      {
        title: 'Blue heron at dusk',
        size: '24 x 36 in',
        stage: 'layering',
        status: 'open',
        notes: {surface: 'Panel primed.'},
        dueOn: null,
        updatedAt: '2026-11-12T00:00:00.000Z',
      },
    ],
    catalogueVersion: 7,
  };
  fixture.followers[FTOKEN] = {email: 'fa…@example.com', following: true, studioName: 'Test Studio', firstLook: [fl]};
  fixture.shows[SHOW] = {id: SHOW, name: 'Spring Fair', venue: 'Hall B', city: 'Austin', startsOn: null, endsOn: null};
});

describe('/c/{token}', () => {
  it('shows the collection, certificates, the commission, first look and care; private and never cached', async () => {
    const {text, status, res} = await get(`/c/${TOKEN}`);
    expect(status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(text).toContain('<meta name="robots" content="noindex">');
    expect(text).toContain('Hello, Pat');
    expect(text).toContain(`href="/c/${TOKEN}/certificate/TS-2022-7Q2K9D"`);
    expect(text).toContain('Certificate TS-2022-7Q2K9D');
    expect(text).toContain(`/collectors/${TOKEN}/images/`);
    // The commission: five stages, the current one marked, its notes.
    expect(text).toContain('Blue heron at dusk');
    expect(text).toMatch(/class="now"\s+aria-current="step"\s*>\s*<b>Layering<\/b>/);
    expect(text).toContain('Panel primed.');
    // First look: no link to a public page that doesn't exist yet; Add to cart waits for the script.
    expect(text).toContain('New Ridge');
    expect(text).not.toContain('href="/works/work-9"');
    expect(text).toMatch(/<button\s+class="btn fl-buy"\s+type="button"\s+hidden\s+data-fl="work-9"/);
    expect(text).toContain('On the public site November 19');
    expect(text).toContain('Dust with a soft dry brush.');
    expect(text).toContain('/site/collector.js');
    expect(text).toContain(`data-collector="${TOKEN}"`);
  });
  it('an unknown or stopped link is the not-found page', async () => {
    const r = await get('/c/nopeNOPEnope1234567890');
    expect(r.status).toBe(404);
    expect(r.text).not.toContain('Hello,');
  });
  it('escapes what the studio wrote', async () => {
    fixture.collectors[TOKEN]!.firstName = '<b>Pat</b>';
    fixture.collectors[TOKEN]!.care = '<script>alert(1)</script>';
    const {text} = await get(`/c/${TOKEN}`);
    expect(text).not.toContain('<b>Pat</b>');
    expect(text).not.toContain('<script>alert(1)</script>');
    expect(text).toContain('&lt;b&gt;Pat');
  });
  it('a collector with nothing yet', async () => {
    Object.assign(fixture.collectors[TOKEN]!, {works: [], firstLook: [], commissions: [], care: null});
    const {text, status} = await get(`/c/${TOKEN}`);
    expect(status).toBe(200);
    expect(text).toContain('will show here once the studio adds them');
    expect(text).not.toContain('First look');
    expect(text).not.toContain('Your commission');
  });
});

describe('/c/{token}/certificate/{number}', () => {
  it('lays out the certificate to print', async () => {
    const {text, status, res} = await get(`/c/${TOKEN}/certificate/TS-2022-7Q2K9D`);
    expect(status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(text).toContain('Certificate of authenticity');
    expect(text).toContain('Upper Limit');
    expect(text).toContain('TS-2022-7Q2K9D');
    expect(text).toContain('2026-11-12');
    expect(text).toContain('an original work by Test Studio');
    expect(text).toContain('data-print hidden');
  });
  it("another work's number on this link: not found", async () => {
    expect((await get(`/c/${TOKEN}/certificate/TS-2022-AAAAAA`)).status).toBe(404);
  });
});

describe('following', () => {
  it('the footer links to /follow; the form waits for its script', async () => {
    expect((await get('/works')).text).toContain('href="/follow"');
    const {text, status, res} = await get('/follow');
    expect(status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(text).toMatch(/<form class="follow-form" data-follow data-show="" hidden>/);
    expect(text).toContain('name="website"');
  });
  it("a show's QR page names the show and tags the follow with it", async () => {
    const {text, status} = await get(`/follow/${SHOW}`);
    expect(status).toBe(200);
    expect(text).toContain('Spring Fair · Hall B, Austin');
    expect(text).toContain(`data-show="${SHOW}"`);
    expect((await get('/follow/01JC0000000000000000000XYZ')).status).toBe(404);
  });
  it("a follower's page: first look and Stop; after stopping, Follow again", async () => {
    let r = await get(`/f/${FTOKEN}`);
    expect(r.status).toBe(200);
    expect(r.text).toContain('New work comes to fa…@example.com first.');
    expect(r.text).toContain('New Ridge');
    expect(r.text).toContain('data-stop hidden');
    fixture.followers[FTOKEN] = {...fixture.followers[FTOKEN]!, following: false, firstLook: []};
    r = await get(`/f/${FTOKEN}`);
    expect(r.text).toContain('You stopped following');
    expect(r.text).not.toContain('New Ridge');
    expect(r.text).toContain('href="/follow"');
  });
  it('asks studio-api only for this studio', async () => {
    await get(`/c/${TOKEN}`);
    expect(fixture.calls.every(c => c.startsWith(`/v1/public/studios/${SLUG}`))).toBe(true);
  });
});
