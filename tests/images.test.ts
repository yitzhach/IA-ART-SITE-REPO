import {expect, it} from 'vitest';
import {plannedWidths} from '../src/lib/images';

it('plans all three for a big original', () => {
  expect(plannedWidths(4032).map(p => [p.slot, p.width])).toEqual([
    [480, 480],
    [960, 960],
    [1600, 1600],
  ]);
});
it('never upscales: the largest slot takes the original width', () => {
  expect(plannedWidths(1200).map(p => [p.slot, p.width])).toEqual([
    [480, 480],
    [960, 960],
    [1600, 1200],
  ]);
  expect(plannedWidths(900).map(p => [p.slot, p.width])).toEqual([
    [480, 480],
    [960, 900],
  ]);
});
it('skips identical sizes', () => {
  expect(plannedWidths(300).map(p => [p.slot, p.width])).toEqual([[480, 300]]);
  expect(plannedWidths(960)).toHaveLength(2);
  expect(plannedWidths(0)).toEqual([]);
});
