import {describe, expect, it} from 'vitest';
import {DEFAULT_RETURNS, fromFields, toFields} from '../src/lib/checkout-form';
import {addressLines, needsYou, orderButtons, statusLabel, totalLine, type Order} from '../src/lib/orders';

const order = (o: Partial<Order> = {}): Order => ({
  id: '01M7877AD7SXQDW23PZHDH5YS9',
  version: 1,
  code: 'ABC234',
  kind: 'piece',
  method: 'venmo',
  status: 'awaiting_payment',
  title: 'Heron',
  slug: 'heron',
  amountCents: 50000,
  shippingCents: 4000,
  taxCents: 3000,
  totalCents: 57000,
  currency: 'USD',
  checkoutUrl: null,
  expiresAt: '2026-11-14T12:00:00Z',
  paidAt: null,
  shippedAt: null,
  artworkId: null,
  leadId: null,
  clientId: null,
  paidCents: null,
  buyerName: 'Pat',
  buyerEmail: 'pat@b.test',
  buyerPhone: null,
  shippingAddress: {line1: '1 Main St', city: 'Springfield', state: 'IL', postalCode: '62701'},
  carrier: null,
  tracking: null,
  squarePaymentId: null,
  conflict: false,
  createdAt: '2026-11-12T12:00:00Z',
  updatedAt: '2026-11-12T12:00:00Z',
  ...o,
});

describe('orders', () => {
  it('labels and the total line', () => {
    expect(statusLabel(order())).toBe('Waiting for payment');
    expect(statusLabel(order({status: 'paid'}))).toBe('Paid: ship it');
    expect(statusLabel(order({status: 'paid', conflict: true}))).toBe('Check: refund');
    expect(totalLine(order())).toBe('$570 ($500 + $40 shipping + $30 tax)');
    expect(addressLines(order())).toEqual(['1 Main St', 'Springfield, IL 62701']);
    expect(needsYou(order({status: 'paid', shippedAt: '2026-11-13T00:00:00Z'}))).toBe(false);
  });
  it('buttons: Mark paid only by hand; Add tracking once paid; card orders only cancel', () => {
    expect(orderButtons(order()).map(b => b.action)).toEqual(['mark-paid', 'extend', 'cancel']);
    expect(orderButtons(order()).find(b => b.action === 'mark-paid')!.confirm).toContain('$570 by Venmo with ABC234');
    expect(orderButtons(order({status: 'paid'})).map(b => b.action)).toEqual(['ship']);
    expect(orderButtons(order({status: 'paid', conflict: true}))).toEqual([]);
    expect(orderButtons(order({method: 'card', status: 'pending'})).map(b => b.action)).toEqual(['cancel']);
    expect(orderButtons(order({method: 'card', status: 'expired'}))).toEqual([]);
    expect(orderButtons(order({status: 'expired'})).map(b => b.action)).toEqual(['mark-paid']);
  });
});

describe('checkout form', () => {
  it('defaults: off, card on, 36 in, 48 hours, the default returns', () => {
    expect(toFields(undefined)).toMatchObject({
      enabled: false,
      card: true,
      smallMax: '36',
      holdHours: '48',
      returns: DEFAULT_RETURNS,
    });
  });
  it('round-trips dollars, percent and the Venmo @', () => {
    const r = fromFields({
      ...toFields(undefined),
      enabled: true,
      venmo: 'Isaac-Art',
      zelle: 'pay@a.test',
      shipping: '40',
      taxPercent: '6.25',
    });
    expect(r).toEqual({
      value: {
        enabled: true,
        card: true,
        venmo: '@Isaac-Art',
        zelle: 'pay@a.test',
        shippingCents: 4000,
        smallMaxInches: 36,
        taxBps: 625,
        manualHoldHours: 48,
        returns: DEFAULT_RETURNS,
      },
    });
    expect(toFields((r as {value: never}).value)).toMatchObject({
      shipping: '40',
      taxPercent: '6.25',
      venmo: '@Isaac-Art',
    });
  });
  it('refuses bad numbers with the field to point at', () => {
    expect(fromFields({...toFields(undefined), shipping: 'forty'})).toMatchObject({field: 'shipping'});
    expect(fromFields({...toFields(undefined), taxPercent: '30'})).toMatchObject({field: 'taxPercent'});
    expect(fromFields({...toFields(undefined), venmo: 'a b'})).toMatchObject({field: 'venmo'});
    expect(fromFields({...toFields(undefined), holdHours: '0'})).toMatchObject({field: 'holdHours'});
  });
});
