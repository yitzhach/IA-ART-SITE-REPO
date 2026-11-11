// Asking the studio assistant for a draft, and waiting for it to arrive (it writes through studio-api).
import {get} from '../api';
import type {ArtworkDetail} from '../types';

export type DraftStart = 'started' | 'unavailable' | 'failed';

/** When the work's draft was last written (`meta.draft.at`), or null if it never was. */
export function draftAt(a: {meta?: Record<string, unknown>}): string | null {
  const d = a.meta?.draft as {at?: unknown} | undefined;
  return typeof d?.at === 'string' ? d.at : null;
}

export async function requestDraft(artworkId: string): Promise<DraftStart> {
  try {
    const res = await fetch('/assistant/draft', {
      method: 'POST',
      credentials: 'include',
      headers: {'content-type': 'application/json', accept: 'application/json'},
      body: JSON.stringify({artworkId}),
    });
    if (res.status === 503) return 'unavailable';
    return res.ok ? 'started' : 'failed';
  } catch {
    return 'failed';
  }
}

export const DRAFT_WAIT_MS = 90_000;
const POLL_MS = 3000;

/** Drafts being written right now, so a screen opened meanwhile can say so. */
const writing = new Map<string, {since: string | null; startedAt: number}>();
export function markDrafting(id: string, since: string | null, startedAt = Date.now()) {
  writing.set(id, {since, startedAt});
}
export function draftingNow(id: string, now = Date.now()): {since: string | null; startedAt: number} | undefined {
  const w = writing.get(id);
  if (w && now - w.startedAt >= DRAFT_WAIT_MS) writing.delete(id);
  return writing.get(id);
}

export interface WaitOptions {
  intervalMs?: number;
  timeoutMs?: number;
  startedAt?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  load?: (id: string) => Promise<ArtworkDetail>;
  /** Return false to stop (the person left the screen). */
  keepGoing?: () => boolean;
}

/** Polls the work until `meta.draft.at` is no longer `since`. Resolves the new work, or null on timeout / leaving. */
export async function waitForDraft(
  id: string,
  since: string | null,
  o: WaitOptions = {},
): Promise<ArtworkDetail | null> {
  const now = o.now ?? Date.now;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const load = o.load ?? ((i: string) => get<ArtworkDetail>(`/artworks/${encodeURIComponent(i)}`));
  const started = o.startedAt ?? now();
  const limit = o.timeoutMs ?? DRAFT_WAIT_MS;
  while (now() - started < limit) {
    await sleep(o.intervalMs ?? POLL_MS);
    if (o.keepGoing && !o.keepGoing()) return null;
    try {
      const a = await load(id);
      if (draftAt(a) !== since) {
        writing.delete(id);
        return a;
      }
    } catch {
      // a hiccup: try again on the next beat
    }
  }
  writing.delete(id);
  return null;
}
