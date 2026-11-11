// Everything the public pages know comes from studio-api's public routes, through the API service binding.
// The studio is the Worker's setting (STUDIO_SLUG, D-117), never anything in the request.
import type {PublicArtwork, PublicArtworkList, PublicCollections, PublicSitePhotos, PublicStudio} from './types';

export class NotFound extends Error {}

export interface SiteData {
  slug: string;
  studio(): Promise<PublicStudio>;
  works(q?: {collection?: string; status?: string; cursor?: string}): Promise<PublicArtworkList>;
  /** null when the work isn't public (or doesn't exist). */
  work(slug: string): Promise<PublicArtwork | null>;
  collections(): Promise<PublicCollections>;
  sitePhotos(): Promise<PublicSitePhotos>;
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
    studio: () => get('', {}),
    works: (q = {}) => get('/artworks', q),
    work: s =>
      get<PublicArtwork>(`/artworks/${encodeURIComponent(s)}`).catch(e =>
        e instanceof NotFound ? null : Promise.reject(e),
      ),
    collections: () => get('/collections'),
    sitePhotos: () => get('/site-photos'),
  };
}
