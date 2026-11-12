// The work screen's Collector card (stage 6): Sold to (who owns it, D-164) and First look (D-165). Each change is one
// call; the screen reloads after it so the work's version stays right.
import './collectors.css';
import {plainError} from '../lib/artworks';
import {firstLookState, listCollectors, setFirstLook, setOwner} from '../lib/collectors';
import type {Artwork} from '../types';
import {confirmDialog, h, toast} from '../ui';

const ownerOf = (a: Artwork): string | null =>
  ((a.meta?.sale as {clientId?: string | null} | undefined)?.clientId ?? null) || null;

export function collectorCard(a: Artwork, reload: () => Promise<void>): HTMLElement {
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const fail = (e: unknown) => {
    msg.textContent = plainError(e, "That didn't work. Try again.");
    msg.hidden = false;
  };

  // ---- Sold to
  const owner = ownerOf(a);
  const pick = h('select', {'aria-label': 'Sold to'}, h('option', {value: ''}, 'Loading collectors…'));
  listCollectors().then(
    people => {
      pick.replaceChildren(
        h('option', {value: ''}, owner ? 'Nobody (clear)' : 'Choose a collector…'),
        ...people.map(p =>
          h('option', {value: p.id, selected: p.id === owner}, p.email ? `${p.name} (${p.email})` : p.name),
        ),
      );
    },
    () => pick.replaceChildren(h('option', {value: ''}, 'Couldn’t load collectors')),
  );
  const save = h(
    'button',
    {
      type: 'button',
      onclick: async () => {
        msg.hidden = true;
        const to = pick.value || null;
        if (to === owner) return;
        if (to && a.status !== 'sold' && !(await confirmDialog('Mark this work sold to them?', 'Mark sold'))) return;
        save.setAttribute('disabled', '');
        try {
          await setOwner(a.id, to, a.version);
          toast(to ? 'Saved. It’s in their collection.' : 'Cleared.');
          await reload();
        } catch (e) {
          save.removeAttribute('disabled');
          fail(e);
        }
      },
    },
    'Save',
  );

  // ---- First look
  const state = firstLookState(a.publicFrom);
  const flBtn = h(
    'button',
    {
      type: 'button',
      class: state === 'on' ? '' : 'primary',
      onclick: async () => {
        msg.hidden = true;
        flBtn.setAttribute('disabled', '');
        try {
          await setFirstLook(a.id, state === 'on' ? null : undefined, a.version);
          toast(state === 'on' ? 'First look ended. It’s on your public site.' : 'First look started.');
          await reload();
        } catch (e) {
          flBtn.removeAttribute('disabled');
          fail(e);
        }
      },
    },
    state === 'on' ? 'End first look now' : 'Start first look',
  );
  const flText =
    state === 'on'
      ? `Collectors and followers see it now. It reaches your public site ${new Date(a.publicFrom!).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}.`
      : 'Collectors and followers see it for 7 days before your public site.';

  return h(
    'section',
    {class: 'card'},
    h('h2', null, 'Collectors'),
    h('label', {class: 'field-label'}, 'Sold to'),
    h('div', {class: 'row'}, pick, save),
    a.public && a.status === 'available'
      ? [h('h3', null, 'First look'), h('p', {class: 'muted'}, flText), h('div', {class: 'row'}, flBtn)]
      : null,
    msg,
  );
}
