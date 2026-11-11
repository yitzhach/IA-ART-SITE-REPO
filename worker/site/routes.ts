// The public site's addresses. Each page is one file in pages/.
import type {Render} from './page';
import {render as home} from './pages/home';
import {render as works} from './pages/works';
import {render as piece} from './pages/piece';
import {render as commissions} from './pages/commissions';
import {render as process} from './pages/process';
import {render as about} from './pages/about';

const ROUTES: [RegExp, Render][] = [
  [/^\/$/, home],
  [/^\/works$/, works],
  [/^\/works\/(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)$/, piece],
  [/^\/commissions$/, commissions],
  [/^\/process$/, process],
  [/^\/about$/, about],
];

export function match(path: string): {render: Render; params: Record<string, string>} | null {
  const p = path.length > 1 ? path.replace(/\/+$/, '') : path;
  for (const [re, render] of ROUTES) {
    const m = re.exec(p);
    if (m) return {render, params: {...m.groups}};
  }
  return null;
}
