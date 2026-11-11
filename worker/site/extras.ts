// robots.txt, sitemap.xml and the old site's addresses. Card E owns this file.
import type {SiteData} from './data';

/** The new address for an old one (e.g. /available.html → /works?status=available), or null. */
export function oldAddress(path: string): string | null {
  void path;
  return null;
}

export function robots(origin: string): Response {
  return new Response(`User-agent: *\nAllow: /\nDisallow: /studio\nSitemap: ${origin}/sitemap.xml\n`, {
    headers: {'content-type': 'text/plain; charset=utf-8'},
  });
}

export async function sitemap(origin: string, data: SiteData): Promise<Response> {
  void data;
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`,
    {
      headers: {'content-type': 'application/xml; charset=utf-8'},
    },
  );
}
