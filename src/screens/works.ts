import {statusChips} from '../components/chips';
import {mount} from '../components/mount';
import {picture} from '../components/picture';
import {isDraft} from '../lib/work-logic';
import {listAll} from '../lib/artworks';
import {plainError} from '../lib/artworks';
import type {Params} from '../router';
import type {Artwork} from '../types';
import {h} from '../ui';
import {get} from '../api';
import {navigate} from '../router';

type Filter = {kind: 'all' | 'drafts' | 'public' | 'sold'} | {kind: 'collection'; name: string};
let filter: Filter = {kind: 'all'};

/** Which works a filter shows. */
export function applyFilter(works: Artwork[], f: Filter): Artwork[] {
  switch (f.kind) {
    case 'all':
      return works;
    case 'drafts':
      return works.filter(isDraft);
    case 'public':
      return works.filter(w => w.public);
    case 'sold':
      return works.filter(w => w.status === 'sold');
    case 'collection':
      return works.filter(w => w.collection === f.name);
  }
}

function card(w: Artwork): HTMLElement {
  return h(
    'a',
    {class: 'work-card', href: `/studio/works/${encodeURIComponent(w.id)}`},
    picture(w.primaryFileId ? {id: w.primaryFileId, meta: {}} : null, 480, {ratio: '4 / 5', cover: true}),
    h(
      'div',
      {class: 'work-meta'},
      h('div', {class: 'work-title'}, w.title || 'Untitled'),
      h('div', {class: 'chips'}, statusChips(w)),
    ),
  );
}

export async function render(el: HTMLElement, _params: Params): Promise<void> {
  mount(el, h('p', {class: 'muted'}, 'Loading your works…'));
  let works: Artwork[];
  try {
    works = await listAll();
  } catch (e) {
    mount(
      el,
      h(
        'p',
        {class: 'err', role: 'alert'},
        plainError(e, "Couldn't load your works. Check your connection and try again."),
      ),
      h('button', {onclick: () => render(el, _params)}, 'Try again'),
    );
    return;
  }
  if (await shouldStartImport(works)) return navigate('/studio/import?auto=1', true);

  if (!works.length) {
    mount(
      el,
      h('h1', null, 'Works'),
      h(
        'div',
        {class: 'card empty'},
        h('h2', null, 'No works yet'),
        h('p', {class: 'muted'}, 'Add your first piece, or bring in the photos from the current site.'),
        h(
          'div',
          {class: 'row'},
          h('a', {class: 'btn primary', href: '/studio/add'}, 'Add a work'),
          h('a', {class: 'btn', href: '/studio/import'}, "Import the current site's photos"),
        ),
      ),
    );
    return;
  }

  const drafts = works.filter(isDraft).length;
  const collections = [...new Set(works.map(w => w.collection).filter((c): c is string => !!c))].sort();
  if (filter.kind === 'collection' && !collections.includes(filter.name)) filter = {kind: 'all'};
  const grid = h('div', {class: 'grid'});
  const bar = h('div', {class: 'chips filters', role: 'group', 'aria-label': 'Show'});

  const draw = () => {
    const shown = applyFilter(works, filter);
    grid.replaceChildren(...(shown.length ? shown.map(card) : [h('p', {class: 'muted'}, 'Nothing here yet.')]));
    const same = (f: Filter) => JSON.stringify(f) === JSON.stringify(filter);
    const pill = (label: string, f: Filter) =>
      h(
        'button',
        {
          class: 'pill',
          'aria-pressed': same(f) ? 'true' : 'false',
          onclick: () => {
            filter = f;
            draw();
          },
        },
        label,
      );
    bar.replaceChildren(
      pill('All', {kind: 'all'}),
      pill('Drafts', {kind: 'drafts'}),
      pill('Public', {kind: 'public'}),
      pill('Sold', {kind: 'sold'}),
      ...collections.map(name => pill(name, {kind: 'collection', name})),
    );
  };
  draw();

  mount(
    el,
    h('h1', null, 'Works'),
    drafts
      ? h(
          'a',
          {class: 'banner', href: '/studio/review'},
          h('span', null, drafts === 1 ? '1 draft waiting for you' : `${drafts} drafts waiting for you`),
          h('strong', null, 'Review →'),
        )
      : null,
    bar,
    grid,
  );
}

/**
 * The first time the studio opens with none of the current site's photos in, the import starts by itself
 * (Isaac, 2026-11-11). Once a run has been recorded (settings.meta.siteImport) it never starts again on its own,
 * and at most once per visit, so a failed run never loops.
 */
async function shouldStartImport(works: Artwork[]): Promise<boolean> {
  try {
    if (sessionStorage.getItem('studio.importAutoStarted')) return false;
    if (works.some(w => (w.meta as {importedFrom?: unknown} | undefined)?.importedFrom)) return false;
    const s = await get<{meta?: {siteImport?: unknown}}>('/settings');
    if (s.meta?.siteImport) return false;
    sessionStorage.setItem('studio.importAutoStarted', '1');
    return true;
  } catch {
    return false;
  }
}
