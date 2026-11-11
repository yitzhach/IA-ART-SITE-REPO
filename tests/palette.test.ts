import {expect, it} from 'vitest';
import {colourWords, readPalette} from '../src/lib/palette';

const fill = (parts: [number[], number][]) => {
  const total = parts.reduce((a, p) => a + p[1], 0);
  const a = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [rgb, n] of parts) for (let k = 0; k < n; k++, i++) a.set([...rgb, 255], i * 4);
  return a;
};

it('finds the dominant colours, sorted, lower-case hex, shares <= 10000', () => {
  const p = readPalette(
    fill([
      [[200, 30, 30], 600],
      [[20, 40, 200], 300],
      [[250, 250, 250], 100],
    ]),
  );
  expect(p.map(s => s.hex)).toEqual(['#c81e1e', '#1428c8', '#fafafa']);
  expect(p[0]!.share).toBe(6000);
  expect(p.reduce((a, s) => a + s.share, 0)).toBeLessThanOrEqual(10000);
});
it('merges near-identical colours and drops tiny ones', () => {
  const p = readPalette(
    fill([
      [[100, 100, 100], 500],
      [[104, 100, 98], 480],
      [[255, 0, 0], 20],
    ]),
  );
  expect(p).toHaveLength(1);
});
it('is deterministic, respects max, handles empty/transparent', () => {
  const px = new Uint8ClampedArray(4096 * 4).map((_, i) => (i * 37) % 256);
  expect(readPalette(px, 3).length).toBeLessThanOrEqual(3);
  expect(readPalette(px)).toEqual(readPalette(px));
  expect(readPalette(new Uint8ClampedArray(0))).toEqual([]);
  expect(readPalette(new Uint8ClampedArray([1, 2, 3, 0]))).toEqual([]);
});
it('colourWords', () => {
  expect(colourWords('#1428c8')).toContain('blue');
  expect(colourWords('#c81e1e')).toContain('warm');
  expect(colourWords('#000000')).toContain('black');
  expect(colourWords('nope')).toEqual([]);
});
