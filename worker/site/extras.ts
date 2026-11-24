// robots.txt, sitemap.xml and the old site's addresses. Card E owns this file.
import type {SiteData} from './data';
import {availability, blocks, clip, sizeLine} from './format';
import {morePages, savedAnswers, savedPage} from './optional';
import {sizeUrl} from './picture';
import type {PublicArtwork, SitePage} from './types';

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
  // Added for D-181, named as each company's crawler page lists them (2026-11-24): DuckDuckGo's answers, Mistral's Le Chat,
  // Meta AI's link fetches.
  'DuckAssistBot',
  'MistralAI-User',
  'Meta-ExternalFetcher',
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
      const what = w.description ? ` ${md(clip(w.description, 140))}` : '';
      forSale.push(`- [${md(w.title)}](${origin}/works/${encodeURIComponent(w.slug)}): ${bits.join(', ')}.${what}`);
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
    `- [Everything in one file](${origin}/llms-full.txt): every page's words and every piece`,
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
  // Each piece's pictures (Google's image sitemap): image search finds the work and its page together.
  const pictures = (w: PublicArtwork) =>
    w.images
      .slice(0, 10)
      .map(i => sizeUrl(i, 1600))
      .filter((u): u is string => !!u)
      .map(u => `<image:image><image:loc>${esc(new URL(u, origin).toString())}</image:loc></image:image>`)
      .join('');
  let n = 0;
  let cursor: string | undefined;
  do {
    const page = await data.works(cursor ? {cursor} : {});
    for (const w of page.items) {
      if (n++ >= MAX_WORKS) break;
      const last = w.publishedAt ? `<lastmod>${esc(w.publishedAt)}</lastmod>` : '';
      urls.push(`<url><loc>${esc(`${origin}/works/${encodeURIComponent(w.slug)}`)}</loc>${last}${pictures(w)}</url>`);
    }
    cursor = n < MAX_WORKS ? (page.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join('')}</urlset>\n`,
    {headers: {'content-type': 'application/xml; charset=utf-8'}},
  );
}

/** A saved page's words as Markdown: its title, lede, then each section's heading and text (list lines kept). */
function pageText(p: SitePage | undefined | null, fallback: string): string[] {
  if (!p) return [];
  const out = [`## ${md(p.title?.trim() || fallback)}`, ''];
  if (p.lede?.trim()) out.push(md(p.lede), '');
  for (const sec of p.sections ?? []) {
    if (sec.key?.includes('caption')) continue;
    const body = blocks(sec.body);
    if (!sec.heading?.trim() && !body.length) continue;
    if (sec.heading?.trim()) out.push(`### ${md(sec.heading)}`, '');
    for (const b of body) out.push(...('p' in b ? [md(b.p)] : b.list.map(i => `- ${md(i)}`)), '');
  }
  return out;
}

const MAX_FULL_WORKS = 500;

/**
 * `/llms-full.txt`: the whole public site as one Markdown file for answer engines that read one file instead of
 * crawling (the llms.txt convention's companion). The saved pages' words, the saved answers, and every public piece
 * with its facts and description. Never the phone number; nothing that isn't already on a public page.
 */
export async function llmsFullTxt(origin: string, data: SiteData): Promise<Response> {
  const [studio, assistant] = await Promise.all([data.studio(), data.assistant()]);
  const works: PublicArtwork[] = [];
  let cursor: string | undefined;
  do {
    const page = await data.works(cursor ? {cursor} : {});
    works.push(...page.items.slice(0, MAX_FULL_WORKS - works.length));
    cursor = works.length < MAX_FULL_WORKS ? (page.nextCursor ?? undefined) : undefined;
  } while (cursor);
  const answers = savedAnswers(assistant);
  const piece = (w: PublicArtwork): string[] => {
    const a = availability(w);
    const facts: [string, string | null | undefined][] = [
      ['Artist', studio.name],
      ['Size', sizeLine(w)],
      ['Medium', w.medium],
      ['Year', w.year ? String(w.year) : null],
      ['Collection', w.collection],
      ['Availability', w.status === 'available' ? (a.price ?? a.label) : a.label],
    ];
    return [
      `### ${md(w.title)}`,
      '',
      `${origin}/works/${encodeURIComponent(w.slug)}`,
      '',
      ...facts.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${md(String(v))}`),
      '',
      ...(w.description ? [md(w.description), ''] : []),
    ];
  };
  const out = [
    `# ${md(studio.name)}`,
    '',
    `> ${md(studio.tagline || studio.description || "An artist's studio")}`,
    '',
    ...(studio.description ? [md(studio.description), ''] : []),
    `Site: ${origin}/ · Ask a question: ${origin}/ask${studio.email ? ` · Email: ${md(studio.email)}` : ''}`,
    '',
    ...pageText(studio.pages.about, 'About'),
    ...pageText(studio.pages.commissions, 'Commissions'),
    ...pageText(studio.pages.process, 'Process'),
    ...pageText(savedPage(studio, 'trade'), 'For designers and architects'),
    ...(answers.length ? ['## Questions', '', ...answers.flatMap(q => [`### ${md(q.q)}`, '', md(q.a), ''])] : []),
    '## Works',
    '',
    ...works.flatMap(piece),
    ...((studio.links ?? []).length
      ? ['## Elsewhere', '', ...(studio.links ?? []).map(l => `- [${md(l.label)}](${l.url})`), '']
      : []),
  ];
  return new Response(out.join('\n'), {headers: {'content-type': 'text/plain; charset=utf-8'}});
}
