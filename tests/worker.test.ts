import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import worker, {type Env} from '../worker/index';

const fake = (name: string, type = 'text/plain'): Fetcher =>
  ({
    fetch: async (r: Request) => new Response(`${name}:${new URL(r.url).pathname}`, {headers: {'content-type': type}}),
  }) as unknown as Fetcher;
const env: Env = {API: fake('api'), ASSISTANT: fake('assistant'), ASSETS: fake('assets', 'text/html; charset=utf-8')};
const call = (path: string) => worker.fetch(new Request('https://x.test' + path), env);

describe('worker', () => {
  it('routes /v1/* to API', async () => expect(await (await call('/v1/me')).text()).toBe('api:/v1/me'));
  it('routes /assistant/* to ASSISTANT', async () =>
    expect(await (await call('/assistant/chat')).text()).toBe('assistant:/assistant/chat'));
  it('serves the public site at / (not set up without STUDIO_SLUG)', async () => {
    const r = await call('/');
    expect(r.status).toBe(503);
    expect(r.headers.get('content-security-policy')).toContain("default-src 'self'");
  });
  it('adds the CSP and security headers to HTML', async () => {
    const r = await call('/studio');
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(r.headers.get('content-security-policy')).toContain('https://raw.githubusercontent.com');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
  it('redirects the old /index.html to /', async () => {
    const r = await call('/index.html');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://x.test/');
  });
  it('leaves API responses alone', async () =>
    expect((await call('/v1/me')).headers.get('content-security-policy')).toBeNull());
  it('lets the CSP run WebAssembly (the Safari WebP fallback) and load signed pictures', async () => {
    const csp = (await call('/studio')).headers.get('content-security-policy')!;
    expect(csp).toMatch(/script-src 'self' 'wasm-unsafe-eval'(;|$)/);
    expect(csp).toMatch(/img-src 'self'/);
    expect(csp).toContain("connect-src 'self' https://raw.githubusercontent.com");
  });
});

describe('wrangler.jsonc', () => {
  const text = readFileSync('wrangler.jsonc', 'utf8');
  const config = JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
  it('runs the Worker first for everything but the built files, so every page gets the security headers', () => {
    expect(config.assets.run_worker_first).toEqual(['/*', '!/assets/*', '!/fonts/*', '!/site/*']);
    expect(config.assets.not_found_handling).toBe('single-page-application');
  });
  it("staging shows Isaac's staging studio", () =>
    expect(config.env.staging.vars.STUDIO_SLUG).toBe('isaac-anderson-art-sbtwkm'));
});

describe('pictures at the edge', () => {
  const pic = '/v1/public/studios/s/images/01M75HGD35H9DMP2CRXEMSH6MZ/960.webp';
  it('keeps a 200 picture and answers the next request from the edge', async () => {
    const store = new Map<string, Response>();
    (globalThis as any).caches = {
      default: {
        match: async (r: Request) => store.get(r.url)?.clone(),
        put: async (r: Request, res: Response) => void store.set(r.url, res),
      },
    };
    let calls = 0;
    const api = {
      fetch: async () => (calls++, new Response('img', {headers: {'content-type': 'image/webp'}})),
    } as unknown as Fetcher;
    const e: Env = {...env, API: api};
    await worker.fetch(new Request('https://x.test' + pic), e);
    const second = await worker.fetch(new Request('https://x.test' + pic), e);
    expect(await second.text()).toBe('img');
    expect(calls).toBe(1);
    expect(store.get('https://x.test' + pic)?.headers.get('cache-control')).toBe('public, max-age=86400');
    delete (globalThis as any).caches;
  });
  it('never keeps a 404', async () => {
    const store = new Map<string, Response>();
    (globalThis as any).caches = {
      default: {match: async () => undefined, put: async (r: Request, res: Response) => void store.set(r.url, res)},
    };
    const api = {fetch: async () => new Response('no', {status: 404})} as unknown as Fetcher;
    expect((await worker.fetch(new Request('https://x.test' + pic), {...env, API: api})).status).toBe(404);
    expect(store.size).toBe(0);
    delete (globalThis as any).caches;
  });
});
