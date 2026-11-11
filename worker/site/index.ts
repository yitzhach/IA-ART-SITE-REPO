// The public site: one request → (old address? redirect) → the studio's profile (its catalogue version keys the
// cache) → the page → the layout. All data from studio-api's public routes; nothing from the request picks the studio.
import {cached} from './cache';
import {NotFound, siteData} from './data';
import {oldAddress, robots, sitemap} from './extras';
import {layout} from './layout';
import type {Page, PageCtx} from './page';
import {notFound} from './pages/notfound';
import {match} from './routes';

export interface SiteEnv {
  API: Fetcher;
  /** The studio this site shows (D-117). */
  STUDIO_SLUG?: string;
}

const HTML = {'content-type': 'text/html; charset=utf-8'};

export async function site(request: Request, env: SiteEnv, ctx?: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response('Method not allowed', {status: 405, headers: {allow: 'GET, HEAD'}});
  const moved = oldAddress(url.pathname);
  if (moved) return Response.redirect(new URL(moved, url.origin).toString(), 301);
  if (url.pathname === '/robots.txt') return robots(url.origin);
  if (!env.STUDIO_SLUG) return new Response('This site is not set up yet.', {status: 503, headers: HTML});

  const data = siteData(env.API, env.STUDIO_SLUG);
  try {
    const studio = await data.studio();
    if (url.pathname === '/sitemap.xml')
      return cached(request, studio.catalogueVersion, ctx, () => sitemap(url.origin, data));
    const route = match(url.pathname);
    return await cached(request, studio.catalogueVersion, ctx, async () => {
      const pc: PageCtx = {url, data, studio, photos: await data.sitePhotos()};
      let page: Page;
      try {
        page = route ? await route.render(pc, route.params) : notFound();
      } catch (e) {
        if (!(e instanceof NotFound)) throw e;
        page = notFound();
      }
      return new Response(layout(pc, page), {status: page.status ?? 200, headers: HTML});
    });
  } catch (e) {
    console.error('site', url.pathname, e);
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Back soon</title><p style="font:16px system-ui;margin:2rem">The site is having a moment. Please try again shortly.</p>',
      {status: 503, headers: {...HTML, 'retry-after': '30'}},
    );
  }
}
