// Card E (D-176): AI search welcomed by name, /llms.txt, and the artist as a Person on About.
import {beforeEach, describe, expect, it} from 'vitest';
import {AI_CRAWLERS, robots} from '../../worker/site/extras';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

const ld = (text: string): Record<string, unknown>[] =>
  [...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]!));

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
});
