import {describe, expect, it} from 'vitest';
import {mergePiece, parseRates, pieceFields, ratesText, settingsFields, settingsFrom} from '../src/lib/shipping-logic';

describe('a piece’s shipping in Studio', () => {
  it('an untouched form is unchanged, key order and all', () => {
    const orig = {pairsWith: ['01ABC'], tier: 3 as const, promo: false};
    expect(JSON.stringify((mergePiece(orig, pieceFields(orig)) as any).value)).toBe(JSON.stringify(orig));
    expect(mergePiece(null, pieceFields(null))).toEqual({value: null});
  });
  it('sets a tier and a pinned price; bad numbers name their field', () => {
    expect(mergePiece(null, {...pieceFields(null), tier: '4', cents: '180'})).toEqual({value: {tier: 4, cents: 18000}});
    expect(mergePiece(null, {...pieceFields(null), cents: 'lots'})).toMatchObject({field: 'cents'});
    expect(mergePiece(null, {...pieceFields(null), weightLb: '900'})).toMatchObject({field: 'weightLb'});
  });
});

describe('the studio’s shipping settings', () => {
  it('defaults are Isaac’s answers', () => {
    expect(settingsFields(undefined)).toMatchObject({
      tier2: '22',
      originZip: '42503',
      padding: '2',
      r2Min: '500',
      r2Percent: '20',
      r2Cap: '',
    });
  });
  it('round-trips and keeps keys the form doesn’t show', () => {
    const orig = {tier2MaxSqIn: 576, r2: {on: true, starts: '2026-12-01', minCents: 50000}};
    const r = settingsFrom(orig, {...settingsFields(orig), r2Percent: '25'});
    expect(r).toMatchObject({value: {tier2MaxSqIn: 576, r2: {starts: '2026-12-01', bps: 2500, capCents: null}}});
  });
  it('the rate grid as text and back', () => {
    const rates = {asOf: '2026-01-01', weights: [1, 2], zones: {'2': [1234, 1310], '3': [1300, 1400]}};
    expect(parseRates(ratesText(rates))).toEqual(rates);
    expect(parseRates('')).toBeNull();
    expect(parseRates('lb 1 2\n2: 1 2')).toBe('bad');
    expect(settingsFrom(undefined, {...settingsFields(undefined), rates: 'nonsense'})).toMatchObject({field: 'rates'});
  });
});
