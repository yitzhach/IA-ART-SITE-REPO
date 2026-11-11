import {
  INVALID,
  collectionField,
  markDrafted,
  numberField,
  priceField,
  sizeField,
  statusField,
  tagField,
  textField,
  yearField,
} from '../components/fields';
import {statusChips} from '../components/chips';
import {mount} from '../components/mount';
import {picture} from '../components/picture';
import {actionToast} from '../components/toast';
import {del} from '../api';
import {draftAt, draftingNow, markDrafting, requestDraft, waitForDraft} from '../lib/assistant';
import {
  getWork,
  isConflict,
  CONFLICT_MESSAGE,
  listCollections,
  plainError,
  publishWork,
  reorderPictures,
  restoreWork,
  setAltText,
  unpublishWork,
  updateWork,
} from '../lib/artworks';
import {coverPalette} from '../lib/cover-palette';
import {prepareImage} from '../lib/images';
import {pictureUrl} from '../lib/pictures';
import {attachToArtwork, uploadPrepared} from '../lib/upload';
import {changedFields, plainDate} from '../lib/work-logic';
import type {Params} from '../router';
import {navigate} from '../router';
import type {ArtworkDetail, ArtworkInput} from '../types';
import {confirmDialog, h, toast} from '../ui';

/** The editable facts of a work, shaped like the PATCH body, for comparing before and after. */
export const editable = (a: ArtworkDetail): Partial<ArtworkInput> => ({
  title: a.title,
  description: a.description,
  collection: a.collection,
  tags: a.tags,
  medium: a.medium,
  year: a.year,
  width: a.width,
  height: a.height,
  depth: a.depth,
  sizeUnit: a.sizeUnit,
  priceCents: a.priceCents,
  status: a.status,
  editionSize: a.editionSize,
  ...(a.public ? {slug: a.slug ?? ''} : {}),
});

