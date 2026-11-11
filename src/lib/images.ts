// In-browser image prep: WebP copies at 480/960/1600 px wide plus a palette read by code. No paid image service.
import {readPalette} from './palette';

export type Slot = 480 | 960 | 1600;
export interface Prepared {
  original: Blob;
  contentType: string;
  name: string;
  pixels: {width: number; height: number};
  sizes: {width: Slot; blob: Blob}[];
  palette: {hex: string; share: number}[];
}

const SLOTS: Slot[] = [480, 960, 1600];
const QUALITY = 0.82;
export const HEIC_ERROR = 'Choose JPEG in the camera settings, or pick the photo again';

/** Nominal slots with their real pixel widths: never upscaled; a slot equal to a smaller one is skipped. */
export function plannedWidths(originalWidth: number): {slot: Slot; width: number}[] {
  const out: {slot: Slot; width: number}[] = [];
  for (const slot of SLOTS) {
    const width = Math.min(slot, originalWidth);
    if (width < 1 || out.some(o => o.width === width)) continue;
    out.push({slot, width});
  }
  return out;
}

type Surface = ImageBitmap | HTMLCanvasElement | OffscreenCanvas;
type Canvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
const ctxOf = (c: Canvas) => c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, {imageOrientation: 'from-image'});
  } catch {
    // Fall back to an <img> decode (browsers apply EXIF orientation to <img> by default).
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error(/hei[cf]/i.test(file.type) ? HEIC_ERROR : 'That file could not be read as a picture');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
const dims = (s: ImageBitmap | HTMLImageElement) =>
  s instanceof HTMLImageElement ? {w: s.naturalWidth, h: s.naturalHeight} : {w: s.width, h: s.height};

/** Draw `src` at `w` wide, stepping down by halves for quality. */
function scaleTo(src: Surface | HTMLImageElement, sw: number, sh: number, w: number): Canvas {
  const h = Math.max(1, Math.round((sh * w) / sw));
  let cur: Surface | HTMLImageElement = src;
  let cw = sw,
    ch = sh;
  while (cw / 2 > w) {
    const nw = Math.ceil(cw / 2),
      nh = Math.max(1, Math.ceil(ch / 2));
    const c = makeCanvas(nw, nh);
    const x = ctxOf(c);
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur as CanvasImageSource, 0, 0, nw, nh);
    cur = c;
    cw = nw;
    ch = nh;
  }
  const out = makeCanvas(w, h);
  const x = ctxOf(out);
  x.imageSmoothingQuality = 'high';
  x.drawImage(cur as CanvasImageSource, 0, 0, w, h);
  return out;
}

async function canvasBlob(c: Canvas, type: string, q: number): Promise<Blob | null> {
  if ('convertToBlob' in c) return c.convertToBlob({type, quality: q}).catch(() => null);
  return new Promise(res => c.toBlob(res, type, q));
}

async function encodeWebp(c: Canvas): Promise<Blob> {
  const b = await canvasBlob(c, 'image/webp', QUALITY);
  if (b && b.type === 'image/webp') return b;
  // Safari: the canvas gave PNG. Use the WASM encoder, loaded only now.
  const {encode} = await import('@jsquash/webp');
  const data = ctxOf(c).getImageData(0, 0, c.width, c.height);
  const buf = await encode(data, {quality: Math.round(QUALITY * 100)});
  return new Blob([buf], {type: 'image/webp'});
}

export async function prepareImage(file: Blob, name: string): Promise<Prepared> {
  const src = await decode(file);
  const {w, h} = dims(src);
  if (!w || !h) throw new Error(/hei[cf]/i.test(file.type) ? HEIC_ERROR : 'That file could not be read as a picture');
  try {
    const sizes: Prepared['sizes'] = [];
    for (const p of plannedWidths(w)) sizes.push({width: p.slot, blob: await encodeWebp(scaleTo(src, w, h, p.width))});
    const small = scaleTo(src, w, h, Math.min(64, w));
    const px = ctxOf(small).getImageData(0, 0, small.width, small.height).data;
    return {
      original: file,
      contentType: file.type || 'application/octet-stream',
      name,
      pixels: {width: w, height: h},
      sizes,
      palette: readPalette(px),
    };
  } finally {
    if ('close' in src) src.close();
  }
}
