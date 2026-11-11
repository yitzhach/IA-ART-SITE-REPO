// studio-site: serves the owner's area (/studio), and forwards /v1/* to studio-api and /assistant/* to
// studio-assistant through service bindings. It holds no data and no secrets.
export interface Env {
  API: Fetcher;
  ASSISTANT: Fetcher;
  ASSETS: Fetcher;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;
    if (under(p, '/v1')) return env.API.fetch(request);
    if (under(p, '/assistant')) return env.ASSISTANT.fetch(request);
    if (p === '/') return Response.redirect(new URL('/studio', url).toString(), 302);
    return secured(await env.ASSETS.fetch(request));
  },
};
