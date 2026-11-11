import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const vars = (block: string) =>
  Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1]!, m[2]!]));
const light = vars(css.slice(css.indexOf(':root'), css.indexOf('@media (prefers-color-scheme: dark)')));
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const dark = {...light, ...vars(css.slice(darkStart, css.indexOf('* {', darkStart)))};

const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
export const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

// [foreground, background, what it is]
const pairs: [string, string, string][] = [
  ['ink', 'bg', 'text on the page'],
  ['ink', 'card', 'text on a card'],
  ['muted', 'bg', 'quiet text on the page'],
  ['muted', 'card', 'quiet text on a card (chips, hints, empty photos)'],
  ['accent', 'bg', 'rust text on the page'],
  ['accent', 'card', 'rust text on a card (draft chip, missing facts)'],
  ['accent-ink', 'accent', 'text on a rust button'],
  ['bg', 'ink', 'text on a solid chip or selected filter'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast (WCAG AA, 4.5:1)', (_name, t) => {
  it.each(pairs)('%s on %s: %s', (fg, bg) => expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5));
});
