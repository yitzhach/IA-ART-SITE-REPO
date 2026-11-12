// The Worker's visitor plumbing (stage 3, D-134, D-135): the `sv` cookie, the `x-visitor-key` only the Worker sets,
// and /ask/chat → the assistant's visitor mode with headers from the Worker, never from the browser.
import {describe, expect, it} from 'vitest';
import worker, {type Env} from '../../worker/index';

interface Seen {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}
function fakeFetcher(
  seen: Seen[],
  reply = () => new Response('{"ok":true}', {headers: {'content-type': 'application/json'}}),
) {
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = new Request(input as RequestInfo, init);
      seen.push({url: r.url, method: r.method, headers: r.headers, body: await r.text()});
      return reply();
    },
  } as unknown as Fetcher;
}
const setup = () => {
  const api: Seen[] = [];
  const assistant: Seen[] = [];
  const env: Env = {
    API: fakeFetcher(api),
    ASSISTANT: fakeFetcher(assistant),
    ASSETS: fakeFetcher([]),
    STUDIO_SLUG: 'test-studio-abc123',
  };
  return {api, assistant, env};
};
const KEY = 'abcdefghijklmnopqrstuvwxyz012345';

describe('the visitor cookie and key on /v1', () => {
  it('replaces a browser-sent x-visitor-key with the cookie’s key', async () => {
    const {api, env} = setup();
    const res = await worker.fetch(
      new Request('https://x.test/v1/public/studios/s/visitor', {
        headers: {cookie: `a=1; sv=${KEY}`, 'x-visitor-key': 'forged-by-the-browser'},
      }),
      env,
    );
    expect(api[0]!.headers.get('x-visitor-key')).toBe(KEY);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
  it('makes a key and sets the cookie when the browser has none; ignores a malformed cookie', async () => {
    for (const cookie of [undefined, 'sv=short', 'sv=' + 'a'.repeat(31) + '!']) {
      const {api, env} = setup();
      const res = await worker.fetch(
        new Request('https://x.test/v1/public/studios/s/visitor', {
          headers: {...(cookie ? {cookie} : {}), 'x-visitor-key': 'forged'},
        }),
        env,
      );
      const sent = api[0]!.headers.get('x-visitor-key')!;
      expect(sent).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(sent).not.toBe('forged');
      const set = res.headers.get('set-cookie')!;
      expect(set).toBe(`sv=${sent}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`);
    }
  });
  it('makes a different key for each new visitor', async () => {
    const keys = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const {api, env} = setup();
      await worker.fetch(new Request('https://x.test/v1/me'), env);
      keys.add(api[0]!.headers.get('x-visitor-key')!);
    }
    expect(keys.size).toBe(20);
  });
  it('passes a multipart lead through with its body', async () => {
    const {api, env} = setup();
    const form = new FormData();
    form.append('lead', JSON.stringify({kind: 'inquiry', works: []}));
    form.append('picture', new File([new Uint8Array([1, 2, 3])], 'p.png', {type: 'image/png'}));
    await worker.fetch(
      new Request('https://x.test/v1/public/studios/s/visitor/leads', {
        method: 'POST',
        body: form,
        headers: {cookie: `sv=${KEY}`},
      }),
      env,
    );
    expect(api[0]!.method).toBe('POST');
    expect(api[0]!.headers.get('content-type')).toContain('multipart/form-data');
    expect(api[0]!.body).toContain('name="picture"');
    expect(api[0]!.headers.get('x-visitor-key')).toBe(KEY);
  });
});

describe('POST /ask/chat', () => {
  const chat = (env: Env, body: string, headers: Record<string, string> = {}) =>
    worker.fetch(
      new Request('https://site.test/ask/chat', {
        method: 'POST',
        body,
        headers: {cookie: `sv=${KEY}`, 'content-type': 'application/json', ...headers},
      }),
      env,
    );
  it('forwards to the assistant’s visitor mode with the Worker’s headers', async () => {
    const {assistant, env} = setup();
    const res = await chat(env, '{"message":"hello"}', {
      'cf-connecting-ip': '203.0.113.9',
      'x-studio-slug': 'someone-elses-studio',
      'x-visitor-key': 'forged',
      'x-visitor-ip': '6.6.6.6',
      'x-site-origin': 'https://evil.test',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ok: true});
    expect(res.headers.get('cache-control')).toBe('no-store');
    const a = assistant[0]!;
    expect(a.url).toBe('https://studio-assistant/assistant/visitor');
    expect(a.method).toBe('POST');
    expect(a.body).toBe('{"message":"hello"}');
    expect(a.headers.get('x-visitor-key')).toBe(KEY);
    expect(a.headers.get('x-studio-slug')).toBe('test-studio-abc123');
    expect(a.headers.get('x-visitor-ip')).toBe('203.0.113.9');
    expect(a.headers.get('x-site-origin')).toBe('https://site.test');
  });
  it('never trusts a browser-sent address when Cloudflare gave none', async () => {
    const {assistant, env} = setup();
    await chat(env, '{"message":"hi"}', {'x-visitor-ip': '6.6.6.6'});
    expect(assistant[0]!.headers.get('x-visitor-ip')).toBeNull();
  });
  it('sets the cookie for a new visitor', async () => {
    const {assistant, env} = setup();
    const res = await worker.fetch(
      new Request('https://site.test/ask/chat', {method: 'POST', body: '{"message":"hi"}'}),
      env,
    );
    const key = assistant[0]!.headers.get('x-visitor-key')!;
    expect(res.headers.get('set-cookie')).toContain(`sv=${key}; HttpOnly; Secure; SameSite=Lax`);
  });
  it('caps the body at 8 KB, and takes only POST', async () => {
    const {assistant, env} = setup();
    expect((await chat(env, 'x'.repeat(8 * 1024 + 1))).status).toBe(413);
    expect((await chat(env, 'x'.repeat(8 * 1024))).status).toBe(200);
    const get = await worker.fetch(new Request('https://site.test/ask/chat'), env);
    expect(get.status).toBe(405);
    expect(assistant).toHaveLength(1);
  });
  it('answers 503 when the site has no studio', async () => {
    const {env} = setup();
    expect((await chat({...env, STUDIO_SLUG: undefined}, '{}')).status).toBe(503);
  });
  it('/ask itself is the page, other /ask/* is not found', async () => {
    const {env} = setup();
    expect((await worker.fetch(new Request('https://site.test/ask/other'), env)).status).toBe(404);
  });
});

describe('/assistant/visitor through the forward', () => {
  it('gets the Worker’s headers, never the browser’s own', async () => {
    const {assistant, env} = setup();
    await worker.fetch(
      new Request('https://site.test/assistant/visitor', {
        method: 'POST',
        body: '{"message":"x"}',
        headers: {
          cookie: `sv=${KEY}`,
          'x-studio-slug': 'someone-elses-studio',
          'x-visitor-key': 'forged',
          'x-site-origin': 'https://evil.test',
          'cf-connecting-ip': '203.0.113.9',
        },
      }),
      env,
    );
    const h = assistant[0]!.headers;
    expect(h.get('x-studio-slug')).toBe('test-studio-abc123');
    expect(h.get('x-visitor-key')).toBe(KEY);
    expect(h.get('x-site-origin')).toBe('https://site.test');
    expect(h.get('x-visitor-ip')).toBe('203.0.113.9');
    expect(assistant[0]!.body).toBe('{"message":"x"}');
  });
  it('the owner’s assistant paths keep passing through, minus visitor headers', async () => {
    const {assistant, env} = setup();
    await worker.fetch(
      new Request('https://site.test/assistant/chat', {
        headers: {'x-visitor-key': 'forged', authorization: 'Bearer t'},
      }),
      env,
    );
    expect(assistant[0]!.headers.get('x-visitor-key')).toBeNull();
    expect(assistant[0]!.headers.get('authorization')).toBe('Bearer t');
  });
});
