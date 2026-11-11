// The importer's data: what scripts/import/build-manifest.mjs writes (src/import/manifest.json) and the optional drafts.
export interface ManifestWork {
  /** Stable id, e.g. "abstract-3". Stored on the draft as meta.importedFrom.key. */
  key: string;
  title: string;
  titleFrom: 'page' | 'made';
  collection?: string;
  status?: 'sold' | 'available';
  width?: number;
  height?: number;
  sizeUnit?: 'in' | 'cm';
  medium?: string;
  year?: number;
  source: {path: string; url: string; pixels: {width: number; height: number}; bytes: number};
  alsoFrom: string[];
  mergedBecause: string[];
  /** "<page>.html#<slot id>" */
  importedFrom: string;
  alsoInCollections?: string[];
  alsoOn?: string[];
  notes?: string[];
}

export interface Manifest {
  sha: string;
  generatedAt: string;
  works: ManifestWork[];
  skipped: {path: string; reason: string}[];
  /** A writing sample of the current site's own copy, used as the assistant's style sample. */
  voice: string;
}

export interface WorkDraft {
  description?: string;
  tags?: string[];
  collection?: string;
  altText?: string;
}
export type Drafts = Record<string, WorkDraft>;
