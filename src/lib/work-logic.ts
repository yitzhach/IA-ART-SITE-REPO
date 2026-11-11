// The small pure rules behind the work screens: money, sizes, what is missing, tags, what changed.
import type {Artwork} from '../types';

/**
 * Dollars typed by a person to whole cents. `null` = left blank, `undefined` = not a price.
 * Accepts "1200", "1,200.50", "$80".
 */
export function parseDollars(text: string): number | null | undefined {
  const t = text.trim().replace(/^\$/, '').replace(/,/g, '').trim();
  if (t === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t) && !/^\.\d{1,2}$/.test(t)) return undefined;
  return Math.round(Number(t) * 100);
}

/** Cents to the text for an input: 120000 -> "1200", 120050 -> "1200.50". */
export function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return '';
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`;
}

/** Cents to text for reading: "$1,200" or "$1,200.50". */
export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return '';
  const whole = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rest = cents % 100;
  return '$' + whole + (rest ? '.' + String(rest).padStart(2, '0') : '');
}

/** A number typed by a person ("24", "24.5"): `null` blank, `undefined` not a number. */
export function parseNumber(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

/** Whole-number year: `null` blank, `undefined` not a year. */
export function parseYear(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  if (!/^\d{4}$/.test(t)) return undefined;
  return Number(t);
}

/** "24 × 36 × 2 in" (only the sizes that are known), or "" when none is. */
export function formatSize(
  s: {width: number | null; height: number | null; depth: number | null; sizeUnit: 'in' | 'cm'},
  times = ' × ',
): string {
  const parts = [s.width, s.height, s.depth].filter((n): n is number => n != null && n > 0);
  return parts.length ? parts.join(times) + ' ' + s.sizeUnit : '';
}

export const STATUS_LABELS: Record<Artwork['status'], string> = {
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
  not_for_sale: 'Not for sale',
  archived: 'Archived',
};

export type Missing = 'size' | 'price' | 'status';

/** The facts the assistant can never guess and Isaac has not given yet. */
export function missingFacts(
  a: Pick<Artwork, 'width' | 'height' | 'priceCents' | 'status'> & {depth?: number | null},
): Missing[] {
  const out: Missing[] = [];
  if (!a.width && !a.height) out.push('size');
  if (a.priceCents == null && a.status !== 'not_for_sale') out.push('price');
  if (!a.status) out.push('status');
  return out;
}

export const missingText = (m: Missing[]) => (m.length ? 'Missing: ' + m.join(', ') : '');

export const MAX_TAGS = 20;

export const normalizeTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

/** Add what was typed (comma separated is fine) to the list: lower case, no repeats, at most 20. */
export function addTags(list: string[], typed: string): string[] {
  const out = [...list];
  for (const raw of typed.split(',')) {
    const t = normalizeTag(raw);
    if (t && !out.includes(t) && out.length < MAX_TAGS) out.push(t);
  }
  return out;
}

export const removeTag = (list: string[], tag: string) => list.filter(t => t !== tag);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only the fields whose value differs from `before`: the body of one PATCH. */
export function changedFields<T extends object>(before: T, after: Partial<T>): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(after) as (keyof T)[]) {
    if (after[k] !== undefined && !same(before[k], after[k])) out[k] = after[k];
  }
  return out;
}

/** "Mar 4, 2026" from a UTC ISO string. */
export function plainDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'});
}
