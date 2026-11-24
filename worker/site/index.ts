// The public site: one request → (old address? redirect) → the studio's profile (its catalogue version keys the
// cache) → the page → the layout. All data from studio-api's public routes; nothing from the request picks the studio.
import {cached} from './cache';
import {count, fromAPerson} from './counts';
import {NotFound, siteData} from './data';
import {llmsFullTxt, llmsTxt, oldAddress, robots, sitemap} from './extras';
import {versionLine, type DeployVersion} from './format';
import {layout} from './layout';
import type {Page, PageCtx} from './page';
import {notFound} from './pages/notfound';
import {morePages} from './optional';
import {match} from './routes';

export interface SiteEnv {
  API: Fetcher;
  /** The studio this site shows (D-117). */
  STUDIO_SLUG?: string;
  /** The site's own address once the domain moves (e.g. https://isaacandersonart.com), D-181. Empty: the request's own
   * origin. When set, every other host (workers.dev) answers with `x-robots-tag: noindex` and points its canonical
   * links here, so search engines list one copy. */
  SITE_ORIGIN?: string;
  /** This deploy: its id keeps a new deploy (new templates) from being answered with pages the last one cached,
   * and the footer shows it with its upload time. */
  CF_VERSION_METADATA?: DeployVersion;
}

const HTML = {
  'content-type': 'text/html; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

/** SITE_ORIGIN as `https://host` (no path, no slash), or null when unset or not an https origin. */
export function siteOrigin(v: string | undefined): string | null {
  if (!v?.trim()) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' && !u.username && !u.password ? u.origin : null;
  } catch {
    return null;
  }
}

export async function site(request: Request, env: SiteEnv, ctx?: ExecutionContext): Promise<Response> {
  const res = await answer(request, env, ctx);
  const own = siteOrigin(env.SITE_ORIGIN);
  // Another copy of the site (the workers.dev address after the domain move): readable, never listed.
  if (own && new URL(request.url).origin !== own && !res.headers.has('x-robots-tag')) {
    const out = new Response(res.body, res);
    out.headers.set('x-robots-tag', 'noindex');
    return out;
  }
  return res;
}

async function answer(request: Request, env: SiteEnv, ctx?: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const origin = siteOrigin(env.SITE_ORIGIN) ?? url.origin;
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response('Method not allowed', {status: 405, headers: {allow: 'GET, HEAD'}});
  const moved = oldAddress(url.pathname);
  if (moved) return Response.redirect(new URL(moved, url.origin).toString(), 301);
  if (url.pathname === '/robots.txt') return robots(origin);
  if (!env.STUDIO_SLUG) return new Response('This site is not set up yet.', {status: 503, headers: HTML});

  const data = siteData(env.API, env.STUDIO_SLUG);
  try {
    const studio = await data.studio();
    if (url.pathname === '/sitemap.xml')
      return await cached(request, `${studio.catalogueVersion}.${env.CF_VERSION_METADATA?.id ?? 'dev'}`, ctx, () =>
        sitemap(origin, data),
      );
    if (url.pathname === '/llms.txt')
      return await cached(request, `${studio.catalogueVersion}.${env.CF_VERSION_METADATA?.id ?? 'dev'}`, ctx, () =>
        llmsTxt(origin, data),
      );
    if (url.pathname === '/llms-full.txt')
      return await cached(request, `${studio.catalogueVersion}.${env.CF_VERSION_METADATA?.id ?? 'dev'}`, ctx, () =>
        llmsFullTxt(origin, data),
      );
    const route = match(url.pathname);
    // A piece page viewed by a person counts once (card G, D-177); the page itself doesn't wait for it.
    const piece = /^\/works\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(url.pathname);
    if (piece && request.method === 'GET' && fromAPerson(request)) {
      const sent = count(env.API, env.STUDIO_SLUG, 'view', piece[1]);
      if (ctx) ctx.waitUntil(sent);
      else await sent;
    }
    const render = async () => {
      const [photos, assistant, shows] = await Promise.all([data.sitePhotos(), data.assistant(), data.showPages()]);
      const pc: PageCtx = {
        url,
        canonicalOrigin: origin,
        data,
        studio,
        photos,
        version: versionLine(env.CF_VERSION_METADATA, studio.timezone),
        more: morePages(studio, assistant),
        shows: shows.items.length > 0,
      };
      let page: Page;
      try {
        page = route ? await route.render(pc, route.params) : notFound();
      } catch (e) {
        if (!(e instanceof NotFound)) throw e;
        page = notFound();
      }
      return new Response(layout(pc, page), {status: page.status ?? 200, headers: HTML});
    };
    if (route?.dynamic) {
      // Answered from the request (a search, a token, a contact check): never kept, never indexed.
      const res = await render();
      res.headers.set('cache-control', 'no-store');
      if (url.pathname !== '/ask') res.headers.set('x-robots-tag', 'noindex');
      return request.method === 'HEAD' ? new Response(null, res) : res;
    }
    return await cached(request, `${studio.catalogueVersion}.${env.CF_VERSION_METADATA?.id ?? 'dev'}`, ctx, render);
  } catch (e) {
    console.error('site', url.pathname, e);
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Back soon</title><p style="font:16px system-ui;margin:2rem">The site is having a moment. Please try again shortly.</p>',
      {status: 503, headers: {...HTML, 'retry-after': '30'}},
    );
  }
}
