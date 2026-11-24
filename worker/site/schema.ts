// Structured data shared by every public page (search and AI readiness, D-181). One WebSite and one Person (the artist)
// on every page, each with a stable @id, so a piece's `creator`, About's `ProfilePage` and a show's `performer` all
// point at the same artist instead of describing a new one. Only public fields of the studio go in: never the phone.
import type {PageCtx} from './page';

export const artistId = (origin: string) => `${origin}/#artist`;
export const websiteId = (origin: string) => `${origin}/#website`;
export const artistRef = (origin: string) => ({'@id': artistId(origin)});

/** An absolute address on the site's canonical origin. */
export const abs = (origin: string, path: string) => new URL(path, origin).toString();

/** The https links the artist saved (Site → Contact → Links), for `sameAs`. */
export const sameAs = (ctx: PageCtx): string[] =>
  (ctx.studio.links ?? []).map(l => l.url).filter(u => /^https:\/\//i.test(u));

/** WebSite + Person, written by the layout on every page. */
export function siteGraph(ctx: PageCtx): object {
  const o = ctx.canonicalOrigin;
  const s = ctx.studio;
  const links = sameAs(ctx);
  const description = s.description?.trim() || s.tagline?.trim() || undefined;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId(o),
        url: `${o}/`,
        name: s.name,
        ...(s.tagline?.trim() ? {description: s.tagline.trim()} : {}),
        inLanguage: 'en',
        publisher: artistRef(o),
        // The site's own search (/ask?q=, readable without scripts): lets answer engines search the catalogue.
        potentialAction: {
          '@type': 'SearchAction',
          target: {'@type': 'EntryPoint', urlTemplate: `${o}/ask?q={search_term_string}`},
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Person',
        '@id': artistId(o),
        name: s.name,
        url: `${o}/`,
        jobTitle: 'Artist',
        ...(description ? {description} : {}),
        ...(s.email ? {email: `mailto:${s.email}`} : {}),
        ...(links.length ? {sameAs: links} : {}),
        mainEntityOfPage: `${o}/about`,
      },
    ],
  };
}

/** Home › … › this page, as schema.org BreadcrumbList. `trail` leaves out Home. */
export function breadcrumbs(origin: string, trail: [name: string, path: string][]): object {
  const all: [string, string][] = [['Home', '/'], ...trail];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: abs(origin, path),
    })),
  };
}

/** schema.org's unit codes for the two size units the studio records. */
export const UNIT_CODE = {in: 'INH', cm: 'CMT'} as const;
