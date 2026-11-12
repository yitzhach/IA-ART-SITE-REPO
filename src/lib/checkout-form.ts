// The Site screen's Checkout section (D-144): dollars, percent and hours <-> what settings.meta.site.checkout saves.
import {centsToDollars, parseDollars} from './work-logic';

export interface Checkout {
  enabled?: boolean;
  card?: boolean;
  venmo?: string;
  zelle?: string;
  shippingCents?: number;
  smallMaxInches?: number;
  returns?: string;
  taxBps?: number;
  manualHoldHours?: number;
}
export interface CheckoutFields {
  enabled: boolean;
  card: boolean;
  venmo: string;
  zelle: string;
  shipping: string;
  smallMax: string;
  returns: string;
  taxPercent: string;
  holdHours: string;
}

export const DEFAULT_RETURNS =
  'Returns within 7 days of delivery for pieces bought here, in their original condition. Commissions are final.';

export function toFields(c: Checkout | undefined): CheckoutFields {
  return {
    enabled: c?.enabled === true,
    card: c?.card !== false,
    venmo: c?.venmo ?? '',
    zelle: c?.zelle ?? '',
    shipping: centsToDollars(c?.shippingCents ?? null),
    smallMax: c?.smallMaxInches ? String(c.smallMaxInches) : '36',
    returns: c?.returns ?? DEFAULT_RETURNS,
    taxPercent: c?.taxBps ? String(c.taxBps / 100) : '',
    holdHours: c?.manualHoldHours ? String(c.manualHoldHours) : '48',
  };
}

type Result = {value: Checkout} | {error: string; field: keyof CheckoutFields};

export function fromFields(f: CheckoutFields): Result {
  const shipping = parseDollars(f.shipping);
  if (shipping === undefined) return {error: 'Shipping in dollars, like 40 or 40.00.', field: 'shipping'};
  const small = f.smallMax.trim() === '' ? 36 : Number(f.smallMax);
  if (!Number.isFinite(small) || small < 1 || small > 240) return {error: 'Inches from 1 to 240.', field: 'smallMax'};
  const tax = f.taxPercent.trim() === '' ? 0 : Number(f.taxPercent.trim().replace(/%$/, ''));
  if (!Number.isFinite(tax) || tax < 0 || tax > 20)
    return {error: 'A percent from 0 to 20, or leave it empty.', field: 'taxPercent'};
  const hours = f.holdHours.trim() === '' ? 48 : Number(f.holdHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168)
    return {error: 'Whole hours from 1 to 168.', field: 'holdHours'};
  const venmo = f.venmo.trim();
  if (venmo && !/^@?[A-Za-z0-9_-]{3,40}$/.test(venmo)) return {error: 'A Venmo name like @Your-Name.', field: 'venmo'};
  const zelle = f.zelle.trim();
  if (zelle && zelle.length < 5) return {error: 'The email or phone number Zelle uses.', field: 'zelle'};
  const value: Checkout = {
    enabled: f.enabled,
    card: f.card,
    shippingCents: shipping ?? 0,
    smallMaxInches: small,
    taxBps: Math.round(tax * 100),
    manualHoldHours: hours,
  };
  if (venmo) value.venmo = venmo.startsWith('@') ? venmo : `@${venmo}`;
  if (zelle) value.zelle = zelle;
  if (f.returns.trim()) value.returns = f.returns.trim().slice(0, 600);
  return {value};
}
