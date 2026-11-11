// The import's second step: the old site's words and photo placements, once, after the photos are in.
// Pure builders (profile, places) plus runSiteStep, which uses the same injected api as run.ts so it runs under test.
import type {ImportApi} from './run';
import {importedKey} from './run';
import type {Manifest} from './types';

export interface SiteText {
  sha: string;
  profile: {name?: string; tagline?: string; description?: string; phone?: string; email?: string};
  pages: Record<string, unknown>;
  /** place name -> the old site's image paths, in order */
  places: Record<string, string[]>;
}

/** The profile the platform validates (settings.meta.site). */
export interface SiteProfile {
  name?: string;
  tagline?: string;
  description?: string;
  phone?: string;
  email?: string;
  hours?: {from: string; to: string};
  pages?: Record<string, unknown>;
  photos?: Record<string, string[]>;
}

export const DEFAULT_HOURS = {from: '09:00', to: '18:00'} as const; // Isaac: calls 9 to 6
export const DEFAULT_TIMEZONE = 'America/New_York'; // the platform's default, never chosen by anyone
export const STUDIO_TIMEZONE = 'America/Los_Angeles'; // a 949 number: Southern California
const MAX_PER_PLACE = 12;

interface ListedWork {
  id: string;
  version: number;
  title?: string;
  public?: boolean;
  kind?: string;
  meta?: Record<string, unknown>;
}
interface Settings {
  version: number;
  timezone?: string;
  meta: Record<string, unknown> & {site?: unknown; siteImport?: Record<string, unknown>};
}

/** An artwork came from the old site's loose pictures, not from a work's page. */
export const isSitePhotoImport = (w: {meta?: Record<string, unknown>}): boolean =>
  (w.meta?.importedFrom as {page?: unknown} | undefined)?.page === 'site-photo';

