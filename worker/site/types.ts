// The public shapes studio-api answers under /v1/public/studios/{slug} (Art-Talk-Back docs/openapi.json,
// packages/core PublicStudio, PublicArtwork, PublicSitePhotos). Read only; the site holds no data.

export type ImageWidth = 480 | 960 | 1600;

export interface PublicImage {
  fileId: string;
  altText: string | null;
  /** Original width ÷ height, when known. */
  aspectRatio: number | null;
  /** Paths on this origin, e.g. /v1/public/studios/{slug}/images/{fileId}/960.webp */
  sizes: {width: ImageWidth; url: string}[];
}

export type ArtworkStatus = 'available' | 'reserved' | 'sold' | 'not_for_sale' | 'archived';

export interface PublicArtwork {
  slug: string;
  title: string;
  medium: string | null;
  year: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  sizeUnit: 'in' | 'cm';
  editionSize: number | null;
  collection: string | null;
  tags: string[];
  palette: {hex: string; share: number}[];
  description: string | null;
  status: ArtworkStatus;
  /** Only for an available work with a price; otherwise null. */
  priceCents: number | null;
  currency: string | null;
  /** Cover first. */
  images: PublicImage[];
  publishedAt: string | null;
}

export interface PublicArtworkList {
  items: PublicArtwork[];
  nextCursor: string | null;
  catalogueVersion: number;
}

export interface SiteSection {
  key?: string;
  heading?: string;
  /** Plain text; paragraphs split by a blank line; lines starting with "• " are list items. Never HTML. */
  body?: string;
  place?: string;
}
export interface SitePage {
  title?: string;
  lede?: string;
  sections?: SiteSection[];
}
export type SitePageKey = 'home' | 'commissions' | 'process' | 'about';

export interface PublicStudio {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  /** Digits with an optional leading +. */
  phone: string | null;
  email: string | null;
  /** Call hours, 24-hour HH:MM, in `timezone`. */
  hours: {from: string; to: string} | null;
  timezone: string;
  pages: Partial<Record<SitePageKey, SitePage>>;
  catalogueVersion: number;
}

export interface PublicSitePhoto extends PublicImage {
  title: string;
  /** Set when the photo is a public work: link to /works/{workSlug}. */
  workSlug: string | null;
}
export interface PublicSitePhotos {
  places: Record<string, PublicSitePhoto[]>;
  catalogueVersion: number;
}

export interface PublicCollections {
  items: {name: string; count: number}[];
  catalogueVersion: number;
}
