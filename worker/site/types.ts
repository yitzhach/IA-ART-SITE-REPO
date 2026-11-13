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
  /** Shipping in the US (D-146): free, a flat or pinned amount, a ZIP estimate at checkout, or a quote. Null: not set. */
  shipping?: {tier: 1 | 2 | 3 | 4; cents: number | null; estimate: boolean; quote: boolean} | null;
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
/** `trade`, `privacy` and `terms` exist only once the artist saves them (D-175). */
export type SitePageKey = 'home' | 'commissions' | 'process' | 'about' | 'trade' | 'privacy' | 'terms';

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

/** The chat sheet's opening (studio-api PublicAssistant). */
export interface PublicAssistant {
  name: string;
  artistName: string;
  greeting: string;
  suggestions: string[];
  replyTime: string | null;
  answers: Record<string, string>;
  /** false: the chat is off or the month's budget is spent; the page shows search and Ask the artist. */
  available: boolean;
  catalogueVersion: number;
}

/** One public work as the digest lists it (studio-api DigestWork). `image` is the cover at 480 px, a path. */
export interface DigestWork {
  slug: string;
  title: string;
  medium: string | null;
  year: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  sizeUnit: 'in' | 'cm';
  status: ArtworkStatus;
  priceCents: number | null;
  currency: string | null;
  collection: string | null;
  tags: string[];
  palette: {hex: string; share: number}[];
  blurb: string | null;
  image: string | null;
}
export interface PublicDigest {
  works: DigestWork[];
  catalogueVersion: number;
}

/** A page a visitor made from the pieces the assistant suggested (studio-api PublicVisitorPage). */
export interface PublicVisitorPage {
  token: string;
  title: string;
  question: string | null;
  works: PublicArtwork[];
  createdAt: string;
  catalogueVersion: number;
}

/** A work a collector owns, on their page (studio-api PublicOwnedWork, D-164, D-166). Pictures come through the
 * page's own token, so a sold work that is no longer public still shows to its owner. */
export interface PublicOwnedWork extends PublicArtwork {
  certificate: string;
  /** YYYY-MM-DD, when the sale recorded it. */
  soldOn: string | null;
}

/** A public work still in first look (D-165): shown on collector and follower pages before the public site. */
export interface PublicFirstLookWork extends PublicArtwork {
  /** When it reaches the public site. */
  publicFrom: string;
}

export type CommissionStage = 'surface' | 'layering' | 'color' | 'erosion' | 'finished';

/** A collector's private page (studio-api PublicCollectorPage, D-163). First name only; no email, no prices paid. */
export interface PublicCollectorPage {
  firstName: string;
  studioName: string;
  works: PublicOwnedWork[];
  care: string | null;
  firstLook: PublicFirstLookWork[];
  commissions: {
    title: string;
    size: string | null;
    stage: CommissionStage;
    status: 'open' | 'done' | 'cancelled';
    notes: Partial<Record<CommissionStage, string>>;
    dueOn: string | null;
    updatedAt: string;
  }[];
  catalogueVersion: number;
}

/** A follower's own page (studio-api PublicFollowerPage). */
export interface PublicFollowerPage {
  /** Partly hidden, e.g. "fa…@example.com". */
  email: string;
  following: boolean;
  studioName: string;
  firstLook: PublicFirstLookWork[];
}

/** A show, for the follow page its QR code opens (studio-api PublicShow). */
export interface PublicShow {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  startsOn: string | null;
  endsOn: string | null;
}
