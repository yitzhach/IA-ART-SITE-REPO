// Visitor numbers (card G, D-177): a person's view of a piece page counts once, with nothing about them; bots and
// prefetches don't; the page scripts' /count carries no cookie either way.
import {beforeEach, describe, expect, it} from 'vitest';
import worker from '../../worker/index';
import {COUNT_BODY_MAX, fromAPerson} from '../../worker/site/counts';
import {env, fixture, get, reset} from './fake-api';

const PERSON =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const workerEnv = {...env, ASSISTANT: env.API, ASSETS: env.API} as never;
const beacon = (body: unknown, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request('https://site.test/count', {
      method: 'POST',
      headers: {'content-type': 'application/json', 'user-agent': PERSON, cookie: 'sv=someone', ...headers},
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    workerEnv,
  );

beforeEach(reset);

describe('who counts', () => {
  it('a phone browser does; crawlers, previews, scripted browsers and empty agents do not', () => {
    const r = (ua: string, h: Record<string, string> = {}) =>
      fromAPerson(new Request('https://x/', {headers: {'user-agent': ua, ...h}}));
    expect(r(PERSON)).toBe(true);
    for (const ua of [
      '',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      'ClaudeBot/1.0',
      'facebookexternalhit/1.1',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse',
      'curl/8.5.0',
    ])
      expect(r(ua), ua).toBe(false);
    expect(r(PERSON, {'sec-purpose': 'prefetch'})).toBe(false);
    expect(r(PERSON, {purpose: 'prefetch'})).toBe(false);
  });
});

describe('a piece page', () => {
  it('counts one view of that piece for a person, with no cookie or address passed on', async () => {
    const res = await get('/works/work-1', {
      headers: {'user-agent': PERSON, cookie: 'sv=someone', 'cf-connecting-ip': '203.0.113.9'},
    });
    expect(res.status).toBe(200);
    expect(fixture.counts).toHaveLength(1);
    expect(fixture.counts[0]!.body).toEqual({kind: 'view', work: 'work-1'});
    expect(Object.keys(fixture.counts[0]!.headers)).toEqual(['content-type']);
  });

  it("doesn't count a bot, another page, or a HEAD", async () => {
    await get('/works/work-1', {headers: {'user-agent': 'Googlebot/2.1'}});
    await get('/works', {headers: {'user-agent': PERSON}});
    await get('/works/work-1', {method: 'HEAD', headers: {'user-agent': PERSON}});
    expect(fixture.counts).toEqual([]);
  });
});

describe('POST /count', () => {
  it('passes Ask, the wall and an inquiry on, without the cookie, and answers bare', async () => {
    for (const body of [{kind: 'ask'}, {kind: 'wall', work: 'work-1'}, {kind: 'inquiry', work: 'work-3'}]) {
      const res = await beacon(body);
      expect(res.status).toBe(204);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
    expect(fixture.counts.map(c => c.body)).toEqual([
      {kind: 'ask'},
      {kind: 'wall', work: 'work-1'},
      {kind: 'inquiry', work: 'work-3'},
    ]);
    expect(fixture.counts.every(c => !('cookie' in c.headers) && !('x-visitor-key' in c.headers))).toBe(true);
  });

  it('refuses views (only a page load counts one), unknown kinds, bad slugs, bad JSON and large bodies', async () => {
    expect((await beacon({kind: 'view', work: 'work-1'})).status).toBe(400);
    expect((await beacon({kind: 'order'})).status).toBe(400);
    expect((await beacon({kind: 'ask', work: '../etc'})).status).toBe(400);
    expect((await beacon('not json')).status).toBe(400);
    expect((await beacon(JSON.stringify({kind: 'ask', pad: 'x'.repeat(COUNT_BODY_MAX)}))).status).toBe(413);
    expect(fixture.counts).toEqual([]);
  });

  it('answers a bot without counting, and only takes POST', async () => {
    expect((await beacon({kind: 'ask'}, {'user-agent': 'GPTBot/1.2'})).status).toBe(204);
    expect(fixture.counts).toEqual([]);
    expect((await worker.fetch(new Request('https://site.test/count'), workerEnv)).status).toBe(405);
  });
});
