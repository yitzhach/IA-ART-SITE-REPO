// Shows (D-182): the list, one page per show, the ExhibitionEvent markup, the nav link and the sitemap entries.
// Made-up shows only.
import {beforeEach, describe, expect, it} from 'vitest';
import {showDates, showPlace, showTitle} from '../../worker/site/pages/shows';
import {fixture, get, img, photo, reset, work} from './fake-api';

const ldOf = (text: string) =>
  [...text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]!));

beforeEach(() => {
  reset();
  fixture.showPages = [
    {
      slug: 'bay-fair-2030',
      name: 'Bay Fair',
      venue: 'Pier 9 Hall',
      city: 'Seaport',
      startsOn: '2030-12-02',
      endsOn: '2030-12-06',
      booth: 'A14',
      cover: img('booth1', 1.33),
      workCount: 2,
      photoCount: 2,
      description: 'Five days on the pier.\n\nMost of the new cement panels came along.',
      website: 'https://bayfair.example/',
      photos: [photo('booth1', 'Bay Fair booth'), photo('booth2', 'Bay Fair wall', 'work-1')],
      works: [work(1, {title: 'Strata'}), work(2, {title: 'Upper Limit', status: 'sold'})],
    },
    {
      slug: 'spring-market-2020',
      name: 'Spring Market 2020',
      venue: null,
      city: 'Hilltown',
      startsOn: '2020-04-10',
      endsOn: null,
      booth: null,
      cover: null,
      workCount: 0,
      photoCount: 0,
      description: null,
      website: null,
      photos: [],
      works: [],
    },
  ];
});

describe('dates, titles and places', () => {
  it('reads like a person would write them', () => {
    expect(showDates('2026-12-02', '2026-12-06')).toBe('December 2–6, 2026');
    expect(showDates('2026-11-30', '2026-12-02')).toBe('November 30 – December 2, 2026');
    expect(showDates('2026-12-30', '2027-01-02')).toBe('December 30, 2026 – January 2, 2027');
    expect(showDates('2026-12-02', null)).toBe('December 2, 2026');
    expect(showDates(null, null)).toBe('');
    expect(showTitle({name: 'Red Dot Miami', startsOn: '2026-12-02', endsOn: null})).toBe('Red Dot Miami 2026');
    expect(showTitle({name: 'Spring Market 2020', startsOn: '2020-04-10', endsOn: null})).toBe('Spring Market 2020');
    expect(showPlace({name: 'X', venue: 'Mana Wynwood', city: 'Miami'})).toBe('Mana Wynwood, Miami');
    expect(showPlace({name: 'X', venue: 'Miami Beach Convention Center', city: 'Miami'})).toBe(
      'Miami Beach Convention Center',
    );
  });
});

describe('/shows', () => {
  it('lists coming and past shows, each linking to its page', async () => {
    const {status, text} = await get('/shows');
    expect(status).toBe(200);
    expect(text).toContain('<title>Shows — Test Studio</title>');
    expect(text).toMatch(/Coming up[\s\S]*Bay Fair 2030[\s\S]*Past shows[\s\S]*Spring Market 2020/);
    expect(text).toContain('href="/shows/bay-fair-2030"');
    expect(text).toContain('December 2–6, 2030 · Pier 9 Hall, Seaport · Booth A14');
    expect(text).toContain('2 works shown');
    const list = ldOf(text).find(o => o['@type'] === 'ItemList');
    expect(list.itemListElement.map((i: any) => i.url)).toEqual([
      'https://site.test/shows/bay-fair-2030',
      'https://site.test/shows/spring-market-2020',
    ]);
  });

  it('says so when there are none, and the nav leaves Shows out', async () => {
    fixture.showPages = [];
    const {status, text} = await get('/shows');
    expect(status).toBe(200);
    expect(text).toContain('No shows listed yet');
    expect((await get('/works')).text).not.toContain('href="/shows"');
  });

  it('every page’s nav links Shows once a show page is published', async () => {
    const {text} = await get('/works');
    expect(text.match(/<nav aria-label="Main">[\s\S]*?<\/nav>/)![0]).toContain('href="/shows"');
    expect((await get('/shows')).text).toMatch(/href="\/shows"\s+aria-current="page"/);
  });
});

