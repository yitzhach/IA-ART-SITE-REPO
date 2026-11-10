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
  it('redirects / to /studio', async () => {
    const r = await call('/');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://x.test/studio');
  });
  it('adds the CSP and security headers to HTML', async () => {
    const r = await call('/studio');
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(r.headers.get('content-security-policy')).toContain('https://raw.githubusercontent.com');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
  it('leaves API responses alone', async () =>
    expect((await call('/v1/me')).headers.get('content-security-policy')).toBeNull());
});
