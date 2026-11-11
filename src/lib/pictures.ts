// Signed picture links: cached until shortly before they expire, at most 6 requests at a time.
import {ApiError, get} from '../api';

export type Width = 480 | 960 | 1600;
interface Signed {
  url: string;
  expiresAt: string;
}

export interface Loader {
  (fileId: string, width: Width): Promise<string>;
  clear(): void;
}

const SAFETY_MS = 60_000;
const MAX_AT_ONCE = 6;

export function createPictureLoader(
  fetchLink: (fileId: string, width: Width) => Promise<Signed> = (id, w) =>
    get<Signed>(`/files/${encodeURIComponent(id)}/download-url?width=${w}`),
  now: () => number = Date.now,
  maxAtOnce = MAX_AT_ONCE,
): Loader {
  const cache = new Map<string, {url: string; until: number}>();
  const inflight = new Map<string, Promise<string>>();
  let running = 0;
  const waiting: (() => void)[] = [];

  const slot = async <T>(job: () => Promise<T>): Promise<T> => {
    if (running >= maxAtOnce) await new Promise<void>(go => waiting.push(go));
    running++;
    try {
      return await job();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };

  const fresh = async (fileId: string, width: Width): Promise<string> => {
    const key = `${fileId}@${width}`;
    const hit = cache.get(key);
    if (hit && hit.until > now()) return hit.url;
    const pending = inflight.get(key);
    if (pending) return pending;
    const p = (async () => {
      let link: Signed;
      try {
        link = await slot(() => fetchLink(fileId, width));
      } catch (e) {
        if (width !== 480 && e instanceof ApiError && e.status === 404) return fresh(fileId, 480);
        throw e;
      }
      const until = Date.parse(link.expiresAt) - SAFETY_MS;
      cache.set(key, {url: link.url, until: Number.isNaN(until) ? now() + 5 * 60_000 : until});
      return link.url;
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };

  const loader = ((fileId: string, width: Width) => fresh(fileId, width)) as Loader;
  loader.clear = () => cache.clear();
  return loader;
}

/** A link to show picture `fileId` at about `width` px wide. */
export const pictureUrl = createPictureLoader();
