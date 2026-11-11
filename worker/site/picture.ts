// One <img> with every size the picture has; the browser picks (D-106 sizes 480, 960, 1600).
import {html, type Raw} from './html';
import type {PublicImage} from './types';

export interface PictureOpts {
  /** The `sizes` attribute: how wide the picture is drawn, e.g. '(min-width: 900px) 50vw, 100vw'. */
  sizes: string;
  alt?: string | null;
  /** Above the fold: no lazy loading, high fetch priority. */
  eager?: boolean;
  className?: string;
}

export function picture(img: PublicImage, o: PictureOpts): Raw {
  const sorted = [...img.sizes].sort((a, b) => a.width - b.width);
  const src = sorted.find(s => s.width === 960) ?? sorted[sorted.length - 1];
  if (!src) return html``;
  const w = src.width;
  const h = img.aspectRatio ? Math.round(w / img.aspectRatio) : Math.round(w * 1.25);
  return html`<img
    src="${src.url}"
    srcset="${sorted.map(s => `${s.url} ${s.width}w`).join(', ')}"
    sizes="${o.sizes}"
    width="${w}"
    height="${h}"
    alt="${o.alt ?? img.altText ?? ''}"
    ${o.className ? html` class="${o.className}"` : ''}
    ${o.eager ? html`fetchpriority="high"` : html`loading="lazy"`}
    decoding="async"
  />`;
}

/** The URL of a size, or the nearest one below (for link previews and preloads). */
export function sizeUrl(img: PublicImage, width: 480 | 960 | 1600): string | null {
  const sorted = [...img.sizes].sort((a, b) => a.width - b.width);
  return (sorted.filter(s => s.width <= width).pop() ?? sorted[0])?.url ?? null;
}
