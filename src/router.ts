// A tiny router on location.pathname with history.pushState and link interception.
export type Params = Record<string, string>;
export type Render = (el: HTMLElement, params: Params) => void | Promise<void>;
export type Route = {name: string; pattern: string; load: () => Promise<{render: Render}>};

export const routes: Route[] = [
  {name: 'works', pattern: '/studio', load: () => import('./screens/works')},
  {name: 'works', pattern: '/studio/works', load: () => import('./screens/works')},
  {name: 'add', pattern: '/studio/add', load: () => import('./screens/add')},
  {name: 'work', pattern: '/studio/works/:id', load: () => import('./screens/work')},
  {name: 'review', pattern: '/studio/review', load: () => import('./screens/review')},
  {name: 'site', pattern: '/studio/site', load: () => import('./screens/site')},
  {name: 'leads', pattern: '/studio/leads', load: () => import('./screens/leads')},
  {name: 'leads', pattern: '/studio/leads/:id', load: () => import('./screens/leads')},
  {name: 'orders', pattern: '/studio/orders', load: () => import('./screens/orders')},
  {name: 'collectors', pattern: '/studio/collectors', load: () => import('./screens/collectors')},
  {name: 'collectors', pattern: '/studio/collectors/:id', load: () => import('./screens/collectors')},
  {name: 'import', pattern: '/studio/import', load: () => import('./screens/import')},
];

/** Match a pathname against a route table; returns the route and its :params, or null. */
export function match(pathname: string, table: Route[] = routes): {route: Route; params: Params} | null {
  const parts = pathname.replace(/\/+$/, '').split('/');
  for (const route of table) {
    const pat = route.pattern.split('/');
    if (pat.length !== parts.length) continue;
    const params: Params = {};
    const ok = pat.every((p, i) => {
      const part = parts[i] ?? '';
      if (p.startsWith(':')) {
        if (part === '') return false;
        try {
          params[p.slice(1)] = decodeURIComponent(part);
        } catch {
          return false; // malformed %-escape: not a route
        }
        return true;
      }
      return p === part;
    });
    if (ok) return {route, params};
  }
  return null;
}

let onChange: () => void = () => {};

export function navigate(path: string, replace = false): void {
  if (path === location.pathname + location.search) return onChange();
  history[replace ? 'replaceState' : 'pushState'](null, '', path);
  onChange();
}

/** Start routing: calls `change` on every navigation (first load, back/forward, link clicks). */
export function startRouter(change: () => void): void {
  onChange = change;
  addEventListener('popstate', change);
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return;
    if (!a.pathname.startsWith('/studio')) return;
    e.preventDefault();
    navigate(a.pathname + a.search);
  });
  change();
}
