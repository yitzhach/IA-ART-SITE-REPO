import {INVALID, priceField, sizeField, statusField, textField, yearField} from '../components/fields';
import {markDrafting, requestDraft} from '../lib/assistant';
import {changedFields} from '../lib/work-logic';
import {createWork, plainError, updateWork} from '../lib/artworks';
import {prepareImage} from '../lib/images';
import {attachToArtwork, uploadPrepared} from '../lib/upload';
import type {Params} from '../router';
import {navigate} from '../router';
import type {Artwork, ArtworkInput} from '../types';
import {h, toast} from '../ui';

interface Picked {
  file: File;
  url: string;
  /** Uploaded and attached: never uploaded again. */
  done: boolean;
  fileId?: string;
  palette?: {hex: string; share: number}[];
}

export function render(el: HTMLElement, _params: Params): void {
  const picked: Picked[] = [];
  let created: Artwork | null = null; // kept across retries so a second try never makes a second work
  let coverSet = false;
  let saving = false;

  const input = h('input', {type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden', id: 'photos'});
  const thumbs = h('div', {class: 'thumbs'});
  const title = textField('Title', '', {required: true});
  const size = sizeField({width: null, height: null, depth: null, sizeUnit: 'in'});
  const medium = textField('Medium', '', {placeholder: 'e.g. Oil on canvas'});
  const year = yearField(null);
  const price = priceField(null);
  const status = statusField('available');
  const progress = h('p', {class: 'progress', role: 'status', 'aria-live': 'polite', hidden: true});
  const problem = h('p', {class: 'err', role: 'alert', hidden: true});
  const save = h('button', {class: 'primary wide', type: 'submit'}, 'Save');

  const drawThumbs = () => {
    thumbs.replaceChildren(
      ...picked.map((p, i) =>
        h(
          'div',
          {class: 'thumb'},
          h('img', {src: p.url, alt: `Photo ${i + 1}`}),
          i === 0 ? h('span', {class: 'cover-tag'}, 'Cover') : null,
          h(
            'button',
            {
              type: 'button',
              class: 'thumb-x',
              'aria-label': `Remove photo ${i + 1}`,
              disabled: saving || p.done,
              onclick: () => {
                URL.revokeObjectURL(p.url);
                picked.splice(i, 1);
                drawThumbs();
              },
            },
            '×',
          ),
        ),
      ),
    );
  };
  input.addEventListener('change', () => {
    for (const file of Array.from(input.files ?? [])) picked.push({file, url: URL.createObjectURL(file), done: false});
    input.value = '';
    drawThumbs();
  });

  const say = (msg: string) => {
    progress.textContent = msg;
    progress.hidden = !msg;
  };
  const fail = (msg: string) => {
    problem.textContent = msg;
    problem.hidden = false;
  };

  async function onSave(ev: Event) {
    ev.preventDefault();
    if (saving) return;
    problem.hidden = true;
    const t = title.read();
    const w = size.read();
    const y = year.read();
    const p = price.read();
    if (t === INVALID) return title.focus();
    if (w === INVALID) return size.focus();
    if (y === INVALID) return year.focus();
    if (p === INVALID) return price.focus();
    saving = true;
    save.disabled = true;
    drawThumbs();
    try {
      const form: Partial<ArtworkInput> = {
        title: t,
        status: status.read() as Artwork['status'],
        medium: (medium.read() as string) || '',
        year: y,
        width: w.width,
        height: w.height,
        depth: w.depth,
        sizeUnit: w.sizeUnit,
        priceCents: p,
      };
      if (!created) {
        const body: Partial<ArtworkInput> = {title: t, status: form.status, sizeUnit: w.sizeUnit};
        if (form.medium) body.medium = form.medium;
        if (y !== null) body.year = y;
        if (w.width !== null) body.width = w.width;
        if (w.height !== null) body.height = w.height;
        if (w.depth !== null) body.depth = w.depth;
        if (p !== null) {
          body.priceCents = p;
          body.currency = 'USD';
        }
        say('Saving the work…');
        try {
          created = await createWork(body);
        } catch (e) {
          throw new Failure(
            `The work wasn't saved. ${plainError(e, 'Try again in a moment.')} What you typed is still here.`,
          );
        }
      } else {
        // A retry: what was typed since the first try goes onto the work that already exists.
        const edits = changedFields(created as unknown as Partial<ArtworkInput>, form);
        if (Object.keys(edits).length) {
          try {
            created = await updateWork(created.id, edits, created.version);
          } catch (e) {
            throw new Failure(
              `Your changes weren't saved. ${plainError(e, 'Try again in a moment.')} What you typed is still here.`,
            );
          }
        }
      }
      const work = created;
      /** The cover is its own step, so a failure here never makes a photo upload twice. */
      const setCover = async () => {
        const first = picked[0];
        if (coverSet || !first?.done || !first.fileId) return;
        try {
          created = await updateWork(
            work.id,
            {primaryFileId: first.fileId, palette: first.palette ?? []},
            created!.version,
          );
          coverSet = true;
        } catch (e) {
          throw new Failure(
            `The photos are saved, but the cover couldn't be set. ${plainError(e, 'Check your connection.')} Tap Save to try again.`,
          );
        }
      };
      await setCover();
      const todo = picked.filter(x => !x.done);
      for (const item of todo) {
        const n = picked.indexOf(item) + 1;
        const total = picked.length;
        try {
          say(`Preparing photo ${n} of ${total}`);
          const prepared = await prepareImage(item.file, item.file.name || `photo-${n}.jpg`);
          say(`Uploading photo ${n} of ${total}…`);
          const rec = await uploadPrepared(prepared, 'photo', (d, tot) =>
            say(`Uploading photo ${n} of ${total}… ${Math.round((d / tot) * 100)}%`),
          );
          await attachToArtwork(rec.id, work.id);
          item.fileId = rec.id;
          item.palette = prepared.palette;
          item.done = true;
        } catch (e) {
          throw new Failure(
            `Photo ${n} didn't make it. ${plainError(e, 'Check your connection.')} The work is saved as a draft and what you typed is still here. Tap Save to try again.`,
          );
        }
        await setCover();
      }
      say('');
      if (picked.length) {
        const r = await requestDraft(work.id);
        if (r === 'started') markDrafting(work.id, null);
        else if (r === 'unavailable') toast("The assistant isn't available here yet.");
        else toast("The assistant couldn't start a draft. You can ask again from the work.");
      }
      picked.forEach(x => URL.revokeObjectURL(x.url));
      navigate(`/studio/works/${encodeURIComponent(work.id)}`);
    } catch (e) {
      say('');
      fail(e instanceof Failure ? e.message : plainError(e, 'Something went wrong. Try again.'));
      saving = false;
      save.disabled = false;
      drawThumbs();
    }
  }

  el.replaceChildren(
    h('h1', null, 'Add a work'),
    h(
      'form',
      {onsubmit: onSave, novalidate: true},
      h(
        'div',
        {class: 'card'},
        h('label', {class: 'btn primary big', for: 'photos'}, 'Take or choose photos'),
        input,
        thumbs,
        h('p', {class: 'hint'}, 'The first photo is the cover. You can add more later.'),
      ),
      h(
        'div',
        {class: 'card'},
        title.el,
        h('h2', {class: 'sub'}, 'If you know them'),
        size.el,
        medium.el,
        year.el,
        price.el,
        status.el,
      ),
      progress,
      problem,
      h('div', {class: 'row'}, save),
    ),
  );
}

class Failure extends Error {}
