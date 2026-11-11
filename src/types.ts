// Shared types from the studio platform contract (studio-api). Other modules import them from here.
export type ActorType = 'user' | 'assistant' | 'system' | 'api';

export interface BaseRecord {
  id: string;
  studioId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  actorType: ActorType;
  version: number;
  deletedAt: string | null;
  meta: Record<string, unknown>;
}

export interface FileRecord extends BaseRecord {
  name: string;
  contentType: string;
  size: number;
  kind: string;
  status: 'pending' | 'ready';
  entityType: string | null;
  entityId: string | null;
  locked: boolean;
  position: number;
  altText: string | null;
}

export interface PaletteSwatch {
  hex: string;
  /** Basis points (10000 = whole image). */
  share: number;
}

export type DraftableField = 'description' | 'tags' | 'collection' | 'altText';

export interface Artwork extends BaseRecord {
  title: string;
  inventoryCode: string;
  medium: string;
  year: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  sizeUnit: 'in' | 'cm';
  priceCents: number | null;
  currency: string;
  status: 'available' | 'reserved' | 'sold' | 'not_for_sale' | 'archived';
  description: string;
  primaryFileId: string | null;
  slug: string | null;
  collection: string | null;
  tags: string[];
  palette: PaletteSwatch[];
  editionSize: number | null;
  public: boolean;
  publishedAt: string | null;
  /** "site_photo": a picture for the site's pages, kept out of the works list. Absent on older records = work. */
  kind?: 'work' | 'site_photo';
  draftedFields: DraftableField[];
}

export interface ArtworkDetail extends Artwork {
  /** In position order. */
  images: FileRecord[];
}

export interface ArtworkPage {
  items: Artwork[];
  nextCursor: string | null;
}

export interface CollectionCount {
  name: string;
  count: number;
}

/** The fields a work can be created or changed with (the platform's `POST` / `PATCH /v1/artworks`). */
export interface ArtworkInput {
  title: string;
  medium: string;
  year: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  sizeUnit: 'in' | 'cm';
  priceCents: number | null;
  currency: string;
  status: Artwork['status'];
  collection: string | null;
  tags: string[];
  palette: PaletteSwatch[];
  primaryFileId: string | null;
  description: string;
  editionSize: number | null;
  slug: string;
  kind: 'work' | 'site_photo';
}
