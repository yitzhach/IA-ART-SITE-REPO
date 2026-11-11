// A picture that reserves its space first, then fills in from a signed link.
import {pictureUrl, type Width} from '../lib/pictures';
import type {FileRecord} from '../types';
import {h} from '../ui';

/** Width / height of a stored picture, from `meta.pixels`, or null when unknown. */
export function aspectOf(file: Pick<FileRecord, 'meta'> | null | undefined): number | null {
  const p = file?.meta?.pixels as {width?: unknown; height?: unknown} | undefined;
  return typeof p?.width === 'number' && typeof p?.height === 'number' && p.width > 0 && p.height > 0
    ? p.width / p.height
    : null;
}

export interface PictureOptions {
  /** Used when the picture's own shape is unknown, or to force a crop (e.g. "1 / 1"). */
  ratio?: string;
  cover?: boolean;
  alt?: string;
  class?: string;
}

/** `fileId` null shows a quiet "No photo" block. */
export function picture(
  file: Pick<FileRecord, 'id' | 'meta'> | null,
  width: Width,
  o: PictureOptions = {},
): HTMLElement {
  const ratio = o.ratio ?? (aspectOf(file) ? String(aspectOf(file)) : '4 / 5');
  const box = h(
    'div',
    {class: ['pic', o.cover ? 'crop' : '', o.class ?? ''].filter(Boolean).join(' '), style: `aspect-ratio: ${ratio}`},
    file ? null : h('span', {class: 'pic-note'}, 'No photo'),
  );
  if (!file) return box;
  const img = h('img', {alt: o.alt ?? '', loading: 'lazy', decoding: 'async'});
  pictureUrl(file.id, width).then(
    url => {
      img.src = url;
      box.append(img);
    },
    () => box.append(h('span', {class: 'pic-note'}, 'Photo not available')),
  );
  img.addEventListener('error', () => {
    img.remove();
    box.append(h('span', {class: 'pic-note'}, 'Photo not available'));
  });
  return box;
}
