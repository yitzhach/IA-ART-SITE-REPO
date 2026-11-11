// Brings the current site's photographs in as draft works, one at a time, through the same routes the phone uses.
// Everything it touches is injected, so it runs under test without a browser. Running it again adds nothing.
import type {Drafts, Manifest, ManifestWork} from './types';

export interface ImportApi {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown, version?: number): Promise<T>;
  patch<T>(path: string, body: unknown, version: number): Promise<T>;
}

interface Prepared {
  name: string;
  palette: {hex: string; share: number}[];
}
interface StoredWork {
  id: string;
  version: number;
  title?: string;
  primaryFileId: string | null;
  description?: string;
  palette?: unknown[];
  draftedFields?: string[];
  meta?: Record<string, unknown>;
}
interface WorkDetail extends StoredWork {
  images?: {id: string}[];
}
interface Settings {
  version: number;
  meta: Record<string, unknown>;
}

export interface ImportDeps<P extends Prepared = Prepared> {
  manifest: Manifest;
  drafts: Drafts;
  api: ImportApi;
  prepare: (blob: Blob, name: string) => Promise<P>;
  upload: (prepared: P) => Promise<{id: string}>;
  attach: (fileId: string, artworkId: string) => Promise<unknown>;
  fetchImage: (url: string) => Promise<Blob>;
  /** Asks the assistant for the words (POST /assistant/draft). With `prepared`, it only writes them: no model call. */
  draft: (artworkId: string, prepared?: Drafts[string]) => Promise<'started' | 'unavailable' | 'failed'>;
  onProgress?: (p: ImportProgress) => void;
  signal?: AbortSignal;
}

export interface ImportProgress {
  /** 1-based position among the works that need doing. */
  index: number;
  total: number;
  key: string;
  title: string;
}

export interface ImportFailure {
  key: string;
  title: string;
  message: string;
}

export interface ImportResult {
  /** Works that needed doing this run. */
  total: number;
  /** Brand-new drafts made. */
  created: number;
  /** Works from an interrupted run that got their picture now. */
  repaired: number;
  /** Works that were already complete and left alone. */
  alreadyThere: number;
  failed: ImportFailure[];
  stopped: boolean;
  voiceSet: boolean;
}

export const importedKey = (w: {meta?: Record<string, unknown>}): string | null => {
  const k = (w.meta?.importedFrom as {key?: unknown} | undefined)?.key;
  return typeof k === 'string' ? k : null;
};

