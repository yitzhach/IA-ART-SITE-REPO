// Calls the work screens share. Everything goes through the platform's /v1 API.
import {ApiError, get, patch, post} from '../api';
import type {Artwork, ArtworkDetail, ArtworkInput, ArtworkPage, FileRecord} from '../types';

export const CONFLICT_MESSAGE = 'This work changed on another device — reloaded. Try again.';

/** Every work, newest first (pages through the whole list). */
export async function listAll(): Promise<Artwork[]> {
  const out: Artwork[] = [];
  let cursor: string | null = null;
  do {
    const page: ArtworkPage = await get<ArtworkPage>(
      `/artworks?limit=200${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`,
    );
    out.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

export const getWork = (id: string) => get<ArtworkDetail>(`/artworks/${encodeURIComponent(id)}`);
export const createWork = (body: Partial<ArtworkInput>) => post<Artwork>('/artworks', body);
export const updateWork = (id: string, fields: Partial<ArtworkInput>, version: number) =>
  patch<Artwork>(`/artworks/${encodeURIComponent(id)}`, fields, version);
export const publishWork = (id: string, version: number) =>
  post<Artwork>(`/artworks/${encodeURIComponent(id)}/publish`, {}, version);
export const unpublishWork = (id: string, version: number) =>
  post<Artwork>(`/artworks/${encodeURIComponent(id)}/unpublish`, {}, version);
export const restoreWork = (id: string) => post<Artwork>('/actions/artwork.restore', {id});
export const setAltText = (file: FileRecord, altText: string) =>
  patch<FileRecord>(`/files/${encodeURIComponent(file.id)}`, {altText}, file.version);
export const reorderPictures = (artworkId: string, fileIds: string[]) =>
  post<void>('/files/reorder', {entityType: 'artwork', entityId: artworkId, fileIds});
export const listCollections = () =>
  get<{items: {name: string; count: number}[]}>('/artworks/collections').then(
    r => r.items.map(c => c.name),
    () => [] as string[],
  );

export const isConflict = (e: unknown) => e instanceof ApiError && e.status === 409;

/** Words for a person, never a status code. */
export function plainError(e: unknown, fallback: string): string {
  if (isConflict(e)) return CONFLICT_MESSAGE;
  if (e instanceof ApiError) {
    if (e.status === 400 && e.message && !/^[a-z_]+$/.test(e.message)) return e.message;
    return fallback;
  }
  if (e instanceof TypeError) return "Couldn't reach the studio. Check your connection and try again.";
  return e instanceof Error && e.message && !/\d{3}/.test(e.message) ? e.message : fallback;
}
