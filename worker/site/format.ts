// How a work's facts are written on the site.
import type {PublicArtwork} from './types';

const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, ''));

/** '24 × 36 in (61 × 91.4 cm)'; depth added when known; null when no size. */
export function sizeLine(a: Pick<PublicArtwork, 'width' | 'height' | 'depth' | 'sizeUnit'>): string | null {
  const ok = (v: number | null): v is number => typeof v === 'number' && v > 0;
  if (!ok(a.height) || !ok(a.width)) return null;
  const dims = ok(a.depth) ? [a.height, a.width, a.depth] : [a.height, a.width];
  const inch = a.sizeUnit === 'in';
  const other = dims.map(v => (inch ? v * 2.54 : v / 2.54));
  return `${dims.map(n).join(' × ')} ${a.sizeUnit} (${other.map(v => n(Math.round(v * 10) / 10)).join(' × ')} ${inch ? 'cm' : 'in'})`;
}

/** '$1,200' for an available priced work, else null. */
export function priceLine(a: Pick<PublicArtwork, 'priceCents' | 'currency'>): string | null {
  if (a.priceCents === null || !a.currency) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: a.currency,
    maximumFractionDigits: a.priceCents % 100 ? 2 : 0,
  }).format(a.priceCents / 100);
}

/** What the piece page says about buying it. */
export function availability(a: Pick<PublicArtwork, 'status' | 'priceCents' | 'currency'>): {
  label: string;
  price: string | null;
} {
  if (a.status === 'sold') return {label: 'Sold — commission one like this', price: null};
  if (a.status === 'reserved') return {label: 'Reserved', price: null};
  if (a.status === 'available') {
    const p = priceLine(a);
    return p ? {label: 'Available', price: p} : {label: 'Price on request', price: null};
  }
  return {label: 'Not for sale', price: null};
}

/** Paragraphs and "• " lists of a plain-text body, for the pages to render (never HTML). */
export function blocks(body: string | undefined | null): ({p: string} | {list: string[]})[] {
  if (!body) return [];
  return body
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean)
    .map(b => {
      const lines = b.split('\n').map(l => l.trim());
      return lines.every(l => l.startsWith('• ')) ? {list: lines.map(l => l.slice(2))} : {p: lines.join(' ')};
    });
}
