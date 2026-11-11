// The contract between the router, the layout and each page. A page returns its <main> and its metadata;
// the layout (layout.ts) wraps it in the document, header, footer, theme and contact links.
import type {Raw} from './html';
import type {SiteData} from './data';
import type {PublicImage, PublicSitePhoto, PublicSitePhotos, PublicStudio} from './types';

export interface PageCtx {
  /** The visitor's URL (origin = this site's address, used for canonical links and the links in messages). */
  url: URL;
  data: SiteData;
  studio: PublicStudio;
  photos: PublicSitePhotos;
}

export interface Page {
  /** 200 unless said. */
  status?: number;
  /** The page's own title; the layout appends " — {studio name}" except on the home page. */
  title: string;
  /** ≤ 160 chars, for search engines and link previews. Falls back to the studio's description. */
  description?: string;
  /** Link-preview picture (the 960 size is used). */
  image?: PublicImage | null;
  /** The <main> element's contents. */
  body: Raw;
  /** schema.org objects, each written as its own <script type="application/ld+json">. */
  jsonLd?: object[];
  /** Extra scripts this page loads, paths under /site/ (e.g. '/site/lightbox.js'); always `defer`. */
  scripts?: string[];
  /** Path for <link rel=canonical>; defaults to the URL's path (without query except `page`/filters the page sets). */
  canonical?: string;
  /** Mark the nav item for this section: 'works' | 'commissions' | 'process' | 'about'. */
  nav?: 'works' | 'commissions' | 'process' | 'about';
  /** Pictures to preload with high priority (the largest above the fold). */
  preload?: PublicImage | null;
  noindex?: boolean;
}

export type Render = (ctx: PageCtx, params: Record<string, string>) => Promise<Page>;

/** A place's photos (the site's names: home.hero, home.rooms, commissions.intro, process.hero,
 * process.surface … process.finished, about.studio). Empty when the studio placed none. */
export const place = (ctx: PageCtx, name: string): PublicSitePhoto[] => ctx.photos.places[name] ?? [];
