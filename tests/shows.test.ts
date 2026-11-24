// The Studio's Shows screen helpers (D-182): page defaults that match studio-api, sorting and the form's checks.
import {describe, expect, it} from 'vitest';
import {changedShowFields, pageOf, readShowFields, shortDates, showSlug, sortShows} from '../src/lib/shows';

const typed = (o: Partial<Record<'name' | 'venue' | 'city' | 'startsOn' | 'endsOn' | 'booth', string>> = {}) => ({
  name: 'Red Dot Miami',
  venue: ' Mana Wynwood ',
  city: 'Miami',
  startsOn: '2026-12-02',
  endsOn: '2026-12-06',
  booth: '',
  ...o,
});

describe('show page defaults', () => {
  it('gives the same address studio-api does: the name and the year', () => {
    expect(showSlug('Red Dot Miami', '2026-12-02')).toBe('red-dot-miami-2026');
    expect(showSlug('Spring Market 2020', '2020-04-10')).toBe('spring-market-2020');
    expect(showSlug('Café Fête!', null)).toBe('cafe-fete');
    expect(showSlug('!!!', null)).toBe('show');
  });

  it('reads a show with no page as not published, with the default address', () => {
    expect(pageOf({name: 'Red Dot Miami', startsOn: '2026-12-02', meta: {}})).toEqual({
      published: false,
      slug: 'red-dot-miami-2026',
      description: null,
      photos: [],
    });
    const page = {published: true, slug: 'red-dot', description: 'Hi', photos: ['p1']};
    expect(pageOf({name: 'Red Dot Miami', startsOn: '2026-12-02', meta: {publicPage: page}})).toEqual(page);
  });
});

describe('the list', () => {
  it('puts coming shows first, soonest first, then past ones, latest first', () => {
    const s = (name: string, startsOn: string | null, endsOn: string | null = null) => ({name, startsOn, endsOn});
    const out = sortShows(
      [
        s('Old', '2025-03-01'),
        s('Next', '2026-12-02', '2026-12-06'),
        s('Later', '2027-02-01'),
        s('Undated', null),
        s('Last month', '2026-10-01'),
      ],
      '2026-11-24',
    );
    expect(out.map(x => x.name)).toEqual(['Next', 'Later', 'Last month', 'Old', 'Undated']);
  });

  it('a show on now still counts as coming up', () => {
    const out = sortShows([{name: 'On now', startsOn: '2026-11-20', endsOn: '2026-11-26'}], '2026-11-24');
    expect(out).toHaveLength(1);
  });

  it('writes dates short', () => {
    expect(shortDates('2026-12-02', '2026-12-06')).toBe('Dec 2 – Dec 6, 2026');
    expect(shortDates('2026-12-30', '2027-01-02')).toBe('Dec 30, 2026 – Jan 2, 2027');
    expect(shortDates('2026-12-02', null)).toBe('Dec 2, 2026');
    expect(shortDates(null, null)).toBe('No dates yet');
  });
});

describe('the form', () => {
  it('trims what was typed and leaves blanks as nothing', () => {
    expect(readShowFields(typed())).toEqual({
      ok: true,
      fields: {
        name: 'Red Dot Miami',
        venue: 'Mana Wynwood',
        city: 'Miami',
        startsOn: '2026-12-02',
        endsOn: '2026-12-06',
        booth: null,
      },
    });
  });

  it('needs a name, and a last day on or after the first', () => {
    expect(readShowFields(typed({name: '  '}))).toMatchObject({ok: false, field: 'name'});
    expect(readShowFields(typed({endsOn: '2026-12-01'}))).toMatchObject({ok: false, field: 'endsOn'});
    expect(readShowFields(typed({startsOn: '12/02/2026'}))).toMatchObject({ok: false, field: 'startsOn'});
  });

  it('sends only the fields that changed', () => {
    const before = {
      name: 'Red Dot Miami',
      venue: null,
      city: 'Miami',
      startsOn: '2026-12-02',
      endsOn: null,
      booth: null,
    };
    expect(changedShowFields(before, {...before, booth: 'A14', venue: null})).toEqual({booth: 'A14'});
    expect(changedShowFields(before, before)).toEqual({});
  });
});
