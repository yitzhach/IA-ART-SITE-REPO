// Edge cache for the public pages (D-116). The key carries the studio's catalogue version, so a publish
// shows at once. Pages never vary by cookie, so cookies are ignored. Only GET/HEAD are cached (HEAD is served
// from the GET entry); only 200s (and 404 pages, briefly). Card E owns this file.
const EDGE_OK = 'public, s-maxage=86400';
const EDGE_404 = 'public, s-maxage=60';
const BROWSER = 'public, max-age=60';

function toBrowser(res: Response, state: 'hit' | 'miss', head: boolean): Response {
  const out = new Response(head ? null : res.body, res);
  out.headers.set('cache-control', res.status === 404 ? 'public, max-age=60' : BROWSER);
  out.headers.set('x-site-cache', state);
  return out;
}

export async function cached(
  request: Request,
  version: number,
  ctx: ExecutionContext | undefined,
  produce: () => Promise<Response>,
): Promise<Response> {
  const head = request.method === 'HEAD';
  const cacheable = (request.method === 'GET' || head) && typeof caches !== 'undefined';
  if (!cacheable) {
    const res = await produce();
    return toBrowser(res, 'miss', head);
  }
  const keyUrl = new URL(request.url);
  keyUrl.searchParams.set('__v', String(version));
  const key = new Request(keyUrl.toString(), {method: 'GET'});
  const cache = caches.default;

  const hit = await cache.match(key);
  if (hit) return toBrowser(hit, 'hit', head);

  const res = await produce();
  if (res.status === 200 || res.status === 404) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set('cache-control', res.status === 404 ? EDGE_404 : EDGE_OK);
    const put = cache.put(key, copy).catch(e => console.error('cache put', e));
    if (ctx) ctx.waitUntil(put);
    else await put;
  }
  return toBrowser(res, 'miss', head);
}