/** Every work, paged through (deleted ones are not listed). */
export async function listEveryWork(api: ImportApi): Promise<StoredWork[]> {
  const out: StoredWork[] = [];
  let cursor: string | null = null;
  do {
    const page: {items: StoredWork[]; nextCursor: string | null} = await api.get(
      `/artworks?limit=200${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`,
    );
    out.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

export type Plan = {work: ManifestWork; existing: StoredWork | null}[];

/** What is left to do: works not there yet, and works there without a picture (an interrupted run). */
export function plan(manifest: Manifest, existing: StoredWork[]): {todo: Plan; alreadyThere: number} {
  const byKey = new Map<string, StoredWork>();
  for (const w of existing) {
    const k = importedKey(w);
    if (k && !byKey.has(k)) byKey.set(k, w);
  }
  const todo: Plan = [];
  let alreadyThere = 0;
  for (const work of manifest.works) {
    const have = byKey.get(work.key) ?? null;
    if (!have || !have.primaryFileId) todo.push({work, existing: have});
    else alreadyThere++;
  }
  return {todo, alreadyThere};
}

export function plainMessage(e: unknown): string {
  const status = (e as {status?: unknown} | null)?.status;
  if (status === 401) return 'You were signed out. Sign in again, then tap Import again.';
  if (status === 403) return 'This account is not allowed to add works.';
  if (status === 409) return 'This work changed somewhere else. Tap Import again.';
  const m = e instanceof Error ? e.message : '';
  if (/failed to fetch|networkerror|load failed/i.test(m)) return 'The connection dropped. Tap Import again.';
  return m || 'Something went wrong with this one.';
}

const base = (path: string) => path.replace(/^.*\//, '');
const enc = encodeURIComponent;

function createBody(w: ManifestWork, palette: Prepared['palette'], sha: string) {
  const [page, slot] = w.importedFrom.split('#');
  return {
    title: w.title,
    ...(w.collection ? {collection: w.collection} : {}),
    status: w.status ?? 'available',
    ...(w.width != null ? {width: w.width} : {}),
    ...(w.height != null ? {height: w.height} : {}),
    ...(w.sizeUnit ? {sizeUnit: w.sizeUnit} : {}),
    ...(w.medium ? {medium: w.medium} : {}),
    ...(w.year != null ? {year: w.year} : {}),
    palette,
    meta: {importedFrom: {key: w.key, page, slot, file: w.source.path, sha}},
  };
}

export async function runImport<P extends Prepared>(d: ImportDeps<P>): Promise<ImportResult> {
  const {manifest, api} = d;
  const result: ImportResult = {total: 0, created: 0, repaired: 0, alreadyThere: 0, failed: [], stopped: false, voiceSet: false};

  const existing = await listEveryWork(api);
  const {todo, alreadyThere} = plan(manifest, existing);
  result.total = todo.length;
  result.alreadyThere = alreadyThere;

  // Complete works whose words never arrived (an earlier run stopped or the assistant was away) get them now.
  const byKey = new Map(existing.map(w => [importedKey(w), w] as const));
  const wordless = manifest.works.filter(w => {
    const have = byKey.get(w.key);
    return have?.primaryFileId && !have.description && !have.draftedFields?.length && !have.meta?.draft;
  });

  // The studio's voice, once: the assistant uses it as a style sample.
  if (manifest.voice && (todo.length || wordless.length)) {
    try {
      const s = await api.get<Settings>('/settings');
      if (!s.meta?.voice) {
        await api.patch('/settings', {meta: {...s.meta, voice: manifest.voice}}, s.version);
        result.voiceSet = true;
      }
    } catch {
      // not essential: the drafts still work without a style sample
    }
  }

  let index = 0;
  for (const {work, existing: have} of todo) {
    if (d.signal?.aborted) {
      result.stopped = true;
      break;
    }
    index++;
    d.onProgress?.({index, total: todo.length, key: work.key, title: work.title});
    try {
      let artwork: StoredWork;
      if (have) {
        artwork = have;
        // an interrupted run may have attached the picture without setting it as the cover
        const detail = await api.get<WorkDetail>(`/artworks/${enc(have.id)}`);
        const fileId = detail.images?.[0]?.id;
        if (fileId) {
          await api.patch(`/artworks/${enc(have.id)}`, {primaryFileId: fileId}, detail.version);
          result.repaired++;
          await words(d, work, have.id, !have.description && !have.draftedFields?.length);
          continue;
        }
      }
      const blob = await d.fetchImage(work.source.url);
      const prepared = await d.prepare(blob, base(work.source.path));
      const file = await d.upload(prepared);
      if (!have) {
        artwork = await api.post<StoredWork>('/artworks', createBody(work, prepared.palette, manifest.sha));
      }
      await d.attach(file.id, artwork!.id);
      // the work's version may have moved since it was made, so read it again
      const fresh = await api.get<WorkDetail>(`/artworks/${enc(artwork!.id)}`);
      await api.patch(
        `/artworks/${enc(artwork!.id)}`,
        {primaryFileId: file.id, ...(fresh.palette?.length ? {} : {palette: prepared.palette})},
        fresh.version,
      );
      if (have) result.repaired++;
      else result.created++;
      await words(d, work, artwork!.id, true);
    } catch (e) {
      result.failed.push({key: work.key, title: work.title, message: plainMessage(e)});
      if ((e as {status?: unknown} | null)?.status === 401) break;
    }
  }

  // Works that were complete but never got words.
  for (const work of wordless) {
    if (d.signal?.aborted) {
      result.stopped = true;
      break;
    }
    const have = byKey.get(work.key)!;
    await words(d, work, have.id, true);
  }
  return result;
}

/** The words: Isaac-approved prepared ones if drafts.json has them, otherwise the assistant drafts from the picture. */
async function words(d: Pick<ImportDeps, 'drafts' | 'draft'>, work: ManifestWork, artworkId: string, wanted: boolean) {
  if (!wanted) return;
  const prepared = d.drafts[work.key];
  try {
    await d.draft(artworkId, prepared);
  } catch {
    // The assistant being away (503) or slow is fine: the work is saved, and "Redo the draft" is on its screen.
  }
}
