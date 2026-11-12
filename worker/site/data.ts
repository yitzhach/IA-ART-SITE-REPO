// Everything the public pages know comes from studio-api's public routes, through the API service binding.
// The studio is the Worker's setting (STUDIO_SLUG, D-117), never anything in the request.
import type {
  PublicArtwork,
  PublicArtworkList,
  PublicCollectorPage,
  PublicFollowerPage,
  PublicShow,
  PublicAssistant,
  PublicCollections,
  PublicDigest,
  PublicSitePhotos,
  PublicStudio,
  PublicVisitorPage,
} from './types';

export class NotFound extends Error {}

export const PROFILE_SECONDS = 10;

/** GET a JSON answer through the edge cache for `seconds` (no cache in tests, where `caches` doesn't exist). */
async function edgeJson(api: Fetcher, url: string, seconds: number): Promise<unknown> {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(`https://site-cache.internal/${encodeURIComponent(url)}`);
  const hit = await cache?.match(key).catch(() => undefined);
  const res = hit ?? (await api.fetch(url, {headers: {accept: 'application/json'}}));
  if (res.status === 404) throw new NotFound(url);
  if (!res.ok) throw new Error(`studio-api ${res.status} for the profile`);
  if (!hit && cache) {
    const copy = new Response(res.clone().body, {
      headers: {'content-type': 'application/json', 'cache-control': `public, s-maxage=${seconds}`},
    });
    await cache.put(key, copy).catch(() => undefined);
  }
  return res.json();
}

export interface SiteData {
  slug: string;
  studio(): Promise<PublicStudio>;
  works(q?: {collection?: string; status?: string; cursor?: string}): Promise<PublicArtworkList>;
  /** null when the work isn't public (or doesn't exist). */
  work(slug: string): Promise<PublicArtwork | null>;
  collections(): Promise<PublicCollections>;
  sitePhotos(): Promise<PublicSitePhotos>;
  /** The chat's greeting and the artist's name; null when studio-api can't say (the page still works). */
  assistant(): Promise<PublicAssistant | null>;
  digest(): Promise<PublicDigest>;
  /** A made page; throws NotFound for an unknown token. */
  visitorPage(token: string): Promise<PublicVisitorPage>;
  /** A collector's page by its private link (D-163); throws NotFound for an unknown or stopped link. */
  collectorPage(token: string): Promise<PublicCollectorPage>;
  /** A follower's own page; throws NotFound for an unknown token. */
  followerPage(token: string): Promise<PublicFollowerPage>;
  /** A show, for its QR code's follow page; throws NotFound. */
  show(id: string): Promise<PublicShow>;
}

export function siteData(api: Fetcher, slug: string): SiteData {
  const base = `https://studio-api/v1/public/studios/${encodeURIComponent(slug)}`;
  const memo = new Map<string, Promise<unknown>>();
  const get = <T>(path: string, q: Record<string, string | undefined> = {}): Promise<T> => {
    const qs = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => !!e[1])).toString();
    const url = base + path + (qs ? `?${qs}` : '');
    if (!memo.has(url))
      memo.set(
        url,
        api.fetch(url, {headers: {accept: 'application/json'}}).then(async r => {
          if (r.status === 404) throw new NotFound(url);
          if (!r.ok) throw new Error(`studio-api ${r.status} for ${path}`);
          return r.json();
        }),
      );
    return memo.get(url) as Promise<T>;
  };
  return {
    slug,
    // The profile carries the catalogue version every page's cache key needs, so it is asked on every request: the
    // edge keeps it for a few seconds (a publish shows within PROFILE_SECONDS, D-116).
    studio: () => {
      const url = base;
      if (!memo.has(url)) memo.set(url, edgeJson(api, url, PROFILE_SECONDS));
      return memo.get(url) as Promise<PublicStudio>;
    },
    works: (q = {}) => get('/artworks', q),
    work: s =>
      get<PublicArtwork>(`/artworks/${encodeURIComponent(s)}`).catch(e =>
        e instanceof NotFound ? null : Promise.reject(e),
      ),
    collections: () => get('/collections'),
    sitePhotos: () => get('/site-photos'),
    assistant: () => get<PublicAssistant>('/assistant').catch(() => null),
    digest: () => get('/digest'),
    visitorPage: token => get(`/pages/${encodeURIComponent(token)}`),
    collectorPage: token => get(`/collectors/${encodeURIComponent(token)}`),
    followerPage: token => get(`/followers/${encodeURIComponent(token)}`),
    show: id => get(`/shows/${encodeURIComponent(id)}`),
  };
}
