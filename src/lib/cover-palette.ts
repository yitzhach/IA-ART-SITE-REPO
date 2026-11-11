// Colours of a picture already stored on the platform: fetch its 480 px WebP, shrink it, read the palette.
import {pictureUrl} from './pictures';
import {readPalette, type Swatch} from './palette';

export interface PaletteDeps {
  url: (fileId: string) => Promise<string>;
  /** RGBA pixels of the picture, shrunk to about 64 px wide. */
  pixels: (url: string) => Promise<Uint8ClampedArray>;
}

async function browserPixels(url: string): Promise<Uint8ClampedArray> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('picture not available');
  const bmp = await createImageBitmap(await res.blob());
  try {
    const w = Math.min(64, bmp.width);
    const h = Math.max(1, Math.round((bmp.height * w) / bmp.width));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(bmp, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  } finally {
    bmp.close();
  }
}

/** The palette of a stored picture, or null if it cannot be read (the caller keeps the old one quietly). */
export async function coverPalette(
  fileId: string,
  deps: PaletteDeps = {url: id => pictureUrl(id, 480), pixels: browserPixels},
): Promise<Swatch[] | null> {
  try {
    const palette = readPalette(await deps.pixels(await deps.url(fileId)));
    return palette.length ? palette : null;
  } catch {
    return null;
  }
}
