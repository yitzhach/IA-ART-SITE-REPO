import {afterEach, expect, it, vi} from 'vitest';
import {
  countNew,
  heldUntil,
  kindLabel,
  leadButtons,
  leadWho,
  piecesLabel,
  priceLabel,
  runLeadAction,
  smsHref,
  telHref,
  when,
} from '../src/lib/leads';

afterEach(() => vi.unstubAllGlobals());
const base = {
  name: null,
  email: null,
  phone: null,
  works: [{id: 'W', slug: 'heron', title: 'Heron', status: 'available', priceCents: 120000, currency: 'USD'}],
};

it('who: name, else email, else phone', () => {
  expect(leadWho({name: 'Ann', email: 'a@b.c', phone: '1'})).toBe('Ann');
  expect(leadWho({name: ' ', email: 'a@b.c', phone: '1'})).toBe('a@b.c');
  expect(leadWho({name: null, email: null, phone: '+1949'})).toBe('+1949');
  expect(leadWho({name: null, email: null, phone: null})).toBe('Someone');
});
it('labels', () => {
  expect(kindLabel('hold')).toBe('Hold request');
  expect(kindLabel('inquiry')).toBe('Inquiry');
  expect(piecesLabel(1)).toBe('1 piece');
  expect(piecesLabel(3)).toBe('3 pieces');
  expect(priceLabel({priceCents: null})).toBe('Price on request');
  expect(priceLabel({priceCents: 120000})).toBe('$1,200');
});
it('held until only for held leads', () => {
  expect(heldUntil({status: 'new', expiresAt: '2026-11-14T20:00:00Z'})).toBeNull();
  expect(heldUntil({status: 'held', expiresAt: null})).toBeNull();
  expect(heldUntil({status: 'held', expiresAt: '2026-11-14T20:00:00Z'}, 'en-US')).toMatch(/^Held until /);
});
it('date: no year this year', () => {
  const now = new Date('2026-11-12T12:00:00Z');
  expect(when('2026-11-10T12:00:00Z', now, 'en-US')).toBe('Nov 10');
  expect(when('2025-11-10T12:00:00Z', now, 'en-US')).toBe('Nov 10, 2025');
});
it('counts new leads', () => expect(countNew([{status: 'new'}, {status: 'held'}, {status: 'new'}])).toBe(2));
it('contact links keep only digits and +', () => {
  expect(smsHref('(949) 813-5258')).toBe('sms:9498135258');
  expect(telHref('+1 949 813 5258')).toBe('tel:+19498135258');
});

it('buttons by status and kind', () => {
  const b = (status: string, kind: string) =>
    leadButtons({...base, status, kind} as never).map(x => `${x.action}:${x.label}`);
  expect(b('new', 'hold')).toEqual(['approve-hold:Approve hold (48 hours)', 'decline:Decline']);
  expect(b('new', 'inquiry')).toEqual(['close:Done']);
  expect(b('held', 'hold')).toEqual(['decline:Decline (put back on sale)', 'close:Done']);
  expect(b('closed', 'inquiry')).toEqual([]);
  expect(b('declined', 'hold')).toEqual([]);
});
it('the approve confirm says who and for how long', () => {
  const [approve] = leadButtons({...base, name: 'Ann', status: 'new', kind: 'hold'} as never);
  expect(approve!.confirm).toBe('Reserve ‘Heron’ for Ann for 48 hours? It goes back on sale by itself after that.');
});

it('actions POST with If-Match: the version seen', async () => {
  const f = vi.fn(async () => new Response('{"id":"L1","version":4}', {status: 200}));
  vi.stubGlobal('fetch', f);
  for (const a of ['approve-hold', 'decline', 'close'] as const) await runLeadAction({id: 'L1', version: 3}, a);
  const calls = f.mock.calls as unknown as [string, RequestInit][];
  expect(calls.map(c => c[0])).toEqual(['/v1/leads/L1/approve-hold', '/v1/leads/L1/decline', '/v1/leads/L1/close']);
  for (const [, init] of calls) {
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['if-match']).toBe('3');
  }
});
it('a 409 reaches the caller as a conflict', async () => {
  vi.stubGlobal('fetch', async () => new Response('{"error":{"code":"conflict","message":"x"}}', {status: 409}));
  await expect(runLeadAction({id: 'L1', version: 1}, 'close')).rejects.toMatchObject({status: 409});
});
