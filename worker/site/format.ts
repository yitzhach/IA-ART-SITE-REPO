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

/** What the piece page says about shipping, or null when it isn't set (D-146). */
export function shippingLine(a: Pick<PublicArtwork, 'shipping' | 'currency'>): string | null {
  const s = a.shipping;
  if (!s) return null;
  if (s.quote) return 'By quote: ask and the artist will reply with shipping';
  if (s.estimate) return 'Worked out from your ZIP code in the cart (US)';
  if (s.cents === 0) return 'Free in the US';
  if (s.cents === null) return null;
  return `${priceLine({priceCents: s.cents, currency: a.currency ?? 'USD'})} in the US`;
}

/** Can this piece go in the cart: available, priced, and its shipping known or worked out at checkout. */
export function buyable(a: Pick<PublicArtwork, 'status' | 'priceCents' | 'shipping'>): boolean {
  return a.status === 'available' && a.priceCents !== null && !!a.shipping && !a.shipping.quote;
}

/** The longest side in inches (one decimal), or null when the size isn't recorded. */
export function longest(a: Pick<PublicArtwork, 'width' | 'height' | 'depth' | 'sizeUnit'>): number | null {
  const dims = [a.width, a.height, a.depth].filter((v): v is number => typeof v === 'number' && v > 0);
  if (!dims.length) return null;
  const max = Math.max(...dims);
  return Math.round((a.sizeUnit === 'cm' ? max / 2.54 : max) * 10) / 10;
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

/** This deploy as Cloudflare names it (the `version_metadata` binding): its id and when it was uploaded. */
export interface DeployVersion {
  id: string;
  timestamp?: string;
}

/** The footer's version line, in the studio's time zone: '2026-11-13 06:32 PST · 8ad56c05' (the last part is the
 * start of the Worker version id, as Cloudflare's Deployments list shows it). Null when the deploy isn't known. */
export function versionLine(v: DeployVersion | undefined, timeZone: string): string | null {
  if (!v?.id) return null;
  const id = v.id.slice(0, 8);
  const at = v.timestamp ? new Date(v.timestamp) : null;
  if (!at || Number.isNaN(at.getTime())) return id;
  const parts = (zone: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
    }).formatToParts(at);
  let p: Intl.DateTimeFormatPart[];
  try {
    p = parts(timeZone);
  } catch {
    p = parts('UTC'); // a time zone this runtime doesn't know
  }
  const get = (type: string) => p.find(x => x.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} ${get('timeZoneName')} · ${id}`;
}
