// Shipping in Studio (D-146…D-154): a piece's tier and extras, and the studio's shipping settings, as form text and back.
// Nothing here works out what shipping costs: that is the platform's one calculator.
import {centsToDollars, parseDollars, parseNumber} from './work-logic';

export type ShipTier = 1 | 2 | 3 | 4;
export interface ArtworkShipping {
  tier?: ShipTier | null;
  cents?: number | null;
  weightLb?: number | null;
  promo?: boolean;
  crated?: boolean;
  customQuote?: boolean;
  fragile?: boolean;
  pairsWith?: string[];
}

export const TIER_LABELS: Record<ShipTier, string> = {
  1: 'Small: ships free',
  2: 'Medium: flat shipping',
  3: 'Large: ZIP estimate',
  4: 'Quote: oversize, crated or freight',
};

export interface PieceShippingFields {
  tier: string; // '' | '1'..'4'
  cents: string; // dollars, '' = none
  weightLb: string;
  crated: boolean;
  customQuote: boolean;
}

export function pieceFields(s: ArtworkShipping | null | undefined): PieceShippingFields {
  return {
    tier: s?.tier ? String(s.tier) : '',
    cents: centsToDollars(s?.cents ?? null),
    weightLb: s?.weightLb == null ? '' : String(s.weightLb),
    crated: !!s?.crated,
    customQuote: !!s?.customQuote,
  };
}

/**
 * The piece's shipping after the form, keeping every other key as it was and in its order, so an untouched form
 * reads as unchanged. Null when nothing is set.
 */
export function mergePiece(
  orig: ArtworkShipping | null | undefined,
  f: PieceShippingFields,
): {value: ArtworkShipping | null} | {error: string; field: 'cents' | 'weightLb'} {
  const cents = parseDollars(f.cents);
  if (cents === undefined) return {error: 'Dollars, like 85 or 85.50.', field: 'cents'};
  const weight = parseNumber(f.weightLb);
  if (weight === undefined || (weight !== null && (weight < 0 || weight > 500)))
    return {error: 'Pounds from 0 to 500.', field: 'weightLb'};
  const out: Record<string, unknown> = {...(orig ?? {})};
  const set = (k: string, v: unknown) => {
    const empty = v === null || v === false || v === undefined;
    const was = out[k];
    if (empty && (was === null || was === false || was === undefined)) return;
    out[k] = v;
  };
  set('tier', f.tier ? (Number(f.tier) as ShipTier) : null);
  set('cents', cents);
  set('weightLb', weight);
  set('crated', f.crated);
  set('customQuote', f.customQuote);
  return {value: Object.keys(out).length ? (out as ArtworkShipping) : null};
}

// ---- the studio's settings (settings.meta.site.shipping)

export interface ShippingSettings {
  tier2Cents?: number;
  originZip?: string;
  paddingIn?: number;
  residentialCents?: number;
  cushionBps?: number;
  rates?: {asOf: string; weights: number[]; zones: Record<string, number[]>};
  r1?: {on?: boolean; starts?: string | null; ends?: string | null};
  r2?: {
    on?: boolean;
    starts?: string | null;
    ends?: string | null;
    minCents?: number;
    bps?: number;
    capCents?: number | null;
  };
  [k: string]: unknown;
}

export interface SettingsFields {
  tier2: string;
  originZip: string;
  padding: string;
  residential: string;
  cushionPercent: string;
  r1: boolean;
  r2: boolean;
  r2Min: string;
  r2Percent: string;
  r2Cap: string;
  rates: string;
}

/** The rate grid as text: "lb 1 2 3 5…" then one line per zone in dollars, "2: 12.34 13.10 …". Empty: built-in rates. */
export function ratesText(r: ShippingSettings['rates']): string {
  if (!r) return '';
  const zones = Object.keys(r.zones).sort();
  return [
    `as of ${r.asOf}`,
    `lb ${r.weights.join(' ')}`,
    ...zones.map(z => `${z}: ${r.zones[z]!.map(c => centsToDollars(c)).join(' ')}`),
  ].join('\n');
}

