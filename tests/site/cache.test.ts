import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cached} from '../../worker/site/cache';
import {env, fixture, reset} from './fake-api';
import {site} from '../../worker/site/index';

class FakeCache {
  store = new Map<string, Response>();
  puts = 0;
  async match(r: Request) {
    return this.store.get(r.url)?.clone();
  }
  async put(r: Request, res: Response) {
    this.puts++;
    this.store.set(r.url, res);
  }
}
let cache: FakeCache;
beforeEach(() => {
  reset();
  cache = new FakeCache();
  (globalThis as any).caches = {default: cache};
});
afterEach(() => delete (globalThis as any).caches);

const req = (path = '/works', method = 'GET', headers?: HeadersInit) =>
  new Request('https://site.test' + path, {method, headers});
const make = (status = 200) => {
  let n = 0;
  return {calls: () => n, produce: async () => (n++, new Response(`page ${n}`, {status}))};
};

describe('edge cache', () => {
  it('misses, then hits, and the browser is told to re-check in 60 s', async () => {
    const m = make();
    const a = await cached(req(), 1, undefined, m.produce);
    expect(a.headers.get('x-site-cache')).toBe('miss');
    expect(a.headers.get('cache-control')).toBe('public, max-age=60');
    const b = await cached(req(), 1, undefined, m.produce);
    expect(b.headers.get('x-site-cache')).toBe('hit');
    expect(b.headers.get('cache-control')).toBe('public, max-age=60');
    expect(await b.text()).toBe('page 1');
    expect(m.calls()).toBe(1);
    const stored = [...cache.store.values()][0]!;
    expect(stored.headers.get('cache-control')).toBe('public, s-maxage=86400');
    expect([...cache.store.keys()][0]).toContain('__v=1');
  });
  it('a new catalogue version misses', async () => {
    const m = make();
    await cached(req(), 1, undefined, m.produce);
    const r = await cached(req(), 2, undefined, m.produce);
    expect(r.headers.get('x-site-cache')).toBe('miss');
    expect(m.calls()).toBe(2);
  });
  it('a client-sent __v cannot pick the key; cookies are ignored', async () => {
    const m = make();
    await cached(req('/works?__v=9', 'GET', {cookie: 'studio_session=x'}), 1, undefined, m.produce);
    const r = await cached(req('/works?__v=8'), 1, undefined, m.produce);
    expect(r.headers.get('x-site-cache')).toBe('hit');
  });
  it('HEAD is served from the GET entry, without a body', async () => {
    const m = make();
    await cached(req(), 1, undefined, m.produce);
    const h = await cached(req('/works', 'HEAD'), 1, undefined, m.produce);
    expect(h.headers.get('x-site-cache')).toBe('hit');
    expect(await h.text()).toBe('');
    expect(m.calls()).toBe(1);
  });
  it('never caches a 503 or other errors', async () => {
    for (const s of [503, 500, 302]) {
      const m = make(s);
      await cached(req('/x' + s), 1, undefined, m.produce);
      await cached(req('/x' + s), 1, undefined, m.produce);
      expect(m.calls()).toBe(2);
    }
    expect(cache.puts).toBe(0);
  });
  it('caches a 404 page for only 60 s', async () => {
    const m = make(404);
    await cached(req('/nope'), 1, undefined, m.produce);
    expect([...cache.store.values()][0]!.headers.get('cache-control')).toBe('public, s-maxage=60');
    const r = await cached(req('/nope'), 1, undefined, m.produce);
    expect(r.status).toBe(404);
    expect(r.headers.get('x-site-cache')).toBe('hit');
  });
  it('never caches non-GET', async () => {
    const m = make();
    await cached(req('/works', 'POST'), 1, undefined, m.produce);
    expect(cache.puts).toBe(0);
  });
  it('stores through ctx.waitUntil when given', async () => {
    const waits: Promise<unknown>[] = [];
    const ctx = {waitUntil: (p: Promise<unknown>) => void waits.push(p)} as unknown as ExecutionContext;
    await cached(req(), 1, ctx, make().produce);
    expect(waits).toHaveLength(1);
    await Promise.all(waits);
    expect(cache.puts).toBe(1);
  });
  it('works without a Cache API (Node)', async () => {
    delete (globalThis as any).caches;
    const r = await cached(req(), 1, undefined, make().produce);
    expect(r.status).toBe(200);
  });
});

describe('site() with the cache', () => {
  it('a publish (new catalogue version) shows at once; pages carry security headers', async () => {
    const get = () => site(new Request('https://site.test/'), env);
    const a = await get();
    expect(a.headers.get('x-site-cache')).toBe('miss');
    expect(a.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(a.headers.get('x-content-type-options')).toBe('nosniff');
    expect(a.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect((await get()).headers.get('x-site-cache')).toBe('hit');
    fixture.studio.catalogueVersion += 1;
    expect((await get()).headers.get('x-site-cache')).toBe('miss');
  });
});
