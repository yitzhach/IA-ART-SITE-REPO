import {describe, expect, it} from 'vitest';
import {
  addTags,
  centsToDollars,
  changedFields,
  formatPrice,
  formatSize,
  isDraft,
  missingFacts,
  missingText,
  parseDollars,
  parseNumber,
  parseYear,
  removeTag,
} from '../src/lib/work-logic';
import {applyFilter} from '../src/screens/works';
import {draftQueue} from '../src/screens/review';
import type {Artwork} from '../src/types';

describe('dollars and cents', () => {
  it.each([
    ['1200', 120000],
    ['1,200.50', 120050],
    ['$80', 8000],
    ['0.1', 10],
    ['19.99', 1999],
    ['.5', 50],
    ['', null],
    ['  ', null],
    ['abc', undefined],
    ['12.345', undefined],
    ['-5', undefined],
  ])('parses %j', (text, cents) => expect(parseDollars(text)).toBe(cents));
  it('avoids float drift', () => expect(parseDollars('1.15')).toBe(115));
  it('shows cents as dollars', () => {
    expect(centsToDollars(120000)).toBe('1200');
    expect(centsToDollars(120050)).toBe('1200.50');
    expect(centsToDollars(5)).toBe('0.05');
    expect(centsToDollars(null)).toBe('');
    expect(formatPrice(120050)).toBe('$1,200.50');
    expect(formatPrice(1234500)).toBe('$12,345');
  });
});

describe('numbers', () => {
  it('numbers', () => {
    expect(parseNumber('24.5')).toBe(24.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('x')).toBeUndefined();
    expect(parseYear('2024')).toBe(2024);
    expect(parseYear('24')).toBeUndefined();
    expect(parseYear('')).toBeNull();
  });
});

describe('size', () => {
  it('formats what is known', () => {
    expect(formatSize({width: 24, height: 36, depth: null, sizeUnit: 'in'})).toBe('24 × 36 in');
    expect(formatSize({width: 24, height: 36, depth: 2, sizeUnit: 'cm'})).toBe('24 × 36 × 2 cm');
    expect(formatSize({width: null, height: null, depth: null, sizeUnit: 'in'})).toBe('');
  });
});

describe('missing facts', () => {
  const base = {width: 10, height: 10, priceCents: 5000, status: 'available' as const};
  it('nothing missing', () => expect(missingFacts(base)).toEqual([]));
  it('size and price', () => {
    const m = missingFacts({...base, width: null, height: null, priceCents: null});
    expect(m).toEqual(['size', 'price']);
    expect(missingText(m)).toBe('Missing: size, price');
  });
  it('no price needed when not for sale', () =>
    expect(missingFacts({...base, priceCents: null, status: 'not_for_sale'})).toEqual([]));
  it('says nothing when complete', () => expect(missingText([])).toBe(''));
});

describe('tags', () => {
  it('adds lower case, trimmed, no repeats', () =>
    expect(addTags(['blue'], ' Blue, Red ,  deep  sea ,')).toEqual(['blue', 'red', 'deep sea']));
  it('stops at 20', () => {
    const many = Array.from({length: 25}, (_, i) => 't' + i).join(',');
    expect(addTags([], many)).toHaveLength(20);
  });
  it('removes', () => expect(removeTag(['a', 'b'], 'a')).toEqual(['b']));
});

describe('changed fields', () => {
  const before = {title: 'A', tags: ['x', 'y'], priceCents: null as number | null, year: 2020 as number | null};
  it('only what differs', () =>
    expect(changedFields(before, {title: 'A', tags: ['x', 'y'], priceCents: 100, year: 2020})).toEqual({
      priceCents: 100,
    }));
  it('arrays by value, order matters', () => {
    expect(changedFields(before, {tags: ['y', 'x']})).toEqual({tags: ['y', 'x']});
    expect(changedFields(before, {tags: ['x', 'y']})).toEqual({});
  });
  it('can clear a field to null', () => expect(changedFields(before, {year: null})).toEqual({year: null}));
  it('nothing changed is empty', () => expect(changedFields(before, {title: 'A'})).toEqual({}));
});

describe('filters and queue', () => {
  const w = (id: string, o: Partial<Artwork>) =>
    ({id, public: false, status: 'available', collection: null, createdAt: id, ...o}) as Artwork;
  const works = [w('3', {public: true, status: 'sold'}), w('2', {collection: 'Abstract'}), w('1', {public: true})];
  it('filters', () => {
    expect(applyFilter(works, {kind: 'drafts'}).map(x => x.id)).toEqual(['2']);
    expect(applyFilter(works, {kind: 'public'}).map(x => x.id)).toEqual(['3', '1']);
    expect(applyFilter(works, {kind: 'sold'}).map(x => x.id)).toEqual(['3']);
    expect(applyFilter(works, {kind: 'collection', name: 'Abstract'}).map(x => x.id)).toEqual(['2']);
    expect(applyFilter(works, {kind: 'all'})).toHaveLength(3);
  });
  it('review goes oldest first, drafts only', () =>
    expect(draftQueue([w('b', {}), w('a', {}), w('c', {public: true})]).map(x => x.id)).toEqual(['a', 'b']));
});

describe('drafts', () => {
  it('not public and not archived', () => {
    expect(isDraft({public: false, status: 'available'})).toBe(true);
    expect(isDraft({public: true, status: 'available'})).toBe(false);
    expect(isDraft({public: false, status: 'archived'})).toBe(false);
  });
  it('the review queue skips archived works', () =>
    expect(
      draftQueue([
        {id: 'a', public: false, status: 'archived', createdAt: '1'},
        {id: 'b', public: false, status: 'sold', createdAt: '2'},
      ]).map(x => x.id),
    ).toEqual(['b']));
});
