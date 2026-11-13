// studio-site: serves the studio's public site (/, /works, … — worker/site/), the owner's area (/studio), and
// forwards /v1/* to studio-api and /assistant/* to studio-assistant through service bindings. It holds no data
// and no secrets.
import {site} from './site/index';
import {askChat, forwardAssistant, forwardV1} from './site/visitor';

export interface Env {
  API: Fetcher;
  ASSISTANT: Fetcher;
  ASSETS: Fetcher;
  /** The studio the public site shows (D-117). */
  STUDIO_SLUG?: string;
  CF_VERSION_METADATA?: {id: string; timestamp?: string};
}

export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' blob: data:",
  "connect-src 'self' https://raw.githubusercontent.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

function secured(res: Response): Response {
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const out = new Response(res.body, res);
  out.headers.set('content-security-policy', CSP);
  out.headers.set('x-content-type-options', 'nosniff');
  out.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return out;
}

/** A public work's picture (D-106): the same bytes for a day, so the edge keeps it instead of asking studio-api
 * and R2 each time. Only answers studio-api gave as 200 are kept. */
const PICTURE = /^\/v1\/public\/studios\/[^/]+\/images\/[A-Za-z0-9]{26}\/\d{2,4}\.webp$/;
async function picture(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  if (typeof caches === 'undefined') return env.API.fetch(request);
  const key = new Request(new URL(request.url).toString());
  const hit = await caches.default.match(key);
  if (hit) return hit;
  const res = await env.API.fetch(request);
  if (res.status === 200) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set('cache-control', 'public, max-age=86400');
    const put = caches.default.put(key, copy).catch(e => console.error('picture cache', e));
    if (ctx) ctx.waitUntil(put);
    else await put;
  }
  return res;
}

/** Files the build puts in dist/ (the studio app's bundle, the site's fonts and small scripts, icons). */
const STATIC = /^\/(assets|fonts|site)\/|^\/[^/]+\.(ico|png|svg|webmanifest|js|css|woff2|wasm)$/;

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;
    if (PICTURE.test(p) && request.method === 'GET') return picture(request, env, ctx);
    if (p === '/ask/chat') return askChat(request, env);
    if (p.startsWith('/ask/')) return Response.json({error: {code: 'not_found', message: 'Not found'}}, {status: 404});
    if (under(p, '/v1')) return forwardV1(request, env);
    if (under(p, '/assistant')) return forwardAssistant(request, env);
    if (under(p, '/studio')) return secured(await env.ASSETS.fetch(request));
    if (STATIC.test(p)) {
      const res = await env.ASSETS.fetch(request);
      // A missing file must not come back as the studio app's page.
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
    }
    return secured(await site(request, env, ctx));
  },
};
