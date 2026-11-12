// Orders (Site 3.0 stage 4, D-144, D-145): what visitors bought from the site. Pure labels and rules, plus the calls.
import {get, post} from '../api';
import {formatPrice} from './work-logic';

export type OrderMethod = 'card' | 'venmo' | 'zelle';
export type OrderStatus = 'pending' | 'awaiting_payment' | 'paid' | 'expired' | 'cancelled' | 'refunded';
export interface Order {
  id: string;
  version: number;
  code: string;
  kind: 'piece' | 'deposit';
  method: OrderMethod;
  status: OrderStatus;
  title: string;
  slug: string | null;
  amountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  checkoutUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  artworkId: string | null;
  leadId: string | null;
  clientId: string | null;
  paidCents: number | null;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  shippingAddress: {line1?: string; line2?: string; city?: string; state?: string; postalCode?: string} | null;
  carrier: string | null;
  tracking: string | null;
  squarePaymentId: string | null;
  conflict: boolean;
  /** Shipping the studio covered under the offer (D-148); absent on older platforms. */
  coveredCents?: number;
  /** Every piece of a cart (D-151); absent on older platforms. */
  items?: {slug: string | null; title: string; priceCents: number; shippingCents: number; coveredCents: number}[];
  createdAt: string;
  updatedAt: string;
}

export const methodLabel = (m: OrderMethod) => (m === 'card' ? 'Card (Square)' : m === 'venmo' ? 'Venmo' : 'Zelle');

/** One short word for where the order stands. */
export function statusLabel(o: Order): string {
  if (o.conflict) return 'Check: refund';
  switch (o.status) {
    case 'pending':
      return 'Paying by card';
    case 'awaiting_payment':
      return 'Waiting for payment';
    case 'paid':
      return o.shippedAt ? 'Shipped' : 'Paid: ship it';
    case 'expired':
      return 'Ran out';
    case 'cancelled':
      return 'Cancelled';
    case 'refunded':
      return 'Refunded';
  }
}

/** Needs the owner now: a payment to watch for, a piece to ship, a refund to make. */
export const needsYou = (o: Order) =>
  o.conflict || o.status === 'awaiting_payment' || (o.status === 'paid' && !o.shippedAt);

export const totalLine = (o: Order) =>
  [
    formatPrice(o.totalCents),
    `(${formatPrice(o.amountCents)}`,
    o.shippingCents ? `+ ${formatPrice(o.shippingCents)} shipping` : '',
    o.taxCents ? `+ ${formatPrice(o.taxCents)} tax` : '',
  ]
    .filter(Boolean)
    .join(' ') +
  ')' +
  (o.coveredCents ? `; you covered ${formatPrice(o.coveredCents)} of shipping` : '');

export const addressLines = (o: Order): string[] => {
  const a = o.shippingAddress;
  if (!a) return [];
  return [
    a.line1,
    a.line2,
    [a.city, [a.state, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  ].filter((x): x is string => !!x && x.trim() !== '');
};

export type OrderAction = 'mark-paid' | 'ship' | 'cancel' | 'extend';
export interface OrderButton {
  action: OrderAction;
  label: string;
  primary?: boolean;
  /** The confirm question; ship asks for the tracking number instead. */
  confirm?: string;
}

/** What the owner can do with this order now. */
export function orderButtons(o: Order): OrderButton[] {
  const manual = o.method !== 'card';
  const total = formatPrice(o.totalCents);
  const how = methodLabel(o.method);
  const out: OrderButton[] = [];
  if (manual && (o.status === 'awaiting_payment' || o.status === 'expired' || o.status === 'cancelled'))
    out.push({
      action: 'mark-paid',
      label: 'Mark paid',
      primary: o.status === 'awaiting_payment',
      confirm: `Did ${total} by ${how} with ${o.code} in the note arrive? This marks “${o.title}” sold and emails the buyer.`,
    });
  if (o.status === 'paid' && !o.shippedAt && !o.conflict)
    out.push({action: 'ship', label: 'Add tracking', primary: true});
  if (manual && o.status === 'awaiting_payment')
    out.push({action: 'extend', label: 'More time', confirm: 'Give them more time to pay? The piece stays set aside.'});
  if (o.status === 'pending' || o.status === 'awaiting_payment')
    out.push({
      action: 'cancel',
      label: 'Cancel order',
      confirm: `Cancel order ${o.code}? “${o.title}” goes back on sale.`,
    });
  return out;
}

export const listOrders = (status: 'open' | 'all') =>
  get<{items: Order[]}>(`/orders?status=${status}`).then(r => r.items);
export const runOrderAction = (o: Order, action: OrderAction, body: Record<string, unknown> = {}) =>
  post<Order>(`/orders/${encodeURIComponent(o.id)}/${action}`, body, o.version);

/** One line per piece when an order holds more than one: "Heron · $500". */
export const itemLines = (o: Order): string[] =>
  (o.items ?? []).length > 1 ? o.items!.map(i => `${i.title} · ${formatPrice(i.priceCents)}`) : [];
