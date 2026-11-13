// Visitor numbers (card G, Art-Talk-Back D-177): a count only. The Worker tells studio-api that a piece page was
// viewed, or (from the page's small scripts, through POST /count) that Ask, the wall tool or the inquiry list was
// used. Nothing about the person goes with it: no cookie, no visitor key, no address. Bots, link previews and
// prefetches are left out; the API caps each count per day.
export type CountKind = 'view' | 'ask' | 'wall' | 'inquiry';
const KINDS: readonly string[] = ['view', 'ask', 'wall', 'inquiry'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const COUNT_BODY_MAX = 512;

/** Crawlers, link previews, monitors and scripted browsers (Lighthouse and the smoke tests among them). */
const NOT_A_PERSON =
  /bot\b|bot\/|crawl|spider|slurp|preview|fetcher|facebookexternalhit|embedly|whatsapp|telegram|discord|skype|lighthouse|headless|phantom|puppeteer|playwright|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|monitor|uptime|pingdom|check/i;

export function fromAPerson(request: Request): boolean {
  const ua = request.headers.get('user-agent') ?? '';
  if (!ua || NOT_A_PERSON.test(ua)) return false;
  const purpose = `${request.headers.get('sec-purpose') ?? ''} ${request.headers.get('purpose') ?? ''} ${request.headers.get('x-moz') ?? ''}`;
  return !/prefetch|prerender/i.test(purpose);
}

/** Tell studio-api, quietly: a count that doesn't land is not worth an error page. */
export async function count(api: Fetcher, slug: string, kind: CountKind, work?: string): Promise<void> {
  try {
    const res = await api.fetch(`https://studio-api/v1/public/studios/${encodeURIComponent(slug)}/counts`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(work ? {kind, work} : {kind}),
    });
    await res.body?.cancel();
  } catch (e) {
    console.error('count', kind, e);
  }
}

const done = (status = 204) => new Response(null, {status, headers: {'cache-control': 'no-store'}});

/** POST /count from the page's scripts: {kind, work?}. Always a bare answer, never a cookie. */
export async function countBeacon(
  request: Request,
  env: {API: Fetcher; STUDIO_SLUG?: string},
  ctx?: ExecutionContext,
): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, {status: 405, headers: {allow: 'POST'}});
  if (Number(request.headers.get('content-length') ?? 0) > COUNT_BODY_MAX) return done(413);
  const text = await request.text();
  if (text.length > COUNT_BODY_MAX) return done(413);
  let body: {kind?: unknown; work?: unknown};
  try {
    body = JSON.parse(text);
  } catch {
    return done(400);
  }
  const kind =
    typeof body?.kind === 'string' && body.kind !== 'view' && KINDS.includes(body.kind)
      ? (body.kind as CountKind)
      : null;
  const work = typeof body?.work === 'string' && SLUG.test(body.work) && body.work.length <= 80 ? body.work : undefined;
  if (!kind || (body.work !== undefined && !work)) return done(400);
  if (!env.STUDIO_SLUG || !fromAPerson(request)) return done();
  const sent = count(env.API, env.STUDIO_SLUG, kind, work);
  if (ctx) ctx.waitUntil(sent);
  else await sent;
  return done();
}