/** (b) The profile: contact fields, hours and the page words, as the old site had them. Places are added by the caller. */
export function buildProfile(text: SiteText): SiteProfile {
  const out: SiteProfile = {};
  for (const k of ['name', 'tagline', 'description', 'phone', 'email'] as const) {
    const v = text.profile?.[k];
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  out.hours = {...DEFAULT_HOURS};
  if (text.pages && Object.keys(text.pages).length) out.pages = structuredClone(text.pages);
  return out;
}

/**
 * (c) place -> artwork ids. An old image path is matched to the manifest entry whose source.path or alsoFrom has it,
 * then to the artwork that came from that entry (meta.importedFrom.key). Paths with no artwork are listed in `skipped`.
 */
export function buildPlaces(
  places: SiteText['places'],
  manifest: Pick<Manifest, 'works'>,
  artworks: {id: string; meta?: Record<string, unknown>}[],
): {photos: Record<string, string[]>; skipped: string[]} {
  const keyByPath = new Map<string, string>();
  for (const w of manifest.works) {
    keyByPath.set(w.source.path, w.key);
    for (const p of w.alsoFrom) if (!keyByPath.has(p)) keyByPath.set(p, w.key);
  }
  const idByKey = new Map<string, string>();
  for (const a of artworks) {
    const k = importedKey(a);
    if (k && !idByKey.has(k)) idByKey.set(k, a.id);
  }
  const photos: Record<string, string[]> = {};
  const skipped: string[] = [];
  for (const [place, paths] of Object.entries(places)) {
    const ids: string[] = [];
    for (const path of paths) {
      const key = keyByPath.get(path);
      const id = key ? idByKey.get(key) : undefined;
      if (!id) skipped.push(path);
      else if (!ids.includes(id) && ids.length < MAX_PER_PLACE) ids.push(id);
    }
    if (ids.length) photos[place] = ids;
  }
  return {photos, skipped: [...new Set(skipped)]};
}

export interface SiteStepResult {
  /** false: nothing done (already ran, or Isaac already has a site profile). */
  ran: boolean;
  reason?: 'already-done' | 'has-profile';
  kindsMarked: number;
  placesSet: number;
  skippedPaths: string[];
  published: number;
  failed: {title: string; message: string}[];
  timezoneChanged: boolean;
}

export interface SiteStepDeps {
  api: ImportApi;
  manifest: Manifest;
  text: SiteText;
  onProgress?: (message: string) => void;
}

const enc = encodeURIComponent;
const empty = (reason?: SiteStepResult['reason']): SiteStepResult => ({
  ran: false,
  ...(reason ? {reason} : {}),
  kindsMarked: 0,
  placesSet: 0,
  skippedPaths: [],
  published: 0,
  failed: [],
  timezoneChanged: false,
});

async function listAll(api: ImportApi): Promise<ListedWork[]> {
  const out: ListedWork[] = [];
  let cursor: string | null = null;
  do {
    const page: {items: ListedWork[]; nextCursor: string | null} = await api.get(
      `/artworks?limit=200${cursor ? '&cursor=' + enc(cursor) : ''}`,
    );
    out.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

const message = (e: unknown) => (e instanceof Error && e.message ? e.message : 'It could not be published.');

/** Has the step already run, or does Isaac already have a profile? Reads settings only. */
export async function siteStepState(api: ImportApi): Promise<'todo' | 'already-done' | 'has-profile'> {
  const s = await api.get<Settings>('/settings');
  if (s.meta?.siteImport?.siteStep) return 'already-done';
  if (s.meta?.site) return 'has-profile';
  return 'todo';
}

export async function runSiteStep(d: SiteStepDeps): Promise<SiteStepResult> {
  const {api} = d;
  const settings = await api.get<Settings>('/settings');
  if (settings.meta?.siteImport?.siteStep) return empty('already-done');
  if (settings.meta?.site) return empty('has-profile'); // never overwrite what Isaac has

  const result = empty();
  result.ran = true;
  const works = await listAll(api);
  const version = new Map(works.map(w => [w.id, w.version] as const));

  // (a) site photos are marked, so they stay out of the works list
  d.onProgress?.('Sorting the site photos from the works…');
  for (const w of works) {
    if (!isSitePhotoImport(w) || w.kind === 'site_photo') continue;
    const updated = await api.patch<ListedWork>(`/artworks/${enc(w.id)}`, {kind: 'site_photo'}, w.version);
    version.set(w.id, updated?.version ?? w.version + 1);
    w.kind = 'site_photo';
    result.kindsMarked++;
  }

  // (b) (c) the profile with its places
  const {photos, skipped} = buildPlaces(d.text.places, d.manifest, works);
  const site: SiteProfile = {...buildProfile(d.text), ...(Object.keys(photos).length ? {photos} : {})};
  result.placesSet = Object.keys(photos).length;
  result.skippedPaths = skipped;

  // (d) (f) one PATCH: the profile, the record that this ran, and the time zone while it is still the default
  const body: Record<string, unknown> = {
    meta: {...settings.meta, site, siteImport: {...settings.meta?.siteImport, siteStep: d.manifest.sha}},
  };
  if (!settings.timezone || settings.timezone === DEFAULT_TIMEZONE) {
    body.timezone = STUDIO_TIMEZONE;
    result.timezoneChanged = true;
  }
  d.onProgress?.('Saving the words…');
  await api.patch('/settings', body, settings.version);

  // (e) a photo shows on the site only while it is public. Only the site photos are published here (they were public
  // on the old site); a work placed on a page waits for Isaac's own approval like any other draft (D-122).
  const placed = new Set(Object.values(photos).flat());
  const todo = works.filter(w => placed.has(w.id) && !w.public && w.kind === 'site_photo');
  for (const [i, w] of todo.entries()) {
    d.onProgress?.(`Publishing site photo ${i + 1} of ${todo.length}…`);
    try {
      await api.post(`/artworks/${enc(w.id)}/publish`, {}, version.get(w.id) ?? w.version);
      result.published++;
    } catch (e) {
      result.failed.push({title: w.title || 'Untitled', message: message(e)});
    }
  }
  return result;
}
