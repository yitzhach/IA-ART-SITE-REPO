// The visitor plumbing (stage 3, D-134): a random key in an HttpOnly cookie `sv`, which only this Worker turns into the
// header `x-visitor-key` for studio-api and the assistant. A browser can never name its own key, studio or address.

export const COOKIE = 'sv';
const KEY = /^[A-Za-z0-9_-]{32}$/;
const CHAT_BODY_MAX = 8 * 1024;

interface VisitorEnv {
  API: Fetcher;
  ASSISTANT: Fetcher;
  STUDIO_SLUG?: string;
}

/** 32 random URL-safe characters (192 bits). */
export function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_');
}

/** The visitor's key from the cookie, or a new one (`fresh`: the response must set the cookie). */
export function visitorKey(request: Request): {key: string; fresh: boolean} {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) {
      const v = rest.join('=');
      if (KEY.test(v)) return {key: v, fresh: false};
    }
  }
  return {key: newKey(), fresh: true};
}

export const cookieHeader = (key: string) =>
  `${COOKIE}=${key}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`;

/** Adds the cookie to a response when the visitor had none. */
export function withCookie(res: Response, v: {key: string; fresh: boolean}): Response {
  if (!v.fresh) return res;
  const out = new Response(res.body, res);
  out.headers.append('set-cookie', cookieHeader(v.key));
  return out;
}

/** The request as studio-api should see it: any `x-visitor-key` from the browser is dropped, ours is set. */
function keyed(request: Request, key: string): Request {
  const headers = new Headers(request.headers);
  headers.delete('x-visitor-key');
  headers.set('x-visitor-key', key);
  return new Request(request, {headers});
}

export async function forwardV1(request: Request, env: VisitorEnv): Promise<Response> {
  const v = visitorKey(request);
  return withCookie(await env.API.fetch(keyed(request, v.key)), v);
}

/** What the assistant is told about the visitor, always from the Worker (never from the browser). */
function assistantHeaders(request: Request, env: VisitorEnv, key: string, base?: Headers): Headers {
  const h = new Headers(base);
  for (const n of ['x-visitor-key', 'x-studio-slug', 'x-visitor-ip', 'x-site-origin']) h.delete(n);
  h.set('x-visitor-key', key);
  h.set('x-studio-slug', env.STUDIO_SLUG ?? '');
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) h.set('x-visitor-ip', ip);
  h.set('x-site-origin', new URL(request.url).origin);
  return h;
}

/** The owner's assistant paths pass through; the visitor path gets the Worker's own headers. */
export async function forwardAssistant(request: Request, env: VisitorEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path !== '/assistant/visitor' && !path.startsWith('/assistant/visitor/')) {
    const headers = new Headers(request.headers);
    for (const n of ['x-visitor-key', 'x-visitor-ip', 'x-site-origin']) headers.delete(n);
    return env.ASSISTANT.fetch(new Request(request, {headers}));
  }
  const v = visitorKey(request);
  const headers = assistantHeaders(request, env, v.key, request.headers);
  return withCookie(await env.ASSISTANT.fetch(new Request(request, {headers})), v);
}

const err = (status: number, code: string, message: string) =>
  Response.json({error: {code, message}}, {status, headers: {'cache-control': 'no-store'}});

/** POST /ask/chat → the assistant's visitor mode. The body is passed through (at most 8 KB). */
export async function askChat(request: Request, env: VisitorEnv): Promise<Response> {
  if (request.method !== 'POST') return err(405, 'method_not_allowed', 'Use POST');
  if (!env.STUDIO_SLUG) return err(503, 'not_set_up', 'This site is not set up yet');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > CHAT_BODY_MAX) return err(413, 'too_large', 'That message is too long');
  const body = await request.arrayBuffer();
  if (body.byteLength > CHAT_BODY_MAX) return err(413, 'too_large', 'That message is too long');
  const v = visitorKey(request);
  const headers = assistantHeaders(request, env, v.key);
  headers.set('content-type', 'application/json');
  const res = await env.ASSISTANT.fetch('https://studio-assistant/assistant/visitor', {method: 'POST', headers, body});
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'no-store');
  return withCookie(out, v);
}