describe('/shows/{slug}', () => {
  it('has a title and description naming the show and the city, the booth photos and the works shown', async () => {
    const {status, text} = await get('/shows/bay-fair-2030');
    expect(status).toBe(200);
    expect(text).toContain('<title>Bay Fair 2030, Seaport — Test Studio</title>');
    expect(text).toMatch(
      /<meta name="description" content="Test Studio at Bay Fair 2030, Pier 9 Hall, Seaport, December 2–6, 2030, booth a14\. Booth photos and the 2 works shown\."/,
    );
    expect(text).toContain('<link rel="canonical" href="https://site.test/shows/bay-fair-2030" />');
    expect(text).toContain('Five days on the pier.');
    expect(text).toMatch(/The booth[\s\S]*Alt for booth1[\s\S]*Works shown[\s\S]*Strata[\s\S]*Upper Limit/);
    expect(text).toContain('href="/works/work-1"'); // a booth photo that is a work links to it
    expect(text).toContain('<span class="chip">Sold</span>');
    expect(text).toContain('href="https://bayfair.example/" rel="noopener external"');
    expect(text).toContain('property="og:image"');
  });

  it('marks the show up as an ExhibitionEvent with the works it featured', async () => {
    const ld = ldOf((await get('/shows/bay-fair-2030')).text);
    const ev = ld.find(o => o['@type'] === 'ExhibitionEvent');
    expect(ev).toMatchObject({
      name: 'Test Studio at Bay Fair 2030',
      url: 'https://site.test/shows/bay-fair-2030',
      startDate: '2030-12-02',
      endDate: '2030-12-06',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {'@type': 'Place', name: 'Pier 9 Hall', address: {addressLocality: 'Seaport'}},
      performer: {'@id': 'https://site.test/#artist'},
      organizer: {'@type': 'Organization', name: 'Bay Fair', url: 'https://bayfair.example/'},
    });
    expect(ev.workFeatured.map((w: any) => w.url)).toEqual([
      'https://site.test/works/work-1',
      'https://site.test/works/work-2',
    ]);
    expect(ev.image[0]).toMatch(/^https:\/\/site\.test\/v1\/public\/studios\/.*\/1600\.webp$/);
    expect(ld.filter(o => o['@type'] === 'BreadcrumbList')).toHaveLength(1);
    expect(ld.find(o => o['@type'] === 'BreadcrumbList').itemListElement).toHaveLength(3);
  });

  it('a show with nothing yet still has a page; an unknown one is a 404', async () => {
    const {status, text} = await get('/shows/spring-market-2020');
    expect(status).toBe(200);
    expect(text).toContain('<h1>Spring Market 2020</h1>');
    expect(text).not.toContain('The booth');
    expect((await get('/shows/no-such-show')).status).toBe(404);
    expect((await get('/shows/Bad_Slug')).status).toBe(404);
  });

  it('writes what the artist typed as text, never as HTML', async () => {
    fixture.showPages[0]!.description = '<img src=x onerror=alert(1)>';
    fixture.showPages[0]!.name = 'Bay <b>Fair</b>';
    const {text} = await get('/shows/bay-fair-2030');
    expect(text).not.toContain('<img src=x');
    expect(text).not.toContain('<b>Fair</b>');
    expect(text).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('sitemap and llms.txt', () => {
  it('list the Shows page and every show page', async () => {
    const map = (await get('/sitemap.xml')).text;
    expect(map).toContain('<loc>https://site.test/shows</loc>');
    expect(map).toContain('<loc>https://site.test/shows/bay-fair-2030</loc>');
    expect(map).toContain('<loc>https://site.test/shows/spring-market-2020</loc>');
    const llms = (await get('/llms.txt')).text;
    expect(llms).toContain('- [Shows](https://site.test/shows)');
    expect(llms).toContain(
      '- [Bay Fair 2030](https://site.test/shows/bay-fair-2030): 2030-12-02 to 2030-12-06, Pier 9 Hall, Seaport, booth A14',
    );
  });

  it('leave shows out when there are none, and still work if studio-api has no show pages yet', async () => {
    fixture.showPages = [];
    expect((await get('/sitemap.xml')).text).not.toContain('/shows');
    expect((await get('/llms.txt')).text).not.toContain('/shows');
  });
});
