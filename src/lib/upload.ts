// Uploads a prepared photo to the studio platform through its signed links.
import {post} from '../api';
import type {FileRecord} from '../types';
import type {Prepared} from './images';

interface UploadResponse {
  file: FileRecord;
  uploadUrl: string;
  expiresAt: string;
  sizeUrls: {width: number; uploadUrl: string}[];
}

async function put(url: string, blob: Blob, contentType: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {method: 'PUT', body: blob, headers: {'content-type': contentType}});
    } catch (e) {
      lastErr = e; // network error: retry once
      continue;
    }
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return;
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upload failed');
}

export async function uploadPrepared(
  p: Prepared,
  kind = 'photo',
  onProgress?: (done: number, total: number) => void,
): Promise<FileRecord> {
  const r = await post<UploadResponse>('/files/upload-url', {
    name: p.name,
    contentType: p.contentType,
    size: p.original.size,
    kind,
    sizes: p.sizes.map(s => ({width: s.width, size: s.blob.size})),
    pixels: p.pixels,
  });
  const jobs: (() => Promise<void>)[] = [() => put(r.uploadUrl, p.original, p.contentType)];
  for (const s of p.sizes) {
    const link = r.sizeUrls.find(u => u.width === s.width);
    if (!link) throw new Error(`No upload link for the ${s.width}px copy`);
    jobs.push(() => put(link.uploadUrl, s.blob, 'image/webp'));
  }
  const total = jobs.length;
  let done = 0,
    next = 0;
  onProgress?.(0, total);
  const worker = async () => {
    while (next < jobs.length) {
      await jobs[next++]!();
      onProgress?.(++done, total);
    }
  };
  await Promise.all(Array.from({length: Math.min(3, total)}, worker));
  return r.file;
}

export const attachToArtwork = (fileId: string, artworkId: string) =>
  post<FileRecord>(`/files/${encodeURIComponent(fileId)}/attach`, {entityType: 'artwork', entityId: artworkId});
