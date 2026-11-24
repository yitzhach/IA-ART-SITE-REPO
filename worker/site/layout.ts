// The document around every public page: head (title, description, previews, canonical, fonts, the template's
// CSS inlined), header (name, nav, theme switch), the page's <main>, footer (text / email / call, hours, nav).
import {hoursLine, phoneParts} from './contact';
import {html, raw, type Raw} from './html';
import type {Page, PageCtx} from './page';
import {contactLinks, COVER_SIZES, HERO_SIZES} from './pages/parts';
import {sizeUrl} from './picture';
import {CSS, PRELOAD_FONTS} from './plaster';
import {breadcrumbs, siteGraph} from './schema';
import {clip} from './format';

const NAV = [
  ['works', '/works', 'Works'],
  ['commissions', '/commissions', 'Commissions'],
  ['process', '/process', 'Process'],
  ['about', '/about', 'About'],
] as const;

export function layout(ctx: PageCtx, page: Page): string {
  const s = ctx.studio;
  const home = ctx.url.pathname === '/';
  const title = home ? homeTitle(s) : `${page.title} — ${s.name}`;
  const description = clip(page.description || s.description || s.tagline || `Original work by ${s.name}.`, 160);
  const canonical = new URL(page.canonical ?? ctx.url.pathname, ctx.canonicalOrigin).toString();
  const og = page.image ? sizeUrl(page.image, 960) : null;
  const ogSize = page.image?.sizes.find(z => z.url === og)?.width ?? null;
  const ogAlt = page.image?.altText?.trim() || page.title;
  const nav = () =>
    NAV.map(
      ([key, href, label]) =>
        html`<a href="${href}" ${page.nav === key ? raw('aria-current="page"') : ''}>${label}</a>`,
    );
  const parts = phoneParts(s);
  const scripts = [...new Set(['/site/site.js', '/site/inquiry.js', ...(page.scripts ?? [])])];
  const hours = hoursLine(s);
  const pre = page.preload?.sizes.length ? page.preload : null;
  // Home with a hero photo: the header sits on the picture.
  const over = home && !!page.image;
  const preSizes = ctx.url.pathname.startsWith('/works/') ? COVER_SIZES : HERO_SIZES;
  const doc: Raw = html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content="light dark" />
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <link rel="canonical" href="${canonical}" />
        ${page.noindex ? raw('<meta name="robots" content="noindex">') : ''}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:url" content="${canonical}" />
        <meta property="og:site_name" content="${s.name}" />
        <meta property="og:locale" content="en_US" />
        ${
          og
            ? html`<meta property="og:image" content="${new URL(og, ctx.canonicalOrigin).toString()}" />
                ${
                  ogSize
                    ? html`<meta property="og:image:width" content="${ogSize}" />${
                          page.image?.aspectRatio
                            ? html`<meta
                                property="og:image:height"
                                content="${Math.round(ogSize / page.image.aspectRatio)}"
                              />`
                            : ''
                        }`
                    : ''
                }
                <meta property="og:image:alt" content="${ogAlt}" />
                <meta name="twitter:card" content="summary_large_image" />`
            : html`<meta name="twitter:card" content="summary" />`
        }
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="About this site, for AI assistants" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        ${[...PRELOAD_FONTS, ...(page.fonts ?? []).filter(f => !PRELOAD_FONTS.includes(f))].map(f => html`<link rel="preload" as="font" type="font/woff2" href="${f}" crossorigin />`)}
        ${
          pre
            ? html`<link
                rel="preload"
                as="image"
                href="${sizeUrl(pre, 960)}"
                imagesrcset="${[...pre.sizes]
                  .sort((a, b) => a.width - b.width)
                  .map(z => `${z.url} ${z.width}w`)
                  .join(', ')}"
                imagesizes="${preSizes}"
                fetchpriority="high"
              />`
            : ''
        }
        <script src="/site/theme.js"></script>
        ${(page.styles ?? []).map(href => html`<link rel="stylesheet" href="${href}" />`)}
        <style>
          ${raw(CSS)}
        </style>
        ${[siteGraph(ctx), ...(page.jsonLd ?? []), ...trail(ctx, page)].map(o =>
          raw(`<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`),
        )}
      </head>
      <body
        data-slug="${s.slug}"
        data-name="${s.name}"
        data-email="${s.email}"
        ${parts ? html`data-pa="${parts.a}" data-pb="${parts.b}"` : ''}
      >
        <a class="skip" href="#main">Skip to content</a>
        <header class="site-hdr${over ? ' over' : ''}">
          <a class="site-name" href="/">${s.name}</a>
          <nav aria-label="Main">${nav()}</nav>
          <div class="hdr-tools">
            <a class="ask-btn" href="/ask" data-ask>Ask</a>
            <button class="theme-switch" type="button" hidden aria-label="Switch between light and dark">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5" />
                <path d="M10 1.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </header>
        <main id="main">${page.body}</main>
        <footer class="site-ftr band">
          <div class="wrap">
            <p class="ftr-name">${s.name}</p>
            <p class="ftr-contact">${contactLinks(s)}</p>
            ${hours ? html`<p class="hours">${hours}</p>` : ''}
            <nav aria-label="Footer">
              ${nav()}${(ctx.more ?? []).map(
                m =>
                  html`<a href="${m.href}" ${ctx.url.pathname === m.href ? raw('aria-current="page"') : ''}
                    >${m.label}</a
                  >`,
              )}
            </nav>
            <p class="ftr-follow"><a href="/follow">Follow the studio</a>: new work comes to followers first.</p>
            ${ctx.version ? html`<p class="ftr-ver">Version ${ctx.version}</p>` : ''}
          </div>
        </footer>
        ${scripts.map(src => html`<script src="${src}" defer></script>`)}
      </body>
    </html>`;
  return doc.value;
}

/** Home › this page, for a listed page that doesn't give its own trail (a piece, a show and Works do). */
function trail(ctx: PageCtx, page: Page): object[] {
  const path = ctx.url.pathname;
  if (path === '/' || page.noindex || (page.status ?? 200) !== 200) return [];
  if ((page.jsonLd ?? []).some(o => (o as {'@type'?: unknown})['@type'] === 'BreadcrumbList')) return [];
  return [breadcrumbs(ctx.canonicalOrigin, [[page.title, page.canonical ?? path]])];
}

/** Home's <title>: the name and what the artist makes, in the studio's own words (its description up to the first
 * dash or full stop when that is short), else the tagline. Search results show about 60 characters. */
export function homeTitle(s: {name: string; tagline: string | null; description: string | null}): string {
  const what = s.description?.split(/\s[—–-]\s|\.\s|\.$/)[0]?.trim();
  if (what && what.length >= 12 && s.name.length + 3 + what.length <= 70) return `${s.name} — ${what}`;
  return `${s.name}${s.tagline ? ` — ${s.tagline}` : ''}`;
}
