import {statusChips} from '../components/chips';
import {mount} from '../components/mount';
import {picture} from '../components/picture';
import {isDraft} from '../lib/work-logic';
import {listAll} from '../lib/artworks';
import {plainError} from '../lib/artworks';
import type {Params} from '../router';
import type {Artwork} from '../types';
import {confirmDialog, h, toast} from '../ui';
import {publishWork} from '../lib/artworks';
import {get} from '../api';
import {navigate} from '../router';

type Filter = {kind: 'all' | 'drafts' | 'public' | 'sold' | 'site'} | {kind: 'collection'; name: string};
let filter: Filter = {kind: 'all'};

/** Which works a filter shows. */
export const isSitePhoto = (w: Pick<Artwork, 'kind'>) => w.kind === 'site_photo';

/** Which works a filter shows. Site photos only appear under their own chip, never mixed in with the works. */
export function applyFilter(all: Artwork[], f: Filter): Artwork[] {
  if (f.kind === 'site') return all.filter(isSitePhoto);
  const works = all.filter(w => !isSitePhoto(w));
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
  const sitePhotos = works.filter(isSitePhoto);
  const siteDrafts = sitePhotos.filter(isDraft).length;
  if (filter.kind === 'site' && !sitePhotos.length) filter = {kind: 'all'};
  const collections = [
    ...new Set(
      works
        .filter(w => !isSitePhoto(w))
        .map(w => w.collection)
        .filter((c): c is string => !!c),
    ),
  ].sort();
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
      ...(sitePhotos.length ? [pill('Site photos', {kind: 'site'})] : []),
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
          h(
            'span',
            null,
            (drafts === 1 ? '1 draft waiting for you' : `${drafts} drafts waiting for you`) +
              (siteDrafts ? ` (${siteDrafts} site photo${siteDrafts === 1 ? '' : 's'})` : ''),
          ),
          h('strong', null, 'Review →'),
        )
      : null,
    drafts ? approveAllButton(el, _params, works.filter(isDraft)) : null,
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

/**
 * Isaac (2026-11-11): "for this testing phase I need all of the images on the site". One tap approves every draft,
 * each through the same publish as the work's own button, one at a time. Review stays for new work.
 */
function approveAllButton(el: HTMLElement, params: Params, drafts: Artwork[]): HTMLElement {
  const status = h('p', {class: 'muted', 'aria-live': 'polite'});
  const button = h(
    'button',
    {
      type: 'button',
      onclick: async () => {
        const n = drafts.length;
        if (
          !(await confirmDialog(
            `Make all ${n} drafts public? You can unpublish any of them later.`,
            'Approve all',
            'Cancel',
          ))
        )
          return;
        button.setAttribute('disabled', '');
        const failed: string[] = [];
        for (const [i, w] of drafts.entries()) {
          status.textContent = `Approving ${i + 1} of ${n} — ${w.title}`;
          try {
            await publishWork(w.id, w.version);
          } catch {
            failed.push(w.title);
          }
        }
        toast(failed.length ? `${n - failed.length} approved, ${failed.length} could not be` : `All ${n} approved`);
        await render(el, params);
        if (failed.length)
          el.prepend(
            h('p', {class: 'err', role: 'alert'}, `Not approved (open each to see why): ${failed.join(', ')}`),
          );
      },
    },
    `Approve all ${drafts.length} drafts`,
  );
  return h('div', {class: 'row approve-all'}, button, status);
}
