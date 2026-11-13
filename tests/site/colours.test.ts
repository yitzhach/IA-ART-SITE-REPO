import {beforeEach, describe, expect, it} from 'vitest';
import {colourName, colourNames, colourPhrase, NAMED} from '../../worker/site/colours';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

describe('colour names (card D)', () => {
  const table: [string, string][] = [
    ['#000000', 'black'],
    ['#ffffff', 'white'],
    ['#808080', 'grey'],
    ['#a34a24', 'rust'],
    ['#1e3e78', 'deep blue'],
    ['#1b2846', 'navy'],
    ['#f2e8d0', 'cream'],
    ['#c8282d', 'red'],
    ['#2a7d7c', 'teal'],
    ['#3f8f4f', 'green'],
    ['#a5b28b', 'sage'],
    ['#c46440', 'terracotta'],
    ['#6a4227', 'brown'],
    ['#7c4a9d', 'purple'],
    ['#f3d43b', 'yellow'],
    ['#e8a1b1', 'pink'],
  ];
  for (const [hex, name] of table) it(`${hex} → ${name}`, () => expect(colourName(hex)).toBe(name));

  it('every named colour names itself', () => {
    for (const [name, hex] of NAMED) expect(colourName(hex), name).toBe(name);
  });

  it('upper case and spaces are fine; anything else is not a colour', () => {
    expect(colourName(' #A34A24 ')).toBe('rust');
    for (const bad of ['', 'red', '#fff', '#12345g', 'rgb(1,2,3)']) expect(colourName(bad), bad).toBeNull();
  });

  it('top three by share, each name once', () => {
    expect(
      colourNames([
        {hex: '#f2e8d0', share: 1500},
        {hex: '#a34a24', share: 4000},
        {hex: '#a0461f', share: 2000},
        {hex: '#1e3e78', share: 2500},
        {hex: '#000000', share: 900},
      ]),
    ).toEqual(['rust', 'deep blue', 'cream']);
    expect(colourNames([])).toEqual([]);
    expect(colourNames(null)).toEqual([]);
    expect(
      colourNames([
        {hex: 'nope', share: 9000},
        {hex: '#ffffff', share: 100},
      ]),
    ).toEqual(['white']);
  });

  it('said as a list', () => {
    expect(colourPhrase([])).toBeNull();
    expect(colourPhrase(['rust'])).toBe('rust');
    expect(colourPhrase(['rust', 'cream'])).toBe('rust and cream');
    expect(colourPhrase(['rust', 'deep blue', 'cream'])).toBe('rust, deep blue and cream');
  });
});

describe('the piece page says its colours', () => {
  const ld = (text: string) =>
    [...text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]!));

  it('in the facts and as VisualArtwork color', async () => {
    fixture.works[0]!.palette = [
      {hex: '#a34a24', share: 5000},
      {hex: '#1e3e78', share: 3000},
      {hex: '#f2e8d0', share: 2000},
    ];
    const {text} = await get('/works/work-1');
    expect(text).toMatch(/<dt>Colors<\/dt>\s*<dd>rust, deep blue and cream<\/dd>/);
    const art = ld(text).find(o => o['@type'] === 'VisualArtwork');
    expect(art.color).toBe('rust, deep blue, cream');
  });

  it('no palette: no Colors line and no color', async () => {
    fixture.works[0]!.palette = [];
    const {text} = await get('/works/work-1');
    expect(text).not.toContain('<dt>Colors</dt>');
    expect(ld(text).find(o => o['@type'] === 'VisualArtwork').color).toBeUndefined();
  });
});
