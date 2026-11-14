// The contract between the router, the layout and each page. A page returns its <main> and its metadata;
// the layout (layout.ts) wraps it in the document, header, footer, theme and contact links.
import type {Raw} from './html';
import type {SiteData} from './data';
import type {MoreLink} from './optional';
import type {Template} from './templates';
import type {PublicImage, PublicSitePhoto, PublicSitePhotos, PublicStudio} from './types';

export interface PageCtx {
  /** The visitor's URL (origin = this site's address, used for canonical links and the links in messages). */
  url: URL;
  data: SiteData;
  studio: PublicStudio;
  photos: PublicSitePhotos;
  /** The footer's version line (which deploy this page came from); absent in tests and local runs. */
  version?: string | null;
  /** The footer's links to pages that exist only once saved (questions, trade, privacy, terms). */
  more?: MoreLink[];
  /** The look the page is written in (D-180): its CSS, fonts and the options the pages ask. */
  template: Template;
  /** Set when the page is a preview in a look other than the studio's own (`?look=`): never indexed. */
  look?: string | null;
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
  /** The preloaded picture's `sizes`, when the page draws it at another width than the default for its path. */
  preloadSizes?: string;
  /** More font files to preload, paths under /fonts/, for a face this page alone shows above the fold
   * (the layout already preloads PRELOAD_FONTS). A face found only once the CSS is in arrives late. */
  fonts?: string[];
  noindex?: boolean;
  /** Extra stylesheets this page links, paths under /site/ (e.g. '/site/ask.css'). */
  styles?: string[];
}

export type Render = (ctx: PageCtx, params: Record<string, string>) => Promise<Page>;

/** A place's photos (the site's names: home.hero, home.rooms, commissions.intro, process.hero,
 * process.surface … process.finished, about.studio). Empty when the studio placed none. */
export const place = (ctx: PageCtx, name: string): PublicSitePhoto[] => ctx.photos.places[name] ?? [];
