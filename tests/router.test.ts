import {expect, it} from 'vitest';
import {match} from '../src/router';

it.each([
  ['/studio', 'works'],
  ['/studio/works', 'works'],
  ['/studio/add', 'add'],
  ['/studio/works/01ABC', 'work'],
  ['/studio/review', 'review'],
  ['/studio/import', 'import'],
  ['/studio/site', 'site'],
  ['/studio/leads', 'leads'],
  ['/studio/leads/01ABC', 'leads'],
  ['/studio/', 'works'],
])('matches %s', (path, name) => expect(match(path)?.route.name).toBe(name));
it('extracts :id', () => expect(match('/studio/works/01ABC')?.params).toEqual({id: '01ABC'}));
it('no match', () => expect(match('/nope')).toBeNull());
it('a malformed % escape is no match, not a crash', () => {
  expect(() => match('/studio/works/%E0%A4%A')).not.toThrow();
  expect(match('/studio/works/%E0%A4%A')).toBeNull();
});
