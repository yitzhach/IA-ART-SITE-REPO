// The document around every public page: head (title, description, previews, canonical, fonts, the template's
// CSS inlined), header (name, nav, theme switch), the page's <main>, footer (text / email / call).
// Card B fills in the template; this first version is plain but complete.
import {html, raw, type Raw} from './html';
import {mailHref, smsHref, telHref} from './contact';
import type {Page, PageCtx} from './page';
import {sizeUrl} from './picture';
import {CSS} from './plaster';

export function layout(ctx: PageCtx, page: Page): string {
  const s = ctx.studio;
  const home = ctx.url.pathname === '/';
  const title = home ? `${s.name}${s.tagline ? ` — ${s.tagline}` : ''}` : `${page.title} — ${s.name}`;
  const description = (page.description ?? s.description ?? s.tagline ?? '').slice(0, 160);
  const canonical = new URL(page.canonical ?? ctx.url.pathname, ctx.url.origin).toString();
  const og = page.image ? sizeUrl(page.image, 960) : null;
  const nav = (key: NonNullable<Page['nav']>, href: string, label: string) =>
    html`<a href="${href}" ${page.nav === key ? raw(' aria-current="page"') : ''}>${label}</a>`;
  const sms = smsHref(s);
  const mail = mailHref(s);
  const tel = telHref(s);
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
        ${og ? html`<meta property="og:image" content="${new URL(og, ctx.url.origin).toString()}" /><meta name="twitter:card" content="summary_large_image" />` : ''}
        <script src="/site/theme.js"></script>
        <style>
          ${raw(CSS)}
        </style>
        ${(page.jsonLd ?? []).map(o => raw(`<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`))}
      </head>
      <body>
        <a class="skip" href="#main">Skip to content</a>
        <header class="site-hdr">
          <a class="site-name" href="/">${s.name}</a>
          <nav aria-label="Main">
            ${nav('works', '/works', 'Works')}${nav('commissions', '/commissions', 'Commissions')}${nav('process', '/process', 'Process')}${nav('about', '/about', 'About')}
          </nav>
          <button class="theme-switch" type="button" hidden aria-label="Switch light or dark">◐</button>
        </header>
        <main id="main">${page.body}</main>
        <footer class="site-ftr">
          <p class="ftr-name">${s.name}</p>
          <p class="ftr-contact">
            ${[sms && html`<a href="${sms}">Text</a>`, mail && html`<a href="${mail}">Email</a>`, tel && html`<a href="${tel}">Call</a>`].filter(Boolean)}
          </p>
        </footer>
        ${(page.scripts ?? []).map(src => html`<script src="${src}" defer></script>`)}
      </body>
    </html>`;
  return doc.value;
}