export async function render(el: HTMLElement, params: Params): Promise<void> {
  const id = params.id ?? '';
  let watching = false;
  let busy = false;
  let notice = '';
  /** The latest drawn screen: late callbacks read this, never an old draw's closures. */
  let current: {pending: () => {art: Partial<ArtworkInput>; alt: boolean} | null} | null = null;

  async function show(art?: ArtworkDetail): Promise<void> {
    if (!el.isConnected && art) return;
    let a: ArtworkDetail;
    let collections: string[] = [];
    try {
      [a, collections] = await Promise.all([art ? Promise.resolve(art) : getWork(id), listCollections()]);
    } catch (e) {
      mount(
        el,
        h('p', {class: 'err', role: 'alert'}, plainError(e, "Couldn't open this work. It may have been deleted.")),
        h('a', {href: '/studio/works'}, 'Back to Works'),
      );
      return;
    }
    draw(a, collections);
  }

  function draw(art: ArtworkDetail, collections: string[]) {
    // `a` and `cover` follow the server after a partial save, so a retry uses the right versions.
    let a = art;
    let cover = a.images[0] ?? null;
    const others = a.images.slice(1);
    const drafted = new Set<string>(a.draftedFields ?? []);

    // ---- fields
    const title = textField('Title', a.title, {required: true});
    const description = textField('Description', a.description, {multiline: true, rows: 6});
    const collection = collectionField(a.collection, collections);
    const tags = tagField(a.tags);
    const alt = textField('Photo description (for people who can’t see it)', cover?.altText ?? '', {
      multiline: true,
      rows: 3,
    });
    const medium = textField('Medium', a.medium, {placeholder: 'e.g. Oil on canvas'});
    const year = yearField(a.year);
    const size = sizeField({width: a.width, height: a.height, depth: a.depth, sizeUnit: a.sizeUnit});
    const price = priceField(a.priceCents);
    const status = statusField(a.status);
    const edition = numberField('Edition size', a.editionSize, 'Leave blank for a one-of-a-kind original.');
    const slug = textField('Web address', a.slug ?? '', {hint: 'Changing it breaks links people already have.'});
    if (drafted.has('description')) markDrafted(description);
    if (drafted.has('collection')) markDrafted(collection);
    if (drafted.has('tags')) markDrafted(tags);
    if (drafted.has('altText')) markDrafted(alt);

    /** Reads every field; null if one is not usable. */
    const readAll = (focus = true): {art: Partial<ArtworkInput>; alt: string} | null => {
      const t = title.read(),
        d = description.read(),
        c = collection.read(),
        tg = tags.read(),
        m = medium.read(),
        y = year.read(),
        s = size.read(),
        p = price.read(),
        st = status.read(),
        e = edition.read(),
        sl = a.public ? slug.read() : '',
        al = alt.read();
      const checks: [unknown, {focus(): void}][] = [
        [t, title],
        [y, year],
        [s, size],
        [p, price],
        [e, edition],
      ];
      for (const [v, f] of checks) {
        if (v === INVALID) {
          if (focus && el.isConnected) f.focus();
          return null;
        }
      }
      const sz = s as Exclude<typeof s, typeof INVALID>;
      return {
        art: {
          title: t as string,
          description: d as string,
          collection: c as string | null,
          tags: tg as string[],
          medium: m as string,
          year: y as number | null,
          width: sz.width,
          height: sz.height,
          depth: sz.depth,
          sizeUnit: sz.sizeUnit,
          priceCents: p as number | null,
          status: st as ArtworkInput['status'],
          editionSize: e as number | null,
          ...(a.public ? {slug: sl as string} : {}),
        },
        alt: al as string,
      };
    };

    const pending = (focus = true) => {
      const r = readAll(focus);
      if (!r) return null;
      return {
        art: changedFields(editable(a), r.art),
        alt: cover ? r.alt !== (cover.altText ?? '') : false,
        altText: r.alt,
      };
    };

    /** Saves what changed. Returns the fresh work, or null if it did not work (the message is shown). */
    async function saveEdits(): Promise<ArtworkDetail | null | 'invalid'> {
      const p = pending();
      if (!p) return 'invalid';
      try {
        if (Object.keys(p.art).length) await updateWork(a.id, p.art, a.version);
        if (p.alt && cover) await setAltText(cover, p.altText);
        const fresh = await getWork(id);
        follow(fresh);
        return fresh;
      } catch (e) {
        if (isConflict(e)) {
          notice = CONFLICT_MESSAGE;
          await show();
          return null;
        }
        await refresh(); // part of it may have been saved: keep the versions current
        problem.textContent = plainError(e, "Your changes weren't saved. Try again.");
        problem.hidden = false;
        return null;
      }
    }

    function follow(fresh: ArtworkDetail) {
      a = fresh;
      cover = fresh.images[0] ?? null;
    }
    async function refresh() {
      try {
        follow(await getWork(id));
      } catch {
        // offline: the retry will say so
      }
    }

    const run = async (fn: () => Promise<void>) => {
      if (busy) return;
      busy = true;
      problem.hidden = true;
      el.querySelectorAll<HTMLButtonElement>('button.act').forEach(b => (b.disabled = true));
      try {
        await fn();
      } finally {
        busy = false;
        el.querySelectorAll<HTMLButtonElement>('button.act').forEach(b => (b.disabled = false));
      }
    };

    const problem = h('p', {class: 'err', role: 'alert', hidden: true});

    const onSave = (ev: Event) => {
      ev.preventDefault();
      void run(async () => {
        const fresh = await saveEdits();
        if (fresh === 'invalid' || !fresh) return;
        toast('Saved.');
        await show(fresh);
      });
    };

    const onPublish = () =>
      void run(async () => {
        const fresh = await saveEdits();
        if (fresh === 'invalid' || !fresh) return;
        try {
          await publishWork(fresh.id, fresh.version);
        } catch (e) {
          problem.textContent = plainError(e, "This work couldn't be published. Try again.");
          problem.hidden = isConflict(e);
          if (!isConflict(e)) await refresh();
          if (isConflict(e)) {
            notice = CONFLICT_MESSAGE;
            await show();
          }
          return;
        }
        toast('Published. This work is now public.');
        await show();
      });

    const onUnpublish = () =>
      void run(async () => {
        try {
          await unpublishWork(a.id, a.version);
        } catch (e) {
          if (isConflict(e)) {
            notice = CONFLICT_MESSAGE;
            return show();
          }
          problem.textContent = plainError(e, "This work couldn't be made private. Try again.");
          problem.hidden = false;
          return;
        }
        toast('This work is private again.');
        await show();
      });

    const onRedo = () =>
      void run(async () => {
        const since = draftAt(a);
        const r = await requestDraft(a.id);
        if (r === 'unavailable') return toast("The assistant isn't available here yet.");
        if (r === 'failed') return toast("The assistant couldn't start a new draft. Try again in a moment.");
        markDrafting(a.id, since);
        await show();
      });

    const onDelete = () =>
      void run(async () => {
        if (!(await confirmDialog(`Delete “${a.title || 'this work'}”? You can undo it right afterwards.`, 'Delete')))
          return;
        try {
          await del(`/artworks/${encodeURIComponent(a.id)}`, a.version);
        } catch (e) {
          if (isConflict(e)) {
            notice = CONFLICT_MESSAGE;
            return show();
          }
          problem.textContent = plainError(e, "This work couldn't be deleted. Try again.");
          problem.hidden = false;
          return;
        }
        navigate('/studio/works');
        actionToast('Deleted.', 'Undo', () => {
          restoreWork(a.id).then(
            () => {
              toast('Restored.');
              navigate(`/studio/works/${encodeURIComponent(a.id)}`);
            },
            e => toast(plainError(e, "Couldn't undo the delete.")),
          );
        });
      });

    // ---- pictures
    const lightbox = () => {
      if (!cover) return;
      const img = h('img', {alt: cover.altText ?? a.title, class: 'lightbox-img'});
      pictureUrl(cover.id, 1600).then(
        u => (img.src = u),
        () => dlg.append(h('p', null, 'Photo not available')),
      );
      const dlg = h(
        'dialog',
        {class: 'lightbox', onclick: () => (dlg.close?.(), dlg.remove())},
        img,
        h('button', {class: 'lightbox-close', 'aria-label': 'Close'}, '×'),
      );
      document.body.appendChild(dlg);
      dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
    };

    const makeCover = (fileId: string) =>
      void run(async () => {
        const ids = [fileId, ...a.images.map(i => i.id).filter(i => i !== fileId)];
        await reorder(ids);
      });
    async function reorder(ids: string[]) {
      try {
        const oldCover = a.images[0]?.id;
        await reorderPictures(a.id, ids);
        let fresh = await getWork(id);
        const newCover = fresh.images[0];
        const changes: Partial<ArtworkInput> = {};
        if (newCover && fresh.primaryFileId !== newCover.id) changes.primaryFileId = newCover.id;
        if (newCover && newCover.id !== oldCover) {
          const palette = await coverPalette(newCover.id); // null: keep the old colours quietly
          if (palette) changes.palette = palette;
        }
        if (Object.keys(changes).length) {
          await updateWork(fresh.id, changes, fresh.version);
          fresh = await getWork(id);
        }
        await show(fresh);
      } catch (e) {
        problem.textContent = plainError(e, "The photos couldn't be reordered. Try again.");
        problem.hidden = false;
      }
    }

    let dragFrom = -1;
    const row = h(
      'div',
      {class: 'strip'},
      others.map((f, i) =>
        h(
          'div',
          {
            class: 'strip-item',
            draggable: 'true',
            ondragstart: () => (dragFrom = i),
            ondragover: (ev: Event) => ev.preventDefault(),
            ondrop: (ev: Event) => {
              ev.preventDefault();
              if (dragFrom < 0 || dragFrom === i) return;
              const next = [...others];
              const [moved] = next.splice(dragFrom, 1);
              next.splice(i, 0, moved!);
              dragFrom = -1;
              void run(() => reorder([cover!.id, ...next.map(n => n.id)]));
            },
          },
          picture(f, 480, {ratio: '1 / 1', cover: true, alt: f.altText ?? `Photo ${i + 2}`}),
          h('button', {type: 'button', class: 'act small', onclick: () => makeCover(f.id)}, 'Make cover'),
        ),
      ),
    );

    const addInput = h('input', {
      type: 'file',
      accept: 'image/*',
      multiple: true,
      class: 'visually-hidden',
      id: 'more-photos',
    });
    const addNote = h('p', {class: 'progress', role: 'status', 'aria-live': 'polite', hidden: true});
    addInput.addEventListener('change', () => {
      const files = Array.from(addInput.files ?? []);
      addInput.value = '';
      if (!files.length) return;
      void run(async () => {
        let hasCover = !!a.primaryFileId && !!cover;
        let version = a.version;
        for (const [i, file] of files.entries()) {
          const n = i + 1;
          try {
            addNote.hidden = false;
            addNote.textContent = `Preparing photo ${n} of ${files.length}`;
            const prepared = await prepareImage(file, file.name || `photo-${n}.jpg`);
            addNote.textContent = `Uploading photo ${n} of ${files.length}…`;
            const rec = await uploadPrepared(prepared, 'photo');
            await attachToArtwork(rec.id, a.id);
            if (!hasCover) {
              const upd = await updateWork(a.id, {primaryFileId: rec.id, palette: prepared.palette}, version);
              version = upd.version;
              hasCover = true;
            }
          } catch (e) {
            addNote.hidden = true;
            problem.textContent = `Photo ${n} didn't make it. ${plainError(e, 'Check your connection.')}`;
            problem.hidden = false;
            await show();
            return;
          }
        }
        addNote.hidden = true;
        await show();
      });
    });

    // ---- the draft being written
    current = {pending: () => pending(false)};
    const waiting = draftingNow(a.id);
    if (waiting && !watching) {
      watching = true;
      void waitForDraft(a.id, waiting.since, {startedAt: waiting.startedAt, keepGoing: () => el.isConnected}).then(
        async fresh => {
          watching = false;
          if (!el.isConnected) return;
          if (!fresh) {
            toast('The draft is taking longer than usual. Check back in a moment.');
            return void show();
          }
          const p = busy ? null : current?.pending(); // the screen as it is now, not as it was drawn
          if (p && !Object.keys(p.art).length && !p.alt) {
            toast('The draft is ready.');
            return void show(fresh);
          }
          toast('The draft is ready. Save your changes, then reopen this work to see it.');
        },
      );
    }

    // ---- the page
    mount(
      el,
      h('p', {class: 'crumb'}, h('a', {href: '/studio/works'}, '← All works')),
      notice ? h('p', {class: 'err', role: 'alert'}, notice) : null,
      h('div', {class: 'work-head'}, h('h1', null, a.title || 'Untitled'), h('div', {class: 'chips'}, statusChips(a))),
      a.public && a.publishedAt ? h('p', {class: 'muted'}, `Public since ${plainDate(a.publishedAt)}`) : null,
      waiting
        ? h('p', {class: 'banner static', role: 'status', 'aria-live': 'polite'}, 'The assistant is writing a draft…')
        : null,
      cover
        ? h(
            'button',
            {class: 'cover-btn', 'aria-label': 'View the photo full screen', onclick: lightbox},
            picture(cover, 960, {alt: cover.altText ?? a.title, class: 'cover-pic'}),
          )
        : h('div', {class: 'card empty'}, h('p', {class: 'muted'}, 'This work has no photo yet.')),
      others.length ? row : null,
      h('div', {class: 'row'}, h('label', {class: 'btn', for: 'more-photos'}, 'Add photos'), addInput),
      addNote,
      a.palette.length
        ? h(
            'div',
            {class: 'swatches', role: 'img', 'aria-label': 'The main colours in this work'},
            a.palette.map(s => h('span', {class: 'swatch', title: s.hex, style: `background:${s.hex}`})),
          )
        : null,
      h(
        'form',
        {onsubmit: onSave, novalidate: true},
        h('div', {class: 'card'}, title.el, description.el, collection.el, tags.el, cover ? alt.el : null),
        h(
          'div',
          {class: 'card'},
          size.el,
          medium.el,
          year.el,
          price.el,
          status.el,
          edition.el,
          a.public ? slug.el : null,
        ),
        problem,
        h('div', {class: 'row'}, h('button', {class: 'primary act', type: 'submit'}, 'Save changes')),
      ),
      h(
        'div',
        {class: 'card actions'},
        a.public
          ? h('button', {class: 'act', type: 'button', onclick: onUnpublish}, 'Unpublish')
          : h('button', {class: 'primary act', type: 'button', onclick: onPublish}, 'Approve and publish'),
        a.public ? null : h('button', {class: 'act', type: 'button', onclick: onRedo}, 'Redo the draft'),
        h('button', {class: 'act danger', type: 'button', onclick: onDelete}, 'Delete'),
      ),
    );
    notice = '';
  }

  await show();
}