export function parseRates(text: string): ShippingSettings['rates'] | null | 'bad' {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const asOf = /^as of (\d{4}-\d{2}-\d{2})$/i.exec(lines[0]!)?.[1];
  const lb = /^lb\s+(.+)$/i.exec(lines[1] ?? '')?.[1];
  if (!asOf || !lb) return 'bad';
  const weights = lb.split(/[\s,]+/).map(Number);
  if (weights.some(w => !Number.isInteger(w) || w < 1 || w > 150) || weights.length < 2) return 'bad';
  const zones: Record<string, number[]> = {};
  for (const l of lines.slice(2)) {
    const m = /^([2-8])\s*:\s*(.+)$/.exec(l);
    if (!m) return 'bad';
    const cents = m[2]!.split(/[\s,]+/).map(v => parseDollars(v.replace(/^\$/, '')));
    if (cents.length !== weights.length || cents.some(c => c === undefined || c === null)) return 'bad';
    zones[m[1]!] = cents as number[];
  }
  if (!Object.keys(zones).length) return 'bad';
  return {asOf, weights, zones};
}

export function settingsFields(s: ShippingSettings | undefined): SettingsFields {
  return {
    tier2: centsToDollars(s?.tier2Cents ?? 2200),
    originZip: s?.originZip ?? '42503',
    padding: String(s?.paddingIn ?? 2),
    residential: centsToDollars(s?.residentialCents ?? 600),
    cushionPercent: String((s?.cushionBps ?? 1000) / 100),
    r1: s?.r1?.on !== false,
    r2: s?.r2?.on !== false,
    r2Min: centsToDollars(s?.r2?.minCents ?? 50000),
    r2Percent: String((s?.r2?.bps ?? 2000) / 100),
    r2Cap: centsToDollars(s?.r2?.capCents ?? null),
    rates: ratesText(s?.rates),
  };
}

type Result = {value: ShippingSettings} | {error: string; field: keyof SettingsFields};

/** The settings after the form; keys this form doesn't show (tier lines, dates, words) are kept as they were. */
export function settingsFrom(orig: ShippingSettings | undefined, f: SettingsFields): Result {
  const tier2 = parseDollars(f.tier2);
  if (tier2 === undefined || tier2 === null) return {error: 'Dollars, like 22.', field: 'tier2'};
  if (!/^\d{5}$/.test(f.originZip.trim())) return {error: 'A 5-digit ZIP.', field: 'originZip'};
  const padding = Number(f.padding);
  if (!Number.isFinite(padding) || padding < 0 || padding > 12)
    return {error: 'Inches from 0 to 12.', field: 'padding'};
  const residential = parseDollars(f.residential);
  if (residential === undefined) return {error: 'Dollars, like 6.', field: 'residential'};
  const cushion = Number(f.cushionPercent.replace(/%$/, ''));
  if (!Number.isFinite(cushion) || cushion < 0 || cushion > 100)
    return {error: 'A percent from 0 to 100.', field: 'cushionPercent'};
  const min = parseDollars(f.r2Min);
  if (min === undefined || min === null) return {error: 'Dollars, like 500.', field: 'r2Min'};
  const pct = Number(f.r2Percent.replace(/%$/, ''));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return {error: 'A percent from 0 to 100.', field: 'r2Percent'};
  const cap = parseDollars(f.r2Cap);
  if (cap === undefined) return {error: 'Dollars, or leave it empty for no cap.', field: 'r2Cap'};
  const rates = parseRates(f.rates);
  if (rates === 'bad')
    return {
      error: 'Start with "as of 2026-01-01", then "lb 1 2 3…", then one line per zone like "2: 12.34 13.10…".',
      field: 'rates',
    };
  const value: ShippingSettings = {
    ...(orig ?? {}),
    tier2Cents: tier2,
    originZip: f.originZip.trim(),
    paddingIn: padding,
    residentialCents: residential ?? 0,
    cushionBps: Math.round(cushion * 100),
    r1: {...(orig?.r1 ?? {}), on: f.r1},
    r2: {...(orig?.r2 ?? {}), on: f.r2, minCents: min, bps: Math.round(pct * 100), capCents: cap},
  };
  if (rates) value.rates = rates;
  else delete value.rates;
  return {value};
}
