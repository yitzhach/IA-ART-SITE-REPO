// The public site's addresses. Each page is one file in pages/.
import type {Render} from './page';
import {render as home} from './pages/home';
import {render as works} from './pages/works';
import {render as piece} from './pages/piece';
import {render as commissions} from './pages/commissions';
import {render as process} from './pages/process';
import {render as about} from './pages/about';
import {render as ask} from './pages/ask';
import {render as inquiry} from './pages/inquiry';
import {render as contact} from './pages/contact';
import {render as made} from './pages/made';
import {render as buy} from './pages/buy';
import {render as thanks} from './pages/thanks';

/** `dynamic` pages answer from the request (a query, a token) and are never kept by the edge cache. */
const ROUTES: [RegExp, Render, boolean?][] = [
  [/^\/$/, home],
  [/^\/works$/, works],
  [/^\/works\/(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)$/, piece],
  [/^\/commissions$/, commissions],
  [/^\/process$/, process],
  [/^\/about$/, about],
  [/^\/ask$/, ask, true],
  [/^\/inquiry$/, inquiry],
  [/^\/contact$/, contact, true],
  [/^\/p\/(?<token>[A-Za-z0-9_-]{6,80})$/, made, true],
  [/^\/buy\/(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)$/, buy, true],
  [/^\/thanks\/(?<id>[0-9A-HJKMNP-TV-Z]{26})$/, thanks, true],
];

export function match(path: string): {render: Render; params: Record<string, string>; dynamic: boolean} | null {
  const p = path.length > 1 ? path.replace(/\/+$/, '') : path;
  for (const [re, render, dynamic] of ROUTES) {
    const m = re.exec(p);
    if (m) return {render, params: {...m.groups}, dynamic: !!dynamic};
  }
  return null;
}
