import {describe, expect, it} from 'vitest';
import {coverPalette} from '../src/lib/cover-palette';

const solid = (r: number, g: number, b: number, n = 100) =>
  new Uint8ClampedArray(Array.from({length: n}, () => [r, g, b, 255]).flat());

describe('palette of a stored picture', () => {
  it('reads the colours of the new cover', async () => {
    const p = await coverPalette('F2', {url: async id => '/p/' + id, pixels: async () => solid(200, 40, 40)});
    expect(p?.[0]?.hex).toBe('#c82828');
  });
  it('asks for the 480 px picture of that file', async () => {
    const seen: string[] = [];
    await coverPalette('F9', {
      url: async id => (seen.push(id), '/p'),
      pixels: async () => solid(1, 2, 3),
    });
    expect(seen).toEqual(['F9']);
  });
  it('is null when the picture cannot be read, so the old colours stay', async () => {
    expect(
      await coverPalette('F', {
        url: async () => '/p',
        pixels: async () => {
          throw new Error('offline');
        },
      }),
    ).toBeNull();
  });
});
