// The photo picker sheet the Site and Shows screens share: site photos first, then works.
import './pick-photos.css';
import {toggleSelection} from '../lib/site-logic';
import type {Artwork} from '../types';
import {h} from '../ui';
import {picture} from './picture';

const titleOf = (a: Artwork) => a.title || 'Untitled';

/** The picker sheet: site photos first, then works. Resolves the chosen ids in order, or null when cancelled. */
export function pickPhotos(
  p: {label: string; multi: boolean},
  start: string[],
  artworks: Artwork[],
  hint?: string,
): Promise<string[] | null> {
  return new Promise(resolve => {
    let sel = start.filter(id => artworks.some(a => a.id === id));
    const sitePhotos = artworks.filter(a => a.kind === 'site_photo' && a.status !== 'archived');
    const works = artworks.filter(a => a.kind !== 'site_photo' && a.status !== 'archived');
    const buttons = new Map<string, {btn: HTMLElement; badge: HTMLElement}>();

    const tile = (a: Artwork) => {
      const badge = h('span', {class: 'pick-badge', 'aria-hidden': 'true'});
      const btn = h(
        'button',
        {
          type: 'button',
          class: 'pick',
          'aria-pressed': 'false',
          onclick: () => {
            sel = toggleSelection(sel, a.id, p.multi);
            refresh();
          },
        },
        a.primaryFileId
          ? picture({id: a.primaryFileId, meta: {}}, 480, {ratio: '1 / 1', cover: true})
          : picture(null, 480, {ratio: '1 / 1'}),
        badge,
        h('span', {class: 'pick-title'}, titleOf(a), a.public ? null : h('small', null, ' · not public')),
      );
      buttons.set(a.id, {btn, badge});
      return btn;
    };
    const group = (heading: string, items: Artwork[]) =>
      items.length ? [h('h3', null, heading), h('div', {class: 'pick-grid'}, items.map(tile))] : [];

    const done = h('button', {type: 'button', class: 'primary', onclick: () => finish(sel)}, 'Done');
    const refresh = () => {
      for (const [id, {btn, badge}] of buttons) {
        const at = sel.indexOf(id);
        btn.setAttribute('aria-pressed', at >= 0 ? 'true' : 'false');
        badge.textContent = at >= 0 ? (p.multi ? String(at + 1) : '✓') : '';
      }
      done.textContent = p.multi ? `Done (${sel.length} chosen)` : 'Done';
    };

    const dlg = h(
      'dialog',
      {class: 'sheet', 'aria-label': `Choose photos for ${p.label}`},
      h(
        'div',
        {class: 'sheet-body'},
        h('h2', null, p.label),
        h(
          'p',
          {class: 'muted'},
          hint ?? (p.multi ? 'Tap the photos in the order you want them.' : 'Tap the photo you want.'),
        ),
        ...group('Site photos', sitePhotos),
        ...group('Works', works),
        !sitePhotos.length && !works.length ? h('p', {class: 'muted'}, 'No photos yet.') : null,
      ),
      h('div', {class: 'sheet-foot row'}, done, h('button', {type: 'button', onclick: () => finish(null)}, 'Cancel')),
    );
    const finish = (v: string[] | null) => {
      dlg.close?.();
      dlg.remove();
      resolve(v);
    };
    dlg.addEventListener('cancel', () => finish(null));
    refresh();
    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute('open', '');
  });
}
