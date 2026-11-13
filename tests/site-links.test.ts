// The Links box under Site → Contact (card E, D-176).
import {describe, expect, it} from 'vitest';
import {formatLinks, MAX_LINKS, parseLinks} from '../src/lib/site-logic';

describe('parseLinks', () => {
  it('reads a name, then an address; adds https and turns http into https', () => {
    expect(
      parseLinks(
        'Instagram instagram.com/me\n\nGallery Hall: http://gallery.example/artists/me\n  https://press.example/a  ',
      ),
    ).toEqual({
      links: [
        {label: 'Instagram', url: 'https://instagram.com/me'},
        {label: 'Gallery Hall', url: 'https://gallery.example/artists/me'},
        {label: 'press.example', url: 'https://press.example/a'},
      ],
    });
  });
  it('empty box: no links', () => expect(parseLinks('  \n ')).toEqual({links: []}));
  it('a line without an address says which line', () => {
    expect(parseLinks('Instagram instagram.com/me\nMy gallery')).toEqual({
      error: 'Line 2 needs an address at the end, like instagram.com/yourname.',
    });
    expect('error' in parseLinks('javascript:alert(1)')).toBe(true);
  });
  it(`at most ${MAX_LINKS}`, () => {
    const many = Array.from({length: MAX_LINKS + 1}, (_, i) => `L${i} site${i}.example`).join('\n');
    expect(parseLinks(many)).toEqual({error: `At most ${MAX_LINKS} links.`});
  });
  it('formatLinks reads back the same', () => {
    const links = [{label: 'Instagram', url: 'https://instagram.com/me'}];
    expect(parseLinks(formatLinks(links))).toEqual({links});
    expect(formatLinks(undefined)).toBe('');
  });
});
