// Previews (D-180): `?look=<id>` shows any page in another template without changing what visitors get. Read once
// per request (index.ts); a known id other than the studio's own is a preview: never indexed, and every same-site
// page link and GET form in the finished page carries the look, so a walk through the site stays in it.
import {DEFAULT_TEMPLATE, known, type Template} from './templates';

export interface Look {
  template: Template;
  /** The previewed id, or null when the page is in the studio's own look. */
  preview: string | null;
  /** The URL the pages see: without `look`, so they write the same page as on the plain address. */
  url: URL;
}

export function readLook(url: URL, own: Template = DEFAULT_TEMPLATE): Look {
  const asked = known(url.searchParams.get('look'));
  if (!url.searchParams.has('look')) return {template: own, preview: null, url};
  const plain = new URL(url);
  plain.searchParams.delete('look');
  if (!asked || asked.id === own.id) return {template: own, preview: null, url: plain};
  return {template: asked, preview: asked.id, url: plain};
}

/** Not a page: files, fonts, scripts, the API, and anything with a file extension (favicon, sitemap, llms.txt). */
const notAPage = (path: string) =>
  path.startsWith('//') || /^\/(fonts|site|v1)(\/|$)/.test(path) || /\.[a-z0-9]{2,5}$/i.test(path);

function withLook(href: string, id: string): string {
  const hash = href.indexOf('#');
  const [base, frag] = hash < 0 ? [href, ''] : [href.slice(0, hash), href.slice(hash)];
  const q = base.indexOf('?');
  const path = q < 0 ? base : base.slice(0, q);
  if (notAPage(path)) return href;
  if (/[?&;]look=/.test(base)) return href;
  return `${base}${q < 0 ? '?' : '&amp;'}look=${id}${frag}`;
}

/** Adds the look to every same-site page link (`<a href="/…">`) and to every GET form that posts to this site. */
export function carryLook(doc: string, id: string): string {
  return doc
    .replace(/<a\b[^>]*>/g, tag =>
      tag.replace(/(\shref=")(\/[^"]*)"/, (_m, pre, href) => `${pre}${withLook(href, id)}"`),
    )
    .replace(/(<form\b[^>]*>)/g, (tag: string) =>
      /\smethod="get"/i.test(tag) && /\saction="\/(?!\/)/.test(tag) && !/\saction="\/(fonts|site|v1)\//.test(tag)
        ? `${tag}<input type="hidden" name="look" value="${id}" />`
        : tag,
    );
}
