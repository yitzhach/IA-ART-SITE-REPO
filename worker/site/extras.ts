// robots.txt, sitemap.xml and the old site's addresses. Card E owns this file.
import type {SiteData} from './data';

const OLD: Record<string, string> = {
  '/index.html': '/',
  '/available.html': '/works?status=available',
  '/gallery.html': '/works',
  '/collection-abstract.html': '/works?collection=Abstract',
  '/collection-figurative.html': '/works?collection=Figurative',
  '/collection-sculptural.html': '/works?collection=Sculptural',
  '/commissions.html': '/commissions',
  '/process.html': '/process',
  '/about.html': '/about',
  '/studio.html': '/studio',
};
const SLASHED = new Set(['/works', '/commissions', '/process', '/about', '/studio']);

/** The new address for an old one (e.g. /available.html → /works?status=available), or null. */
export function oldAddress(path: string): string | null {
  if (path in OLD) return OLD[path]!;
  if (path.length > 1 && path.endsWith('/') && SLASHED.has(path.slice(0, -1))) return path.slice(0, -1);
  return null;
}

export function robots(origin: string): Response {
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /studio\nDisallow: /v1/\nDisallow: /assistant/\nSitemap: ${origin}/sitemap.xml\n`,
    {headers: {'content-type': 'text/plain; charset=utf-8'}},
  );
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const MAX_WORKS = 2000;

export async function sitemap(origin: string, data: SiteData): Promise<Response> {
  const urls = ['/', '/works', '/commissions', '/process', '/about'].map(
    p => `<url><loc>${esc(origin + p)}</loc></url>`,
  );
  let n = 0;
  let cursor: string | undefined;
  do {
    const page = await data.works(cursor ? {cursor} : {});
    for (const w of page.items) {
      if (n++ >= MAX_WORKS) break;
      const last = w.publishedAt ? `<lastmod>${esc(w.publishedAt)}</lastmod>` : '';
      urls.push(`<url><loc>${esc(`${origin}/works/${encodeURIComponent(w.slug)}`)}</loc>${last}</url>`);
    }
    cursor = n < MAX_WORKS ? (page.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>\n`,
    {headers: {'content-type': 'application/xml; charset=utf-8'}},
  );
}
