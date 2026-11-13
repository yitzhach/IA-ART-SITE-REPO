// robots.txt, sitemap.xml and the old site's addresses. Card E owns this file.
import type {SiteData} from './data';
import {availability, sizeLine} from './format';
import {morePages} from './optional';

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

/**
 * Search and answer crawlers welcomed by name (card E, D-176), from each company's own crawler page (read
 * 2026-11-13): OpenAI, Anthropic, Perplexity, Google, Apple, Microsoft. A crawler that finds its own name obeys only
 * that group, so the group repeats everyone's rules.
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'Bingbot',
];
const RULES = 'Allow: /\nDisallow: /studio\nDisallow: /v1/\nDisallow: /assistant/\n';

export function robots(origin: string): Response {
  const named = AI_CRAWLERS.map(a => `User-agent: ${a}\n`).join('');
  return new Response(`User-agent: *\n${RULES}\n${named}${RULES}\nSitemap: ${origin}/sitemap.xml\n`, {
    headers: {'content-type': 'text/plain; charset=utf-8'},
  });
}

/** One line of Markdown text: no line breaks, and no characters that would start a link or a heading. */
const md = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[[\]<>`]/g, '')
    .trim();

const MAX_LLMS_WORKS = 200;

/**
 * `/llms.txt` (llmstxt.org): who the artist is, what is for sale, the main pages and how to ask, built from the
 * public profile and the public works only. Never the phone number (the contact page hands it out on a tap); the
 * email only because every page's footer already shows it.
 */
export async function llmsTxt(origin: string, data: SiteData): Promise<Response> {
  const [studio, assistant] = await Promise.all([data.studio(), data.assistant()]);
  const about = studio.pages.about;
  const summary = md(studio.tagline || studio.description || about?.lede || "An artist's studio");
  const forSale: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await data.works({status: 'available', ...(cursor ? {cursor} : {})});
    for (const w of page.items) {
      if (forSale.length >= MAX_LLMS_WORKS) break;
      const a = availability(w);
      const bits = [sizeLine(w), w.medium, a.price ?? a.label].filter(Boolean).map(b => md(String(b)));
      forSale.push(`- [${md(w.title)}](${origin}/works/${encodeURIComponent(w.slug)}): ${bits.join(', ')}`);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor && forSale.length < MAX_LLMS_WORKS);
  const more = morePages(studio, assistant).map(m => `- [${md(m.label)}](${origin}${m.href})`);
  const links = (studio.links ?? []).map(l => `- [${md(l.label)}](${l.url})`);
  const out = [
    `# ${md(studio.name)}`,
    '',
    `> ${summary}`,
    '',
    ...(studio.description && md(studio.description) !== summary ? [md(studio.description), ''] : []),
    '## Main pages',
    `- [Works](${origin}/works): every piece shown, with size, medium and price or "Price on request"`,
    `- [Available works](${origin}/works?status=available)`,
    `- [Commissions](${origin}/commissions): a piece made to order`,
    `- [Process](${origin}/process): how the work is made`,
    `- [About](${origin}/about): the artist`,
    ...more,
    '',
    '## For sale',
    ...(forSale.length ? forSale : ['- Nothing is listed as available right now; ask about commissions.']),
    '',
    '## How to ask',
    `- [Ask](${origin}/ask): the studio's assistant answers questions about the work`,
    ...(studio.email ? [`- Email: ${md(studio.email)}`] : []),
    ...(studio.phone ? [`- [Text or call](${origin}/contact): from the contact page`] : []),
    ...(links.length ? ['', '## Elsewhere', ...links] : []),
    '',
    '## Optional',
    `- [Sitemap](${origin}/sitemap.xml)`,
    '',
  ];
  return new Response(out.join('\n'), {headers: {'content-type': 'text/plain; charset=utf-8'}});
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const MAX_WORKS = 2000;

export async function sitemap(origin: string, data: SiteData): Promise<Response> {
  const [studio, assistant] = await Promise.all([data.studio(), data.assistant()]);
  const more = morePages(studio, assistant).map(m => m.href);
  const urls = ['/', '/works', '/commissions', '/process', '/about', ...more].map(
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
